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
const FRIENDS_TABLE = "friends";

function normalizePhone(phone) {
  if (!phone) return "";
  let result = phone;
  if (result.startsWith("+84")) result = result.replace("+84", "84");
  else if (result.startsWith("0")) result = result.replace(/^0/, "84");
  if (!/^\d{10,12}$/.test(result)) return "";
  return result;
}

async function getUserProfile(phone) {
  const result = await dynamodb.send(
    new QueryCommand({
      TableName: USERS_TABLE,
      KeyConditionExpression: "phone = :p",
      ExpressionAttributeValues: { ":p": phone },
    })
  );
  return result.Items?.[0] || null;
}

// Gửi lời mời kết bạn
exports.sendFriendRequest = async (req, res) => {
  const { from, to } = req.body;
  const fromPhone = normalizePhone(from);
  const toPhone = normalizePhone(to);

  if (!fromPhone || !toPhone || fromPhone === toPhone) {
    return res.status(400).json({ success: false, message: "Thiếu thông tin hoặc không thể gửi cho chính mình" });
  }

  const requestId = uuidv4();
  const item = {
    requestId,
    from: fromPhone,
    to: toPhone,
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
  let { phone } = req.params;
  phone = normalizePhone(phone);
  if (!phone || phone.length < 9) {
    return res.status(400).json({ success: false, message: "Số điện thoại không hợp lệ" });
  }

  try {
    const result = await dynamodb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "#from = :from",
        ExpressionAttributeNames: { "#from": "from" },
        ExpressionAttributeValues: { ":from": phone },
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
  let { phone } = req.params;
  const toPhone = normalizePhone(phone);
  if (!toPhone) return res.status(400).json({ success: false, message: "Thiếu số điện thoại" });

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
          ":toVal": toPhone,
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
            name: user?.name || item.from,
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
        Item: { userPhone: from, friendPhone: to, createdAt: new Date().toISOString() },
      })),
      dynamodb.send(new PutCommand({
        TableName: FRIENDS_TABLE,
        Item: { userPhone: to, friendPhone: from, createdAt: new Date().toISOString() },
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
  const { phone } = req.params;
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return res.status(400).json({ success: false, message: "Thiếu số điện thoại" });

  try {
    const result = await dynamodb.send(
      new QueryCommand({
        TableName: FRIENDS_TABLE,
        KeyConditionExpression: "userPhone = :u",
        ExpressionAttributeValues: { ":u": normalizedPhone },
      })
    );

    const friends = await Promise.all(
      (result.Items || []).map(async (item) => {
        const user = await getUserProfile(item.friendPhone);
        return {
          phone: item.friendPhone,
          name: user?.name || item.friendPhone,
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