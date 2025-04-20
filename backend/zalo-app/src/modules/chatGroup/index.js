const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middleware/auth");
const { DynamoDB } = require("aws-sdk");
const dynamoDB = new DynamoDB.DocumentClient();
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { uploadToS3 } = require("../media/services");
const { GroupMemberService } = require("../group");

// Map để lưu trữ các kết nối socket theo số điện thoại
const connectedUsers = new Map();

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
});

// Controller functions
const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { lastEvaluatedKey, limit = 50, before = true } = req.query;
    const userId = req.user.userId;

    // Kiểm tra quyền truy cập nhóm
    const member = await GroupMemberService.getMember(groupId, userId);
    if (!member) {
      return res.status(403).json({
        status: "error",
        message: "Bạn không phải là thành viên của nhóm này",
      });
    }

    if (!member.isActive) {
      return res.status(403).json({
        status: "error",
        message: "Bạn đã bị xóa khỏi nhóm này",
      });
    }

    // Lấy danh sách tin nhắn đã xóa của user
    const deletedMessages = await getDeletedMessages(userId, groupId);
    const deletedMessageIds = new Set(deletedMessages);

    const params = {
      TableName: process.env.GROUP_MESSAGE_TABLE,
      IndexName: "groupIndex",
      KeyConditionExpression: "groupId = :groupId",
      ExpressionAttributeValues: {
        ":groupId": groupId,
      },
      ScanIndexForward: !before,
      Limit: parseInt(limit),
    };

    if (lastEvaluatedKey) {
      try {
        params.ExclusiveStartKey = JSON.parse(lastEvaluatedKey);
      } catch (e) {
        console.warn("Invalid lastEvaluatedKey:", e);
      }
    }

    const result = await dynamoDB.query(params).promise();
    console.log("Raw messages from DynamoDB:", result.Items); // Debug log

    // Tạo map để lưu trữ tin nhắn gốc và trạng thái xóa
    const messageMap = new Map();

    // Xử lý từng tin nhắn
    result.Items.forEach((message) => {
      if (message.type === "delete_record") {
        // Nếu là bản ghi xóa, lưu vào map với key là messageId bị xóa
        const deletedMessageId = message.metadata?.deletedMessageId;
        if (deletedMessageId) {
          messageMap.set(deletedMessageId, {
            ...messageMap.get(deletedMessageId),
            isDeleted: true,
            deletedBy: message.senderId,
            deletedAt: message.createdAt,
          });
        }
      } else {
        // Nếu là tin nhắn gốc, lưu vào map
        messageMap.set(message.groupMessageId, {
          ...message,
          isDeleted: false,
        });
      }
    });

    // Lọc tin nhắn đã bị xóa bởi user hiện tại
    const filteredMessages = Array.from(messageMap.values()).filter(
      (message) =>
        !message.isDeleted ||
        (message.isDeleted && message.deletedBy !== userId)
    );

    console.log("Filtered messages:", filteredMessages); // Debug log

    // Group messages by date
    const messagesByDate = {};
    filteredMessages.forEach((message) => {
      const messageDate = new Date(message.createdAt).toLocaleDateString(
        "vi-VN"
      );
      if (!messagesByDate[messageDate]) {
        messagesByDate[messageDate] = [];
      }
      messagesByDate[messageDate].push(message);
    });

    res.json({
      status: "success",
      data: {
        messages: messagesByDate,
        pagination: {
          hasMore: result.LastEvaluatedKey !== undefined,
          total: filteredMessages.length,
          lastEvaluatedKey: result.LastEvaluatedKey
            ? JSON.stringify(result.LastEvaluatedKey)
            : null,
        },
      },
    });
  } catch (error) {
    console.error("Error getting group messages:", error);
    res.status(500).json({
      status: "error",
      message: "Đã xảy ra lỗi khi lấy tin nhắn nhóm",
      error: error.message,
    });
  }
};

