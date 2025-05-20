const videoCallService = require('./videoCall.service');

const videoCallController = {
  // Tạo cuộc gọi mới
  createCall: async (req, res) => {
    try {
      const { receiverId, type } = req.body;
      const callerId = req.user.userId;

      const call = await videoCallService.createCall(callerId, receiverId, type);
      res.json({
        status: 'success',
        data: call
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  },

  // Cập nhật trạng thái cuộc gọi
  updateCallStatus: async (req, res) => {
    try {
      const { callId } = req.params;
      const { status } = req.body;

      const call = await videoCallService.updateCallStatus(callId, status);
      if (!call) {
        return res.status(404).json({
          status: 'error',
          message: 'Call not found'
        });
      }

      res.json({
        status: 'success',
        data: call
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  },

  // Kết thúc cuộc gọi
  endCall: async (req, res) => {
    try {
      const { callId } = req.params;
      const call = await videoCallService.endCall(callId);
      
      if (!call) {
        return res.status(404).json({
          status: 'error',
          message: 'Call not found'
        });
      }

      res.json({
        status: 'success',
        data: call
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  },

  // Lấy danh sách cuộc gọi của user
  getUserCalls: async (req, res) => {
    try {
      const userId = req.user.userId;
      const calls = await videoCallService.getUserCalls(userId);
      
      res.json({
        status: 'success',
        data: calls
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  },

  // Lấy danh sách cuộc gọi đang active
  getActiveCalls: async (req, res) => {
    try {
      const userId = req.user.userId;
      const calls = await videoCallService.getActiveCalls(userId);
      
      res.json({
        status: 'success',
        data: calls
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  },

  // Lấy thông tin chi tiết cuộc gọi
  getCallDetails: async (req, res) => {
    try {
      const { callId } = req.params;
      const call = await videoCallService.getCall(callId);
      
      if (!call) {
        return res.status(404).json({
          status: 'error',
          message: 'Call not found'
        });
      }

      res.json({
        status: 'success',
        data: call
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  }
};

module.exports = videoCallController; 