const express = require('express');
const router = express.Router();
const videoCallController = require('./videoCall.controller');
const authMiddleware = require('../../middleware/auth');

// Tất cả các route đều yêu cầu authentication
router.use(authMiddleware);

// Tạo cuộc gọi mới
router.post('/', videoCallController.createCall);

// Cập nhật trạng thái cuộc gọi
router.put('/:callId/status', videoCallController.updateCallStatus);

// Kết thúc cuộc gọi
router.delete('/:callId', videoCallController.endCall);

// Lấy danh sách cuộc gọi của user
router.get('/user', videoCallController.getUserCalls);

// Lấy danh sách cuộc gọi đang active
router.get('/active', videoCallController.getActiveCalls);

// Lấy thông tin chi tiết cuộc gọi
router.get('/:callId', videoCallController.getCallDetails);

module.exports = router; 