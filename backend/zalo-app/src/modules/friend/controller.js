const { v4: uuidv4 } = require("uuid");
const {
  PutCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  GetCommand,
} = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

const client    = new DynamoDBClient({});
const dynamodb  = DynamoDBDocumentClient.from(client);
const db        = dynamodb;

const TABLE_REQUEST = "friendRequests";
const USERS_TABLE = "users-zalolite";
const FRIENDS_TABLE = "friends-zalolite";

/* ───────── helpers ───────── */
const getUserProfile = async (userId) => {
  const res = await dynamodb.send(
    new GetCommand({ TableName: USERS_TABLE, Key: { userId } })
  );
  return res.Item ?? null;
};

const getUser = async (id) =>
  (await dynamodb.send(
     new GetCommand({ TableName: USERS_TABLE, Key: { userId: id } })
   )).Item;


async function getUserIdByPhone(phone) {
  try {
    const result = await dynamodb.send(new ScanCommand({
      TableName: USERS_TABLE,
      FilterExpression: "#phone = :p",
      ExpressionAttributeNames: { "#phone": "phone" },
      ExpressionAttributeValues: { ":p": phone },
    }));
    return result.Items?.[0]?.userId || null;
  } catch (error) {
    console.error(`Error finding userId by phone ${phone}:`, error);
    return null;
  }
}

/* ───────── API ───────── */
/* ---------- Send request ---------- */
exports.sendFriendRequest = async (req, res) => {
  const { from, to } = req.body;
  if (!from || !to || from === to)
    return res.status(400).json({ success: false, message: "Thông tin không hợp lệ" });

  if (!(await getUser(to)))
    return res.status(404).json({ success: false, message: "Không tìm thấy người nhận" });

  const { Items: friends = [] } = await db.send(new QueryCommand({
    TableName: FRIENDS_TABLE,
    KeyConditionExpression: "userId=:u AND friendId=:f",
    ExpressionAttributeValues: { ":u": from, ":f": to },
  }));
  if (friends[0])
    return res.status(409).json({ success: false, code: "ALREADY_FRIEND", message: "Hai tài khoản đã là bạn bè" });

  const { Items: reqs = [] } = await db.send(new ScanCommand({
    TableName: TABLE_REQUEST,
    FilterExpression: "(#from=:f AND #to=:t) OR (#from=:t AND #to=:f)",
    ExpressionAttributeNames: { "#from": "from", "#to": "to" },
    ExpressionAttributeValues: { ":f": from, ":t": to },
  }));

  if (reqs[0]) {
    if (reqs[0].status === "pending")
      return res.status(409).json({ success: false, code: "ALREADY_SENT", request: reqs[0], message: "Đã có lời mời đang chờ" });
    if (reqs[0].status === "accepted")
      return res.status(409).json({ success: false, code: "ALREADY_FRIEND", message: "Hai tài khoản đã là bạn bè" });
  }

  await db.send(new PutCommand({
    TableName: TABLE_REQUEST,
    Item: {
      requestId: uuidv4(),
      from,
      to,
      status: "pending",
      createdAt: new Date().toISOString(),
    },
  }));
  res.json({ success: true, message: "Đã gửi lời mời" });
};


/* ---------- NEW endpoint: check-status ---------- */
exports.checkFriendRequestStatus = async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to)
    return res.status(400).json({ success: false, message: "Thiếu from/to" });

  const { Items = [] } = await db.send(new ScanCommand({
    TableName: TABLE_REQUEST,
    FilterExpression: "(#from=:f AND #to=:t) OR (#from=:t AND #to=:f)",
    ExpressionAttributeNames: { "#from": "from", "#to": "to" },
    ExpressionAttributeValues: { ":f": from, ":t": to },
  }));

  if (!Items[0]) return res.json({ success: true, status: "none" });
  if (Items[0].status === "pending") return res.json({ success: true, status: "pending" });
  return res.json({ success: true, status: "accepted" });
};

/* ----- getSentRequests ----- */
exports.getSentRequests = async (req, res) => {
  const { userId } = req.params;
  const { Items = [] } = await db.send(new ScanCommand({
    TableName: TABLE_REQUEST,
    FilterExpression: "#from = :u AND #status = :s",
    ExpressionAttributeNames: { "#from": "from", "#status": "status" },
    ExpressionAttributeValues: { ":u": userId, ":s": "pending" },
  }));
  const sent = await Promise.all(Items.map(async it => ({
    ...it,
    toUser: await getUserProfile(it.to),
  })));
  res.json({ success: true, sent });
};

/* ----- getReceivedRequests ----- */
exports.getReceivedRequests = async (req, res) => {
  const { userId } = req.params;
  const { Items = [] } = await db.send(new ScanCommand({
    TableName: TABLE_REQUEST,
    FilterExpression: "#to = :u AND #status = :s",
    ExpressionAttributeNames: { "#to": "to", "#status": "status" },
    ExpressionAttributeValues: { ":u": userId, ":s": "pending" },
  }));
  const received = await Promise.all(Items.map(async it => ({
    ...it,
    fromUser: await getUserProfile(it.from),
  })));
  res.json({ success: true, received });
};

