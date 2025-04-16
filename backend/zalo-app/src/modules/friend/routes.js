const express = require('express');
const router = express.Router();
const friendController = require('./controller');

router.post('/request', friendController.sendFriendRequest);
router.get('/request/sent/:phone', friendController.getSentRequests);
router.get('/request/received/:phone', friendController.getReceivedRequests);
router.post('/request/accept', friendController.acceptFriendRequest);
router.post('/request/reject', friendController.rejectFriendRequest);
router.post('/request/cancel', friendController.cancelFriendRequest);
router.get('/list/:phone', friendController.getFriendsList);

module.exports = router; 