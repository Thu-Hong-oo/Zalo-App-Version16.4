const videoCallService = require('./videoCall.service');
const videoCallModel = require('./videoCall.model');
const redisClient = require('../../../config/redis');

// Mock Redis client
jest.mock('../../../config/redis', () => ({
  set: jest.fn(),
  get: jest.fn(),
  del: jest.fn()
}));

// Mock DynamoDB model
jest.mock('./videoCall.model', () => ({
  create: jest.fn(),
  updateStatus: jest.fn(),
  getById: jest.fn(),
  getByUserId: jest.fn(),
  getActiveCalls: jest.fn()
}));

describe('VideoCall Service', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('createCall', () => {
    const mockCallerId = 'user123';
    const mockReceiverId = 'user456';
    const mockCallData = {
      callId: expect.any(String),
      callerId: mockCallerId,
      receiverId: mockReceiverId,
      status: 'pending',
      type: 'video',
      participants: [mockCallerId, mockReceiverId],
      metadata: {
        deviceInfo: 'web',
        networkType: 'wifi',
        quality: 'high'
      }
    };

    it('should create a new call successfully', async () => {
      // Mock DynamoDB response
      videoCallModel.create.mockResolvedValue(mockCallData);
      redisClient.set.mockResolvedValue('OK');

      const result = await videoCallService.createCall(mockCallerId, mockReceiverId);

      expect(videoCallModel.create).toHaveBeenCalledWith(expect.objectContaining({
        callerId: mockCallerId,
        receiverId: mockReceiverId
      }));
      expect(redisClient.set).toHaveBeenCalled();
      expect(result).toEqual(mockCallData);
    });

    it('should handle errors when creating call', async () => {
      const error = new Error('Database error');
      videoCallModel.create.mockRejectedValue(error);

      await expect(videoCallService.createCall(mockCallerId, mockReceiverId))
        .rejects.toThrow('Database error');
    });
  });

  describe('updateCallStatus', () => {
    const mockCallId = 'call123';
    const mockStatus = 'accepted';
    const mockUpdatedCall = {
      callId: mockCallId,
      status: mockStatus
    };

    it('should update call status successfully', async () => {
      videoCallModel.updateStatus.mockResolvedValue(mockUpdatedCall);

      const result = await videoCallService.updateCallStatus(mockCallId, mockStatus);

      expect(videoCallModel.updateStatus).toHaveBeenCalledWith(mockCallId, mockStatus);
      expect(result).toEqual(mockUpdatedCall);
    });

    it('should remove from Redis when call ends', async () => {
      const mockEndedCall = { ...mockUpdatedCall, status: 'ended' };
      videoCallModel.updateStatus.mockResolvedValue(mockEndedCall);

      await videoCallService.updateCallStatus(mockCallId, 'ended');

      expect(redisClient.del).toHaveBeenCalledWith(`call:${mockCallId}`);
    });
  });

  describe('getCall', () => {
    const mockCallId = 'call123';
    const mockCall = {
      callId: mockCallId,
      status: 'pending'
    };

    it('should get call from Redis if available', async () => {
      redisClient.get.mockResolvedValue(JSON.stringify(mockCall));

      const result = await videoCallService.getCall(mockCallId);

      expect(redisClient.get).toHaveBeenCalledWith(`call:${mockCallId}`);
      expect(videoCallModel.getById).not.toHaveBeenCalled();
      expect(result).toEqual(mockCall);
    });

    it('should get call from DynamoDB if not in Redis', async () => {
      redisClient.get.mockResolvedValue(null);
      videoCallModel.getById.mockResolvedValue(mockCall);

      const result = await videoCallService.getCall(mockCallId);

      expect(videoCallModel.getById).toHaveBeenCalledWith(mockCallId);
      expect(redisClient.set).toHaveBeenCalled();
      expect(result).toEqual(mockCall);
    });
  });

  describe('getUserCalls', () => {
    const mockUserId = 'user123';
    const mockCalls = [
      { callId: 'call1', callerId: mockUserId },
      { callId: 'call2', receiverId: mockUserId }
    ];

    it('should get user calls successfully', async () => {
      videoCallModel.getByUserId.mockResolvedValue(mockCalls);

      const result = await videoCallService.getUserCalls(mockUserId);

      expect(videoCallModel.getByUserId).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(mockCalls);
    });
  });

  describe('getActiveCalls', () => {
    const mockUserId = 'user123';
    const mockActiveCalls = [
      { callId: 'call1', status: 'pending' },
      { callId: 'call2', status: 'accepted' }
    ];

    it('should get active calls successfully', async () => {
      videoCallModel.getActiveCalls.mockResolvedValue(mockActiveCalls);

      const result = await videoCallService.getActiveCalls(mockUserId);

      expect(videoCallModel.getActiveCalls).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(mockActiveCalls);
    });
  });
}); 