const videoCallModel = require('./videoCall.model');
const redisClient = require('../../config/redis');
const { v4: uuidv4 } = require('uuid');

class VideoCallService {
  // Tạo cuộc gọi mới
  async createCall(callerId, receiverId, type = 'video') {
    const callId = uuidv4();
    const call = {
      callId,
      callerId,
      receiverId,
      type,
      status: 'pending',
      startTime: new Date().toISOString(),
      participants: [callerId, receiverId],
      metadata: {}
    };

    // Lưu vào Redis với TTL 5 phút
    await redisClient.set(`call:${callId}`, JSON.stringify(call), 'EX', 300);
    
    // Lưu vào DynamoDB
    await videoCallModel.create(call);
    
    return call;
  }

  // Cập nhật trạng thái cuộc gọi
  async updateCallStatus(callId, status) {
    const call = await this.getCall(callId);
    if (!call) {
      throw new Error('Call not found');
    }

    const updateData = {
      status,
      updatedAt: new Date().toISOString()
    };

    // Nếu cuộc gọi kết thúc, tính thời gian
    if (['ended', 'missed', 'rejected'].includes(status)) {
      const startTime = new Date(call.startTime);
      const endTime = new Date();
      const callDuration = Math.floor((endTime - startTime) / 1000); // Convert to seconds
      
      updateData.endTime = endTime.toISOString();
      updateData.callDuration = callDuration; // Đổi tên từ duration thành callDuration
    }

    // Cập nhật Redis
    const updatedCall = { ...call, ...updateData };
    if (['ended', 'missed', 'rejected'].includes(status)) {
      await redisClient.del(`call:${callId}`);
    } else {
      await redisClient.set(`call:${callId}`, JSON.stringify(updatedCall), 'EX', 300);
    }

    // Cập nhật DynamoDB
    await videoCallModel.update(callId, updateData);

    return updatedCall;
  }

  // Lấy thông tin cuộc gọi
  async getCall(callId) {
    // Thử lấy từ Redis trước
    const cachedCall = await redisClient.get(`call:${callId}`);
    if (cachedCall) {
      return JSON.parse(cachedCall);
    }

    // Nếu không có trong Redis, lấy từ DynamoDB
    const call = await videoCallModel.getById(callId);
    if (call) {
      // Cache lại vào Redis
      await redisClient.set(`call:${callId}`, JSON.stringify(call), 'EX', 300);
    }

    return call;
  }

  // Kết thúc cuộc gọi
  async endCall(callId) {
    return await this.updateCallStatus(callId, 'ended');
  }

  // Lấy danh sách cuộc gọi của user
  async getUserCalls(userId, options = {}) {
    return await videoCallModel.getByUserId(userId, options);
  }

  // Lấy danh sách cuộc gọi đang active của user
  async getActiveCalls(userId) {
    return await videoCallModel.getActiveCalls(userId);
  }
}

module.exports = new VideoCallService(); 