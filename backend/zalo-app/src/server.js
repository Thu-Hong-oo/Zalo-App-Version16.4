require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const winston = require("winston");
const multer = require("multer");
const path = require("path");
const { errorHandler } = require("./middleware/error");
const { createServer } = require("http");
const { Server } = require("socket.io");
const PORT = process.env.PORT || 3030;

// Import routes
const authRoutes = require("./modules/auth/routes");
const userRoutes = require("./modules/user/routes");
const gatewayRoutes = require("./modules/gateway/routes");

const {
  routes: chatRoutes,
  socket: initializeSocket,
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

// Configure logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

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
app.use(
  cors({
    origin: "*", // Cho phép tất cả các origin
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "Content-Length",
      "X-Requested-With",
      "Access-Control-Allow-Origin",
    ],
    exposedHeaders: ["Content-Length", "X-Requested-With"],
    credentials: true,
    maxAge: 86400, // 24 hours
  })
);
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// Make upload middleware available to routes
app.use((req, res, next) => {
  req.upload = upload;
  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api", gatewayRoutes);
app.use("/api/chat", chatRoutes);

// Error handling middleware
app.use(errorHandler);

// Initialize socket
initializeSocket(io);

// Start server
httpServer.listen(PORT, "0.0.0.0", () => {
  logger.info(`Server đang chạy trên port ${PORT}`);
  console.log(`Server có thể truy cập từ: http://localhost:${PORT}`);
  console.log(`Hoặc từ IP của máy: http://<your-ip>:${PORT}`);
});

module.exports = app;
