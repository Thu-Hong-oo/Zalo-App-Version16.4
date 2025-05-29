// src/modules/friend/routes.js
const express          = require("express");
const router           = express.Router();
const friendController = require("./controller");

/* ───── Lời mời kết bạn ───── */
router.post ("/request",          friendController.sendFriendRequest);
router.get  ("/request/sent/:userId",
                                 friendController.getSentRequests);
router.get  ("/request/received/:userId",
                                 friendController.getReceivedRequests);

router.get  ("/check-status",      friendController.checkFriendRequestStatus);

router.post ("/request/accept",   friendController.acceptFriendRequest);
router.post ("/request/reject",   friendController.rejectFriendRequest);
router.post ("/request/cancel",   friendController.cancelFriendRequest);


/* ───── Danh sách bạn / Xóa bạn ───── */
router.get  ("/list/:userId",     friendController.getFriendsList);
router.post ("/delete",           friendController.deleteFriend);

/* friend list */
router.get ("/:userId",                      friendController.getFriends);

/* request status */
router.get ("/friends/request/status",       friendController.checkStatus);

module.exports = router;
