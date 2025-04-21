import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  async connect() {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        console.error('No token found for socket connection');
        return;
      }

      this.socket = io(API_URL, {
        auth: {
          token: token
        },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      this.setupEventListeners();
    } catch (error) {
      console.error('Socket connection error:', error);
    }
  }

  setupEventListeners() {
    this.socket.on('connect', () => {
      console.log('Socket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    // Group events
    this.socket.on('group:memberAdded', (data) => {
      this.notifyListeners('group:memberAdded', data);
    });

    this.socket.on('group:memberRemoved', (data) => {
      this.notifyListeners('group:memberRemoved', data);
    });

    this.socket.on('group:updated', (data) => {
      this.notifyListeners('group:updated', data);
    });
  }

  addListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  removeListener(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  notifyListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => callback(data));
    }
  }

  joinGroup(groupId) {
    if (this.socket) {
      this.socket.emit('group:join', { groupId });
    }
  }

  leaveGroup(groupId) {
    if (this.socket) {
      this.socket.emit('group:leave', { groupId });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService(); 