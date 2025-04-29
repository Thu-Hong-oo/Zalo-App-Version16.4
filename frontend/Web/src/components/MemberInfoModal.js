import React from 'react';
import { Users } from 'lucide-react';
import './css/MemberInfoModal.css';

const MemberInfoModal = ({ member, commonGroups, onClose, onMessage, currentUserId, isFriend, onAddFriend }) => {
  if (!member) return null;
  const isMe = member.userId === currentUserId;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="member-info-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <span>Thông tin tài khoản</span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        {/* Avatar, tên, nút */}
        <div className="profile-header no-cover">
          <img className="avatar-member-infor" src={member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=random`} alt={member.name} />
          <div className="profile-name">{member.name}</div>
          <div className="profile-actions">
            {!isMe && !isFriend && (
              <button className="add-friend-btn" onClick={() => onAddFriend && onAddFriend(member.userId)}>
                Kết bạn
              </button>
            )}
            {!isMe && (
              <button className="message-btn" onClick={() => onMessage(member)}>
                Nhắn tin
              </button>
            )}
          </div>
        </div>
        {/* Thông tin cá nhân */}
        <div className="profile-info">
          <div className="info-title">Thông tin cá nhân</div>
          <div className="info-row">
            <span>Giới tính</span>
            <span>{member.gender || '--'}</span>
          </div>
          <div className="info-row">
            <span>Ngày sinh</span>
            <span>{member.dateOfBirth || '--/--/----'}</span>
          </div>
        </div>
        {/* Nhóm chung */}
        <div className="common-groups">
          <Users size={16} style={{ marginRight: 4 }} />
          Nhóm chung ({commonGroups || 0})
        </div>
      </div>
    </div>
  );
};

export default MemberInfoModal; 