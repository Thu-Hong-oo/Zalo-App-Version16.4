import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getGroupDetails, sendGroupMessage } from '../services/group';
import './css/GroupChat.css';

const GroupChat = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [groupDetails, setGroupDetails] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchGroupDetails();
  }, [groupId]);

  const fetchGroupDetails = async () => {
    try {
      console.log(`Fetching group details for group ID: ${groupId}`);
      const response = await getGroupDetails(groupId);
      console.log('Group details response:', response);
      
      if (response.status === 'success') {
        setGroupDetails(response.data);
        setLoading(false);
      } else {
        throw new Error('Không nhận được dữ liệu từ server');
      }
    } catch (err) {
      console.error('Error fetching group details:', err);
      setError('Không thể tải thông tin nhóm. Vui lòng thử lại sau.');
      setLoading(false);
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const sendMessage = async () => {
    if (!message.trim()) return;

    try {
      console.log(`Sending message to group ${groupId}: ${message}`);
      const response = await sendGroupMessage(groupId, message);
      
      if (response.status === 'success') {
        setMessages(prevMessages => [...prevMessages, response.data]);
        setMessage('');
      } else {
        throw new Error('Không nhận được dữ liệu từ server');
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Không thể gửi tin nhắn. Vui lòng thử lại sau.');
    }
  };

  const handleBack = () => {
    navigate('/app');
  };

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error">{error}</div>
        <button className="retry-button" onClick={fetchGroupDetails}>
          Thử lại
        </button>
        <button className="back-button" onClick={handleBack}>
          Quay lại
        </button>
      </div>
    );
  }

  return (
    <div className="group-chat-container">
      <header className="group-chat-header">
        <button className="back-button" onClick={handleBack}>
          ←
        </button>
        <div className="header-title">
          <h1>{groupDetails?.name || 'Nhóm chat'}</h1>
          <p>{groupDetails?.memberCount || groupDetails?.members?.length || 0} thành viên</p>
        </div>
      </header>

      <div className="messages-container">
        <div className="group-info-card">
          <div className="group-avatars">
            <img 
              src={groupDetails?.avatar || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'} 
              alt="Group Avatar"
              className="group-main-avatar"
            />
          </div>
          <h2 className="group-card-title">{groupDetails?.name || 'Nhóm chat'}</h2>
          <p className="group-card-subtitle">
            Bắt đầu chia sẻ những câu chuyện thú vị cùng nhau
          </p>
        </div>

        <div className="time-indicator">
          <span className="time-text">
            {formatTime(groupDetails?.createdAt)}
          </span>
        </div>

        {messages.map(msg => (
          <div key={msg.id} className="system-message-container">
            <div className="system-message-avatars">
              {msg.memberAvatars?.map((avatarUri, index) => (
                <img 
                  key={`sys-avatar-${index}`}
                  src={avatarUri}
                  alt={`Member ${index + 1}`}
                  className="system-message-avatar"
                />
              ))}
            </div>
            <p className="system-message-text">
              <strong>{msg.memberNames}</strong> đã tham gia nhóm
            </p>
          </div>
        ))}

        <div className="setup-card">
          <div className="setup-avatar-container">
            <div className="setup-avatar">
              <i className="camera-icon">📷</i>
            </div>
            <span className="setup-title">{groupDetails?.name || 'Nhóm chat'}</span>
            <i className="chevron-icon">›</i>
          </div>

          <p className="setup-subtitle">Bạn vừa tạo nhóm</p>
          
          <div className="member-avatars">
            {groupDetails?.members?.map((member, index) => (
              <img 
                key={`setup-avatar-${member.userId || index}`}
                src={member.avatar || 'https://via.placeholder.com/50'}
                alt={`Member ${index + 1}`}
                className="member-avatar"
                style={{ zIndex: (groupDetails.members?.length || 0) - index }}
              />
            ))}
            <button className="add-member-button">
              <i className="person-add-icon">+</i>
            </button>
          </div>

          <button className="wave-button">
            👋 Vẫy tay chào
          </button>

          <button className="qr-button">
            Xem mã QR tham gia nhóm
          </button>
        </div>
      </div>

      <div className="input-container">
        <button className="emoji-button">😊</button>
        <input
          type="text"
          className="message-input"
          placeholder="Tin nhắn"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button className="attach-button">
          <i className="mic-icon">🎤</i>
        </button>
        <button className="attach-button">
          <i className="image-icon">🖼️</i>
        </button>
      </div>
    </div>
  );
};

export default GroupChat; 