const { v4: uuidv4 } = require("uuid");
const {
  PutCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");
const dynamodb = require("../../config/aws");
const axios = require("axios");

const TABLE_NAME = "friendRequests";
const USERS_TABLE = "users-zalolite";
const FRIENDS_TABLE = "friends-zalolite";

async function getUserProfile(userId) {
  const result = await dynamodb.send(
    new QueryCommand({
      TableName: USERS_TABLE,
      IndexName: "userId-index",
      KeyConditionExpression: "userId = :u",
      ExpressionAttributeValues: { ":u": userId },
    })
  );
  return result.Items?.[0] || null;
}

// Gửi lời mời kết bạn
exports.sendFriendRequest = async (req, res) => {
  const { from, to } = req.body;
  if (!from || !to || from === to) {
    return res.status(400).json({ success: false, message: "Thiếu thông tin hoặc không thể gửi cho chính mình" });
  }

  const requestId = uuidv4();
  const item = {
    requestId,
    from,
    to,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  try {
    await dynamodb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    res.json({ success: true, message: "Đã gửi lời mời" });
  } catch (err) {
    console.error("Lỗi gửi:", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ", error: err.message });
  }
};

// Lấy danh sách lời mời đã gửi
exports.getSentRequests = async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    return res.status(400).json({ success: false, message: "Thiếu userId" });
  }

  try {
    const result = await dynamodb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "#from = :from",
        ExpressionAttributeNames: { "#from": "from" },
        ExpressionAttributeValues: { ":from": userId },
      })
    );

    const enriched = await Promise.all(
      result.Items.map(async (req) => {
        try {
          const userRes = await axios.get(`http://localhost:3000/api/users/${req.to}`);
          const user = userRes.data.user;
          return {
            ...req,
            name: user?.name || "Không rõ",
            avatar: user?.avatar || "/default-avatar.png",
          };
        } catch (e) {
          return { ...req, name: "Không rõ", avatar: "/default-avatar.png" };
        }
      })
    );

    res.json({ success: true, sent: enriched });
  } catch (err) {
    console.error("❌ Lỗi lấy lời mời đã gửi:", err);
    res.status(500).json({ success: false, message: "Lỗi lấy lời mời đã gửi", error: err.message });
  }
};

// Lấy danh sách lời mời đã nhận
exports.getReceivedRequests = async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ success: false, message: "Thiếu userId" });

  try {
    const result = await dynamodb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "#to = :toVal AND #status = :statusVal",
        ExpressionAttributeNames: {
          "#to": "to",
          "#status": "status"
        },
        ExpressionAttributeValues: {
          ":toVal": userId,
          ":statusVal": "pending"
        }
      })
    );

    const enriched = await Promise.all(
      result.Items.map(async (item) => {
        const user = await getUserProfile(item.from);
        return {
          ...item,
          fromUser: {
            name: user?.name || "Không rõ",
            avatar: user?.avatar || "/default-avatar.png"
          }
        };
      })
    );

    res.json({ success: true, received: enriched });
  } catch (err) {
    console.error("Lỗi lấy nhận:", err);
    res.status(500).json({ success: false, message: "Lỗi server", error: err.message });
  }
};

// Chấp nhận lời mời kết bạn
exports.acceptFriendRequest = async (req, res) => {
  const { requestId } = req.body;
  if (!requestId) return res.status(400).json({ success: false, message: "Thiếu requestId" });

  try {
    const request = await dynamodb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "requestId = :rid",
        ExpressionAttributeValues: { ":rid": requestId },
      })
    );

    const friendRequest = request.Items?.[0];
    if (!friendRequest) return res.status(404).json({ success: false, message: "Không tìm thấy lời mời" });

    const { from, to } = friendRequest;
    const createdAt = new Date().toISOString();

    await Promise.all([
      dynamodb.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { requestId },
        UpdateExpression: "SET #status = :status",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":status": "accepted" },
      })),
      dynamodb.send(new PutCommand({
        TableName: FRIENDS_TABLE,
        Item: { userId: from, friendId: to, createdAt },
      })),
      dynamodb.send(new PutCommand({
        TableName: FRIENDS_TABLE,
        Item: { userId: to, friendId: from, createdAt },
      })),
    ]);

    res.json({ success: true, message: "Đã đồng ý kết bạn" });
  } catch (err) {
    console.error("Lỗi accept:", err);
    res.status(500).json({ success: false, message: "Lỗi server", error: err.message });
  }
};

// Từ chối lời mời kết bạn
exports.rejectFriendRequest = async (req, res) => {
  const { requestId } = req.body;
  if (!requestId) return res.status(400).json({ success: false, message: "Thiếu requestId" });

  try {
    await dynamodb.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { requestId },
      UpdateExpression: "SET #status = :status",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":status": "rejected" },
    }));
    res.json({ success: true, message: "Đã từ chối" });
  } catch (err) {
    console.error("Lỗi reject:", err);
    res.status(500).json({ success: false, message: "Lỗi server", error: err.message });
  }
};

// Hủy lời mời kết bạn
exports.cancelFriendRequest = async (req, res) => {
  const { requestId } = req.body;
  if (!requestId) return res.status(400).json({ success: false, message: "Thiếu requestId" });

  try {
    await dynamodb.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { requestId } }));
    res.json({ success: true, message: "Đã thu hồi" });
  } catch (err) {
    console.error("Lỗi cancel:", err);
    res.status(500).json({ success: false, message: "Lỗi server", error: err.message });
  }
};

// Lấy danh sách bạn bè
exports.getFriendsList = async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ success: false, message: "Thiếu userId" });

  try {
    const result = await dynamodb.send(
      new QueryCommand({
        TableName: FRIENDS_TABLE,
        KeyConditionExpression: "userId = :u",
        ExpressionAttributeValues: { ":u": userId },
      })
    );

    const friends = await Promise.all(
      (result.Items || []).map(async (item) => {
        const user = await getUserProfile(item.friendId);
        return {
          userId: item.friendId,
          name: user?.name || "Không rõ",
          avatar: user?.avatar || "/default-avatar.png",
        };
      })
    );

    res.json({ success: true, friends });
  } catch (err) {
    console.error("Lỗi getFriendsList:", err);
    res.status(500).json({ success: false, message: "Lỗi server", error: err.message });
  }
}; 