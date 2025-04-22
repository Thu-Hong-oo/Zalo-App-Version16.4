import React from 'react';
import { ChevronLeft, MoreVertical, UserPlus, Crown } from 'lucide-react';
import './css/GroupMembers.css';

const GroupMembers = ({ members = [], onClose, onAddMember, groupId }) => {
  const currentUser = JSON.parse(localStorage.getItem('user'));
  const isAdmin = members.find(m => m.userId === currentUser?.id)?.role === 'ADMIN';

  return (
    <div className="group-members">
      <div className="members-header">
        <button className="back-button" onClick={onClose}>
          <ChevronLeft size={24} />
        </button>
        <h1>Thành viên</h1>
      </div>

      <button className="add-member-button" onClick={onAddMember}>
        <UserPlus size={20} />
        <span>Thêm thành viên</span>
      </button>

      <div className="members-section">
        <div className="section-header">
          <h2>Danh sách thành viên ({members.length})</h2>
          <button className="more-button">
            <MoreVertical size={20} />
          </button>
        </div>

        <div className="members-list">
          {members.map((member) => (
            <div key={member.userId} className="member-item">
              <div className="member-avatar">
                <img 
                  src={member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name || '')}&background=random&color=fff&size=48`}
                  alt={member.name}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name || '')}&background=random&color=fff&size=48`;
                  }}
                />
              </div>
              <div className="member-info">
                <div className="member-name">
                  {member.name}
                  {member.role === 'ADMIN' && (
                    <span className="admin-badge">
                      <Crown size={14} />
                      Trưởng nhóm
                    </span>
                  )}
                  {member.userId === currentUser?.id && (
                    <span className="you-badge">Bạn</span>
                  )}
                </div>
              </div>
              {!member.isFriend && member.userId !== currentUser?.id && (
                <button className="add-friend-button">
                  Kết bạn
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GroupMembers; 