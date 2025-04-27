// const express = require('express');
// const router = express.Router();
// const multer = require('multer');
// const path = require('path');
// const { verifyToken } = require('../middlewares/auth');
// const groupController = require('../controllers/group.controller');

// // Cấu hình multer cho upload avatar
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, 'uploads/groups/avatars/'); // Đảm bảo thư mục này tồn tại
//   },
//   filename: function (req, file, cb) {
//     const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//     cb(null, `group-${req.params.groupId}-${uniqueSuffix}${path.extname(file.originalname)}`);
//   }
// });

// const fileFilter = (req, file, cb) => {
//   // Chỉ chấp nhận các file ảnh
//   if (file.mimetype.startsWith('image/')) {
//     cb(null, true);
//   } else {
//     cb(new Error('Chỉ chấp nhận file ảnh!'), false);
//   }
// };

// const upload = multer({ 
//   storage: storage,
//   fileFilter: fileFilter,
//   limits: {
//     fileSize: 5 * 1024 * 1024 // Giới hạn 5MB
//   }
// });

// // Các routes hiện có
// router.post('/', verifyToken, groupController.createGroup);
// router.get('/:groupId', verifyToken, groupController.getGroupInfo);
// router.put('/:groupId', verifyToken, groupController.updateGroupInfo);
// router.delete('/:groupId', verifyToken, groupController.dissolveGroup);

// // Route cho members
// router.get('/:groupId/members', verifyToken, groupController.getGroupMembers);
// router.post('/:groupId/members', verifyToken, groupController.addMember);
// router.delete('/:groupId/members/:userId', verifyToken, groupController.removeMember);
// router.put('/:groupId/members/:userId/role', verifyToken, groupController.updateMemberRole);

// // Thêm route cập nhật avatar
// router.put('/:groupId/avatar', 
//   verifyToken, 
//   upload.single('avatar'), 
//   groupController.updateGroupAvatar
// );

// module.exports = router; 