/* ----- acceptFriendRequest ----- */
exports.acceptFriendRequest = async (req, res) => {
  const { requestId } = req.body;
  const { Items } = await db.send(new ScanCommand({
    TableName: TABLE_REQUEST,
    FilterExpression: "requestId = :r",
    ExpressionAttributeValues: { ":r": requestId },
  }));
  const fr = Items?.[0];
  if (!fr) return res.status(404).json({ success: false, message: "Không tìm thấy lời mời" });

  const { from, to } = fr;
  const createdAt = new Date().toISOString();

  if (from !== to) {
    await db.send(new PutCommand({ TableName: FRIENDS_TABLE, Item: { userId: from, friendId: to, createdAt } }));
    await db.send(new PutCommand({ TableName: FRIENDS_TABLE, Item: { userId: to, friendId: from, createdAt } }));
  }

  await db.send(new UpdateCommand({
    TableName: TABLE_REQUEST,
    Key: { requestId },
    UpdateExpression: "SET #status = :a",
    ExpressionAttributeNames: { "#status": "status" },
    ExpressionAttributeValues: { ":a": "accepted" },
  }));

  res.json({ success: true, message: "Đã đồng ý kết bạn" });
};


exports.rejectFriendRequest = async (req, res) => {
  const { requestId } = req.body;
  try {
    await db.send(new UpdateCommand({
      TableName: TABLE_REQUEST,
      Key: { requestId },
      UpdateExpression: "SET #status = :s",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":s": "rejected" },
    }));
    res.json({ success: true, message: "Đã từ chối" });
  } catch (err) {
    console.error("❌ Lỗi reject:", err);
    res.status(500).json({ success: false, message: "Lỗi server", error: err.message });
  }
};

exports.cancelFriendRequest = async (req, res) => {
  const { requestId } = req.body;
  try {
    await db.send(new DeleteCommand({ TableName: TABLE_REQUEST, Key: { requestId } }));
    res.json({ success: true, message: "Đã thu hồi" });
  } catch (err) {
    console.error("❌ Lỗi cancel:", err);
    res.status(500).json({ success: false, message: "Lỗi server", error: err.message });
  }
};

exports.getFriendsList = async (req, res) => {
  const { userId } = req.params;
  try {
    const { Items = [] } = await db.send(new QueryCommand({
      TableName: FRIENDS_TABLE,
      KeyConditionExpression: "userId = :u",
      ExpressionAttributeValues: { ":u": userId },
    }));

    const uniqueIds = [
      ...new Set(
        Items
          .filter(it => it.friendId && it.friendId !== userId)
          .map(it => it.friendId)
      )
    ];

    const friends = await Promise.all(uniqueIds.map(async fid => {
      const u = await getUserProfile(fid);
      return {
        userId : fid,
        name   : u?.name   ?? "Không rõ",
        avatar : u?.avatar ?? "/default-avatar.png",
        phone  : u?.phone  ?? null,
      };
    }));

    res.json({ success: true, friends });
  } catch (err) {
    console.error("❌ Lỗi getFriendsList:", err);
    res.status(500).json({ success: false, message: "Lỗi server", error: err.message });
  }
};


// controller.js
exports.deleteFriend = async (req, res) => {
  const { userId, friendId } = req.body;
  try {
    await db.send(new DeleteCommand({
      TableName: FRIENDS_TABLE,
      Key: { userId, friendId },
    }));
    await db.send(new DeleteCommand({
      TableName: FRIENDS_TABLE,
      Key: { userId: friendId, friendId: userId },
    }));
    res.json({ success: true, message: "Đã xóa bạn thành công" });
  } catch (err) {
    console.error("❌ Lỗi xóa bạn:", err);
    res.status(500).json({ success: false, message: "Lỗi server", error: err.message });
  }
};

exports.getFriends = exports.getFriendsList;


// Chuẩn hóa số điện thoại (VD: 0123456789 => 84123456789)
function normalizePhone(phone) {
  if (phone.startsWith("0")) {
    return "84" + phone.slice(1);
  }
  return phone;
}

// GET /friends/:userId
exports.getFriends = async (req, res) => {
  const { userId } = req.params;

  const { Items=[] } = await db.send(new QueryCommand({
    TableName: FRIENDS_TABLE,
    KeyConditionExpression: "userId = :u",
    ExpressionAttributeValues: { ":u": userId },
  }));

  const friends = await Promise.all(
    Items.map(async ({ friendId }) => {
      const u = await getUserProfile(friendId);
      return {
        userId : friendId,
        name   : u?.name   ?? "(chưa đặt tên)",
        avatar : u?.avatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent('User')}`,
        phone  : u?.phone  ?? null,
      };
    })
  );

  res.json({ success:true, friends });
};

// GET /friends/request/status?from=...&to=...
exports.checkStatus = async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ success:false, message:"Thiếu from / to" });

  /* 1️⃣  xem trong bảng bạn bè */
  const { Items:fri=[] } = await db.send(new QueryCommand({
    TableName             : FRIENDS_TABLE,
    KeyConditionExpression: "userId = :u AND friendId = :f",
    ExpressionAttributeValues:{ ":u": from, ":f": to },
  }));
  if (fri[0]) return res.json({ success:true, status:"accepted" });

  /* 2️⃣  xem trong bảng request 2 chiều */
  const { Items:requests=[] } = await db.send(new ScanCommand({
    TableName: REQUEST_TABLE,
    FilterExpression:"(#from=:f AND #to=:t) OR (#from=:t AND #to=:f)",
    ExpressionAttributeNames : { "#from":"from", "#to":"to" },
    ExpressionAttributeValues: { ":f":from, ":t":to },
  }));

  if (!requests[0])                return res.json({ success:true, status:"none"   });
  if (requests[0].status ==="pending")  return res.json({ success:true, status:"pending" });
  return res.json({ success:true, status:"accepted" }); // phòng xa
};
