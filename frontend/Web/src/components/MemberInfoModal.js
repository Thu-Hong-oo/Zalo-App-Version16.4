import React from 'react';
import './css/MemberInfoModal.css';

const MemberInfoModal = ({ member, commonGroups, onClose, onMessage, currentUserId }) => {
  if (!member) return null;

  const isMe = member.userId === currentUserId;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="member-info-modal" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>×</button>
        <div className="avatar-section">
          <img
            src={member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=random`}
            alt={member.name}
            className="member-avatar"
          />
        </div>
        <h2 className="member-name">{member.name}</h2>
        <div className="common-groups">
          <span>Nhóm chung: </span>
          <b>{commonGroups}</b>
        </div>
        {!isMe && (
          <button className="message-btn" onClick={() => onMessage(member)}>
            Nhắn tin
          </button>
        )}
      </div>
    </div>
  );
};

export default MemberInfoModal; 