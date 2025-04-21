require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const winston = require("winston");
const multer = require("multer");
const path = require("path");
// const { errorHandler } = require("./middleware/error");
const { createServer } = require("http");
const { Server } = require("socket.io");
const PORT = process.env.PORT || 3030;

// Import routes
const authRoutes = require("./modules/auth/routes");
const userRoutes = require("./modules/user/routes");
// const gatewayRoutes = require("./modules/gateway/routes");
const groupRoutes = require("./modules/group/group.route");
const friendRoutes = require("./modules/friend/routes");
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
    origin: "*", // Cho phép tất cả các origin
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  },
  transports: ["websocket", "polling"], // Hỗ trợ cả websocket và polling
  allowEIO3: true, // Cho phép Engine.IO v3
  pingTimeout: 60000, // Tăng thời gian timeout
  pingInterval: 25000, // Tăng khoảng thời gian ping
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "..", "uploads", "files"));
  },
  filename: function (req, file, cb) {
    const uniqueName =
      Date.now() +
      "-" +
      Math.floor(Math.random() * 100000) +
      path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// Make upload middleware available to routes
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
app.use("/api/chat", chatRoutes);
app.use("/api/chat-group", chatGroupRoutes);

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
  // logger.info(`Server đang chạy trên port ${PORT}`);
  console.log(`Server có thể truy cập từ: http://localhost:${PORT}`);
  console.log(`Hoặc từ IP của máy: http://<your-ip>:${PORT}`);
});

module.exports = app;
