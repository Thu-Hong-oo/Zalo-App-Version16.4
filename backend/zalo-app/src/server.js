require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const multer = require("multer");
const path = require("path");
const { createServer } = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT;

// Import routes
const authRoutes = require("./modules/auth/routes");
const userRoutes = require("./modules/user/routes");
const groupRoutes = require("./modules/group/group.route");
const friendRoutes = require("./modules/friend/routes");
const conversationRoutes = require("./modules/conversation/routes"); // ✅ thêm dòng này
const {
  routes: chatRoutes,
  socket: initializeSocket,
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
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.use((req, res, next) => {
  req.upload = upload;
  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/conversations", conversationRoutes); // ✅ thêm route tạo conversation

// Init socket
initializeSocket(io);

// Start server
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server đang chạy tại http://localhost:${PORT}`);
});
