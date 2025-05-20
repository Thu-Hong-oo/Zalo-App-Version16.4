require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const multer = require("multer");
const path = require("path");
const { createServer } = require("http");
const { Server } = require("socket.io");
const jwt = require('jsonwebtoken');
const videoCallService = require('./modules/videoCall/videoCall.service');

const PORT = process.env.PORT;

// Import routes
const authRoutes = require("./modules/auth/routes");
const userRoutes = require("./modules/user/routes");
const groupRoutes = require("./modules/group/group.route");
const friendRoutes = require("./modules/friend/routes");
const conversationRoutes = require("./modules/conversation/routes");
const videoCallRoutes = require("./modules/videoCall/videoCall.route");
const {
  routes: chatGroupRoutes,
  socket: initializeChatGroupSocket,
} = require("./modules/chatGroup");
const {
  routes: chatRoutes,
  socket: initializeChatSocket,
} = require("./modules/chat");

// Initialize express app
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  },
  transports: ["websocket", "polling"],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
});
app.set('io', io);
// Multer config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "..", "uploads", "files"));
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + Math.floor(Math.random() * 100000) + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Middleware

app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:8081"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type", "Authorization", "Accept", "Content-Length", "X-Requested-With", "Access-Control-Allow-Origin"
    ],
    exposedHeaders: ["Content-Length", "X-Requested-With"],
    credentials: true,
    maxAge: 86400,
  })
);

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.use((req, res, next) => {
  req.upload = upload;
  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

// app.use("/api", gatewayRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/video-call", videoCallRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/chat-group", chatGroupRoutes);

// Socket.IO Video Call Events

// Socket authentication middleware
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error - No token provided'));
    }

    // Remove 'Bearer ' prefix if exists
    const tokenString = token.startsWith('Bearer ') ? token.slice(7) : token;

    // Verify token
    const decoded = jwt.verify(tokenString, process.env.JWT_SECRET);
    socket.user = decoded;
    console.log('Socket authenticated for user:', decoded);
    next();
  } catch (err) {
    console.error('Socket authentication error:', err);
    next(new Error('Authentication error - Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join room for video call
  socket.on('join-call-room', (callId) => {
    socket.join(callId);
    console.log(`User ${socket.id} joined call room: ${callId}`);
  });

  // Handle WebRTC signaling
  socket.on('video-call-offer', async (data) => {
    try {
      const { receiverPhone, offer } = data;
      const callerId = socket.user.userId; // Use authenticated user ID

      // Tạo cuộc gọi mới trong database
      const call = await videoCallService.createCall(callerId, receiverPhone, 'video');

      // Gửi offer đến người nhận
      socket.to(receiverPhone).emit('video-call-offer', {
        offer,
        callerId,
        callId: call._id
      });
    } catch (error) {
      console.error('Error handling video call offer:', error);
      socket.emit('error', { message: 'Failed to initiate video call' });
    }
  });

  socket.on('video-call-answer', async (data) => {
    try {
      const { callerId, answer, callId } = data;
      
      // Cập nhật trạng thái cuộc gọi
      await videoCallService.updateCallStatus(callId, 'active');

      // Gửi answer đến người gọi
      socket.to(callerId).emit('video-call-answer', {
        answer,
        callId
      });
    } catch (error) {
      console.error('Error handling video call answer:', error);
      socket.emit('error', { message: 'Failed to handle video call answer' });
    }
  });

  socket.on('ice-candidate', (data) => {
    const { receiverPhone, candidate } = data;
    socket.to(receiverPhone).emit('ice-candidate', {
      candidate,
      userId: socket.id
    });
  });

  socket.on('end-video-call', async (data) => {
    try {
      const { receiverPhone, callId } = data;
      
      // Cập nhật trạng thái cuộc gọi
      if (callId) {
        await videoCallService.endCall(callId);
      }

      // Thông báo cho người nhận
      socket.to(receiverPhone).emit('video-call-ended', {
        userId: socket.id
      });
    } catch (error) {
      console.error('Error ending video call:', error);
      socket.emit('error', { message: 'Failed to end video call' });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: "error",
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "Route not found",
  });
});

// Initialize socket connections
initializeChatSocket(io);
initializeChatGroupSocket(io);

// Start server
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server đang chạy tại http://localhost:${PORT}`);
});
