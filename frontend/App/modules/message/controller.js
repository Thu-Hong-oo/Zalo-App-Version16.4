import api from '../../config/api';
import { API_URL } from '../../config/api';

const messageService = {
  // Gửi tin nhắn văn bản
  sendMessage: async (from, to, content) => {
    try {
      const response = await api.post('/message/send', {
        from,
        to,
        content
      });
      return response.data;
    } catch (error) {
      console.error('Send message error:', error);
      throw error;
    }
  },

  // Gửi file
  sendFile: async (from, to, files) => {
    try {
      const formData = new FormData();
      formData.append('from', from);
      formData.append('to', to);
      files.forEach(file => {
        formData.append('files', file);
      });

      const response = await api.post('/message/send-file', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Lấy lịch sử chat
  getMessages: async (chatId, lastMessageId = null, limit = 20) => {
    try {
      const response = await api.get(`/message/${chatId}`, {
        params: { lastMessageId, limit }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Lấy tin nhắn chưa đọc
  getUnreadMessages: async (userId) => {
    try {
      const response = await api.get('/message/unread', {
        params: { userId }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Lấy số tin nhắn chưa đọc
  getUnreadCount: async (userId) => {
    try {
      const response = await api.get('/message/unread/count', {
        params: { userId }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Đánh dấu đã đọc
  markAsRead: async (chatId, messageIds, userId) => {
    try {
      const response = await api.post('/message/read', {
        chatId,
        messageIds,
        userId
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Thu hồi tin nhắn
  recallMessage: async (chatId, messageId, userId) => {
    try {
      const response = await api.post('/message/recall', {
        chatId,
        messageId,
        userId
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Xóa cuộc trò chuyện
  deleteConversation: async (chatId, userId) => {
    try {
      const response = await api.post('/message/delete', {
        chatId,
        userId
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Chặn người dùng
  blockUser: async (userId, blockedUserId) => {
    try {
      const response = await api.post('/message/block', {
        userId,
        blockedUserId
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Tìm kiếm tin nhắn
  searchMessages: async (userId, keyword, type, startTime, endTime) => {
    try {
      const response = await api.get('/message/search', {
        params: { userId, keyword, type, startTime, endTime }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  }
};

export default messageService; 