// Service functions
const GroupMessageService = {
  async sendMessage(
    groupId,
    senderId,
    content,
    fileUrl = null,
    fileType = null
  ) {
    const member = await GroupMemberService.getMember(groupId, senderId);
    if (!member || !member.isActive) {
      throw new Error("Bạn không có quyền gửi tin nhắn trong nhóm này");
    }

    const messageId = uuidv4();
    const timestamp = new Date().toISOString();

    const messageData = {
      groupMessageId: messageId,
      groupId,
      senderId,
      content: content || fileUrl,
      type: fileUrl ? "file" : "text",
      fileType: fileUrl ? fileType : null,
      createdAt: timestamp,
      updatedAt: timestamp,
      status: "sent",
      metadata: {},
    };

    await dynamoDB
      .put({
        TableName: process.env.GROUP_MESSAGE_TABLE,
        Item: messageData,
      })
      .promise();

    return messageData;
  },

  async recallMessage(groupId, messageId, userId) {
    const member = await GroupMemberService.getMember(groupId, userId);
    if (!member || !member.isActive) {
      throw new Error("Bạn không có quyền thu hồi tin nhắn trong nhóm này");
    }

    const originalMessage = await getMessageById(messageId, groupId);
    if (!originalMessage) {
      throw new Error("Không tìm thấy tin nhắn");
    }

    if (originalMessage.senderId !== userId) {
      throw new Error("Bạn không có quyền thu hồi tin nhắn này");
    }

    const messageAge =
      Date.now() - new Date(originalMessage.createdAt).getTime();
    const MAX_RECALL_TIME = 2 * 60 * 1000; // 2 phút
    if (messageAge > MAX_RECALL_TIME) {
      throw new Error("Không thể thu hồi tin nhắn sau 2 phút");
    }

    const updateParams = {
      TableName: process.env.GROUP_MESSAGE_TABLE,
      Key: { groupMessageId: messageId },
      UpdateExpression: "set #status = :status, content = :content",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": "recalled",
        ":content": "Tin nhắn đã bị thu hồi",
      },
      ReturnValues: "ALL_NEW",
    };

    const result = await dynamoDB.update(updateParams).promise();
    return result.Attributes;
  },

  async deleteMessage(groupId, messageId, userId) {
    const member = await GroupMemberService.getMember(groupId, userId);
    if (!member || !member.isActive) {
      throw new Error("Bạn không có quyền xóa tin nhắn trong nhóm này");
    }

    const originalMessage = await getMessageById(messageId, groupId);
    if (!originalMessage) {
      throw new Error("Không tìm thấy tin nhắn");
    }

    const deleteRecordId = uuidv4();
    const timestamp = new Date().toISOString();

    const deleteRecord = {
      TableName: process.env.GROUP_MESSAGE_TABLE,
      Item: {
        groupMessageId: deleteRecordId,
        groupId,
        senderId: userId,
        content: originalMessage.content,
        type: "delete_record",
        createdAt: timestamp,
        updatedAt: timestamp,
        status: "deleted",
        metadata: {
          deletedMessageId: messageId,
          deletedBy: userId,
          senderName: member.name,
          senderAvatar: member.avatar,
          originalSender: originalMessage.senderId,
          originalType: originalMessage.type,
          originalContent: originalMessage.content,
        },
      },
    };

    await dynamoDB.put(deleteRecord).promise();
    return { deletedMessageId: messageId, deletedBy: userId, originalMessage };
  },
};

// API Controllers
const sendGroupMessage = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { content, fileUrl, fileType } = req.body;
    const senderId = req.user.userId;

    const message = await GroupMessageService.sendMessage(
      groupId,
      senderId,
      content,
      fileUrl,
      fileType
    );

    // Gửi thông báo realtime
    const groupMembers = await GroupMemberService.getGroupMembers(groupId);
    const onlineMembers = groupMembers.filter((member) =>
      connectedUsers.has(member.userId)
    );
    onlineMembers.forEach((member) => {
      const socket = connectedUsers.get(member.userId);
      if (socket) {
        socket.emit("new-group-message", message);
      }
    });

    res.json({ status: "success", data: message });
  } catch (error) {
    console.error("Error sending group message:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Đã xảy ra lỗi khi gửi tin nhắn",
    });
  }
};

const recallGroupMessage = async (req, res) => {
  try {
    const { groupId, messageId } = req.params;
    const userId = req.user.userId;

    const recalledMessage = await GroupMessageService.recallMessage(
      groupId,
      messageId,
      userId
    );

    // Thông báo cho tất cả thành viên trong group
    const groupMembers = await GroupMemberService.getGroupMembers(groupId);
    const onlineMembers = groupMembers.filter((member) =>
      connectedUsers.has(member.userId)
    );
    onlineMembers.forEach((member) => {
      const socket = connectedUsers.get(member.userId);
      if (socket) {
        socket.emit("group-message-recalled", {
          messageId,
          groupId,
          content: "Tin nhắn đã bị thu hồi",
          recalledBy: userId,
          recalledAt: new Date().toISOString(),
        });
      }
    });

    res.json({
      status: "success",
      message: "Đã thu hồi tin nhắn thành công",
      data: recalledMessage,
    });
  } catch (error) {
    console.error("Error recalling group message:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Đã xảy ra lỗi khi thu hồi tin nhắn",
    });
  }
};

const deleteGroupMessage = async (req, res) => {
  try {
    const { groupId, messageId } = req.params;
    const userId = req.user.userId;

    const result = await GroupMessageService.deleteMessage(
      groupId,
      messageId,
      userId
    );

    res.json({
      status: "success",
      message: "Đã xóa tin nhắn",
      data: result,
    });
  } catch (error) {
    console.error("Error deleting group message:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Đã xảy ra lỗi khi xóa tin nhắn",
    });
  }
};

