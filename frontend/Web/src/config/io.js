import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3000';

class SocketIOService {
  constructor() {
    this.socket = null;
  }

  connect() {
    if (!this.socket) {
      // Lấy token từ localStorage
      const token = localStorage.getItem("accessToken");

      this.socket = io(SOCKET_URL, {
        transports: ['websocket'],
        autoConnect: true,
        reconnection: true,
        reconnectionDelay: 10000,
        reconnectionDelayMax: 50000,
        reconnectionAttempts: 5,
        // Thêm dòng này để xác thực
        auth: {
          token: token,
        },
      });

      this.socket.on('connect', () => {
        console.log('Socket connected');
      });

      this.socket.on('disconnect', () => {
        console.log('Socket disconnected');
      });

      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
      });
    }
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event, data) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

const socketService = new SocketIOService();
export default socketService;