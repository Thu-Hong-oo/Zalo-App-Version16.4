const Group = require('../models/group.model');

// Thêm hàm service cập nhật avatar
const updateGroupAvatar = async (groupId, avatarUrl) => {
  try {
    console.log('Updating group avatar:', { groupId, avatarUrl });
    
    const group = await Group.findByIdAndUpdate(
      groupId,
      { $set: { avatar: avatarUrl } },
      { 
        new: true,
        runValidators: true
      }
    ).populate('members.userId', 'name avatar phone status');

    if (!group) {
      throw new Error('Không tìm thấy nhóm');
    }

    console.log('Group updated successfully:', group);
    return group;
  } catch (error) {
    console.error('Error in updateGroupAvatar service:', error);
    throw error;
  }
};

module.exports = {
  updateGroupAvatar
}; 