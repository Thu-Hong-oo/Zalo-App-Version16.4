const Call = require('./videoCall.model');
const redisClient = require('../../config/redis');
const { v4: uuidv4 } = require('uuid');

const videoCallService = {
  // Tạo cuộc gọi mới
  createCall: async (callerId, receiverId, type = 'video') => {
    try {
      const call = new Call({
        callerId,
        receiverId,
        type,
        status: 'pending',
        startTime: new Date(),
        participants: [callerId, receiverId]
      });

      await call.save();
      return call;
    } catch (error) {
      throw new Error('Failed to create call: ' + error.message);
    }
  },

  // Cập nhật trạng thái cuộc gọi
  updateCallStatus: async (callId, status) => {
    try {
      const call = await Call.findById(callId);
      if (!call) {
        throw new Error('Call not found');
      }

      call.status = status;
      if (status === 'active') {
        call.startTime = new Date();
      } else if (status === 'ended') {
        call.endTime = new Date();
      }

      await call.save();
      return call;
    } catch (error) {
      throw new Error('Failed to update call status: ' + error.message);
    }
  },

  // Kết thúc cuộc gọi
  endCall: async (callId) => {
    try {
      const call = await Call.findById(callId);
      if (!call) {
        throw new Error('Call not found');
      }

      call.status = 'ended';
      call.endTime = new Date();
      await call.save();
      return call;
    } catch (error) {
      throw new Error('Failed to end call: ' + error.message);
    }
  },

  // Lấy danh sách cuộc gọi của user
  getUserCalls: async (userId) => {
    try {
      const calls = await Call.find({
        participants: userId
      }).sort({ startTime: -1 });
      return calls;
    } catch (error) {
      throw new Error('Failed to get user calls: ' + error.message);
    }
  },

  // Lấy danh sách cuộc gọi đang active
  getActiveCalls: async (userId) => {
    try {
      const calls = await Call.find({
        participants: userId,
        status: 'active'
      });
      return calls;
    } catch (error) {
      throw new Error('Failed to get active calls: ' + error.message);
    }
  },

  // Lấy thông tin chi tiết cuộc gọi
  getCall: async (callId) => {
    try {
      const call = await Call.findById(callId);
      return call;
    } catch (error) {
      throw new Error('Failed to get call details: ' + error.message);
    }
  }
};

module.exports = videoCallService; 