const initializeSocket = (io) => {
  // Middleware xác thực
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error("Authentication error"));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (error) {
      console.error("Socket authentication error:", error);
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    try {
      const userId = socket.user.userId;
      console.log("User connected:", userId);
      connectedUsers.set(userId, socket);

      // Xử lý join group
      socket.on("join-group", async (groupId) => {
        try {
          console.log(`User ${userId} attempting to join group ${groupId}`);
          const member = await GroupMemberService.getMember(groupId, userId);

          if (member && member.isActive) {
            // Join socket room
            socket.join(`group:${groupId}`);
            console.log(`User ${userId} joined socket room group:${groupId}`);

            // Lấy danh sách tin nhắn cũ
            const params = {
              TableName: process.env.GROUP_MESSAGE_TABLE,
              IndexName: "groupIndex",
              KeyConditionExpression: "groupId = :groupId",
              ExpressionAttributeValues: {
                ":groupId": groupId,
              },
              ScanIndexForward: false,
              Limit: 50,
            };

            const result = await dynamoDB.query(params).promise();
            // console.log("Retrieved messages from DynamoDB:", result.Items);

            const messages = result.Items.filter(
              (msg) => msg.type !== "delete_record"
            );

            // Gửi tin nhắn cũ cho user vừa join
            socket.emit("group-history", {
              groupId,
              messages,
            });

            // Thông báo cho các thành viên khác
            io.to(`group:${groupId}`).emit("user-joined", {
              userId,
              groupId,
              metadata: {
                name: member.name,
                avatar: member.avatar,
              },
            });
          } else {
            socket.emit("error", {
              message: "Bạn không có quyền tham gia nhóm này",
            });
          }
        } catch (error) {
          console.error("Error joining group:", error);
          socket.emit("error", {
            message: "Đã xảy ra lỗi khi tham gia nhóm",
          });
        }
      });

      socket.on("send-group-message", async (data) => {
        try {
          const { groupId, content } = data;
          const message = await GroupMessageService.sendMessage(
            groupId,
            userId,
            content
          );

          socket.emit("message-sent", { status: "success", message });
          io.to(`group:${groupId}`).emit("new-group-message", {
            ...message,
            type: "received",
          });
        } catch (error) {
          socket.emit("error", { message: error.message });
        }
      });

      socket.on("recall-group-message", async (data) => {
        try {
          const { groupId, messageId } = data;
          await GroupMessageService.recallMessage(groupId, messageId, userId);

          io.to(`group:${groupId}`).emit("group-message-recalled", {
            messageId,
            groupId,
            content: "Tin nhắn đã bị thu hồi",
            recalledBy: userId,
            recalledAt: new Date().toISOString(),
          });
        } catch (error) {
          socket.emit("error", { message: error.message });
        }
      });

      socket.on("delete-group-message", async (data) => {
        try {
          const { groupId, messageId } = data;
          await GroupMessageService.deleteMessage(groupId, messageId, userId);
        } catch (error) {
          socket.emit("error", { message: error.message });
        }
      });

      // Xử lý rời group
      socket.on("leave-group", (groupId) => {
        socket.leave(`group:${groupId}`);
        socket.to(`group:${groupId}`).emit("user-left", {
          userId,
          groupId,
        });
      });

      // Xử lý disconnect
      socket.on("disconnect", () => {
        console.log(`User ${userId} disconnected`);
        connectedUsers.delete(userId);
      });
    } catch (error) {
      console.error("Error in socket connection:", error);
      socket.disconnect();
    }
  });
};

// Helper functions
const getMessageById = async (messageId, groupId) => {
  const params = {
    TableName: process.env.GROUP_MESSAGE_TABLE,
    IndexName: "groupIndex",
    KeyConditionExpression: "groupId = :groupId",
    FilterExpression: "groupMessageId = :messageId",
    ExpressionAttributeValues: {
      ":groupId": groupId,
      ":messageId": messageId,
    },
  };

  const result = await dynamoDB.query(params).promise();
  return result.Items[0]; // Trả về tin nhắn đầu tiên tìm thấy
};

// Sửa lại hàm lấy tin nhắn đã xóa
const getDeletedMessages = async (userId, groupId) => {
  const params = {
    TableName: process.env.GROUP_MESSAGE_TABLE,
    IndexName: "senderIndex",
    KeyConditionExpression: "senderId = :senderId",
    FilterExpression: "groupId = :groupId",
    ExpressionAttributeValues: {
      ":senderId": userId,
      ":groupId": groupId,
    },
  };

  const result = await dynamoDB.query(params).promise();
  console.log("Deleted messages query result:", result.Items); // Debug log

  return result.Items.filter((item) => item.type === "delete_record")
    .map((item) => item.metadata?.deletedMessageId)
    .filter(Boolean);
};

// Routes
router.get("/:groupId/messages", authMiddleware, getGroupMessages);
router.post("/:groupId/messages", authMiddleware, sendGroupMessage);
router.delete(
  "/:groupId/messages/:messageId",
  authMiddleware,
  deleteGroupMessage
);
router.put(
  "/:groupId/messages/:messageId/recall",
  authMiddleware,
  recallGroupMessage
);

// Export both router and socket initialization
module.exports = {
  routes: router,
  socket: initializeSocket,
};
