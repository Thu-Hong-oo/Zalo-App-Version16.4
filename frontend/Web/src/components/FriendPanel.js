import React, { useState } from 'react';
import './css/FriendPanel.css';
import FriendList from './FriendList';
import FriendRequests from './FriendRequests';// 👈 Nhớ tạo file này như mình đã gửi

import {
  Users,
  UserPlus,
  UserCheck,
  UserCog
} from 'lucide-react';

const FriendPanel = () => {
  const [activeTab, setActiveTab] = useState("friends"); // friends | requests | groups | invites

  return (
    <div className="friend-panel-layout">
      {/* Cột trái */}
      <div className="friend-panel-sidebar">
        <div
          className={`friend-panel-option ${activeTab === 'friends' ? 'active' : ''}`}
          onClick={() => setActiveTab('friends')}
        >
          <Users size={18} />
          <span>Danh sách bạn bè</span>
        </div>

        <div
          className={`friend-panel-option ${activeTab === 'groups' ? 'active' : ''}`}
          onClick={() => setActiveTab('groups')}
        >
          <UserCog size={18} />
          <span>Danh sách nhóm và cộng đồng</span>
        </div>

        <div
          className={`friend-panel-option ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          <UserPlus size={18} />
          <span>Lời mời kết bạn</span>
        </div>

        <div
          className={`friend-panel-option ${activeTab === 'invites' ? 'active' : ''}`}
          onClick={() => setActiveTab('invites')}
        >
          <UserCheck size={18} />
          <span>Lời mời vào nhóm và cộng đồng</span>
        </div>
      </div>

      {/* Cột phải */}
      <div className="friend-panel-content">
        {activeTab === 'friends' && <FriendList />}
        {activeTab === 'requests' && <FriendRequests />}
        {activeTab === 'groups' && <div>Danh sách nhóm (đang phát triển)</div>}
        {activeTab === 'invites' && <div>Lời mời vào nhóm (đang phát triển)</div>}
      </div>
    </div>
  );
};

export default FriendPanel;
