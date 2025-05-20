// In-memory storage for active calls
const activeCalls = new Map();

const videoCallService = {
  createCall: async (callerId, receiverPhone, type) => {
    try {
      const call = {
        id: Date.now().toString(),
        callerId,
        receiverPhone,
        type: type || 'video',
        status: 'pending',
        startTime: new Date(),
        endTime: null
      };
      
      activeCalls.set(call.id, call);
      return call;
    } catch (error) {
      console.error('Error creating video call:', error);
      throw new Error('Failed to create video call');
    }
  },

  updateCallStatus: async (callId, status) => {
    try {
      const call = activeCalls.get(callId);
      if (!call) {
        throw new Error('Call not found');
      }

      call.status = status;
      if (status === 'active') {
        call.startTime = new Date();
      }
      
      activeCalls.set(callId, call);
      return call;
    } catch (error) {
      console.error('Error updating call status:', error);
      throw new Error('Failed to update call status');
    }
  },

  endCall: async (callId) => {
    try {
      const call = activeCalls.get(callId);
      if (!call) {
        throw new Error('Call not found');
      }

      call.status = 'ended';
      call.endTime = new Date();
      
      // Remove ended call from active calls
      activeCalls.delete(callId);
      
      return call;
    } catch (error) {
      console.error('Error ending call:', error);
      throw new Error('Failed to end call');
    }
  },

  // Lấy danh sách cuộc gọi của user
  getUserCalls: async (userId) => {
    try {
      const calls = await VideoCall.find({
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
      return Array.from(activeCalls.values())
        .filter(call => call.callerId === userId || call.receiverPhone === userId);
    } catch (error) {
      console.error('Error getting active calls:', error);
      throw new Error('Failed to get active calls');
    }
  },

  // Lấy thông tin chi tiết cuộc gọi
  getCall: async (callId) => {
    try {
      const call = activeCalls.get(callId);
      if (!call) {
        throw new Error('Call not found');
      }
      return call;
    } catch (error) {
      console.error('Error getting call:', error);
      throw new Error('Failed to get call details');
    }
  }
};

module.exports = videoCallService; 