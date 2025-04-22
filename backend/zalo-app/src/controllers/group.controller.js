// Thêm hàm xử lý cập nhật avatar
const updateGroupAvatar = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.userId;

    // Log để debug
    console.log('Update group avatar request:', {
      groupId,
      userId,
      file: req.file,
      body: req.body
    });

    // Kiểm tra file upload
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'Không tìm thấy file avatar'
      });
    }

    // Kiểm tra quyền (phải là admin của nhóm)
    const group = await groupService.getGroupById(groupId);
    if (!group) {
      return res.status(404).json({
        status: 'error',
        message: 'Không tìm thấy nhóm'
      });
    }

    const member = group.members.find(m => m.userId.toString() === userId);
    if (!member || member.role !== 'ADMIN') {
      return res.status(403).json({
        status: 'error',
        message: 'Bạn không có quyền cập nhật avatar nhóm'
      });
    }

    // Lấy đường dẫn file đã upload
    const avatarUrl = `/uploads/groups/avatars/${req.file.filename}`;
    console.log('Avatar URL:', avatarUrl);

    // Cập nhật URL avatar vào database
    const updatedGroup = await groupService.updateGroupAvatar(groupId, avatarUrl);
    console.log('Updated group:', updatedGroup);

    // Gửi thông báo qua socket cho các thành viên trong nhóm
    const io = req.app.get('io');
    if (io) {
      io.to(`group:${groupId}`).emit('group:updated', {
        groupId,
        type: 'AVATAR_UPDATED',
        data: { avatarUrl }
      });
    }

    res.json({
      status: 'success',
      message: 'Cập nhật avatar thành công',
      data: updatedGroup
    });

  } catch (error) {
    console.error('Error in updateGroupAvatar:', error);
    res.status(500).json({
      status: 'error',
      message: 'Lỗi khi cập nhật avatar nhóm',
      error: error.message
    });
  }
};

module.exports = {
  // ... existing exports ...
  updateGroupAvatar
}; 