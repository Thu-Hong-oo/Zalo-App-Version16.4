import React, { useState, useEffect } from 'react';
import './css/ForwardMessageModal.css';
import api from '../config/api';

const ForwardMessageModal = ({ isOpen, onClose, onForward, messageContent }) => {
  const [conversations, setConversations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userCache, setUserCache] = useState({});

  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen]);

  const fetchUserInfo = async (phone) => {
    try {
      if (userCache[phone]) {
        return userCache[phone];
      }

      const response = await api.get(`/users/${phone}`);
      if (response.data) {
        setUserCache(prev => ({
          ...prev,
          [phone]: response.data
        }));
        return response.data;
      }
    } catch (error) {
      console.error('Get user info error:', error);
      return null;
    }
  };

  const loadConversations = async () => {
    try {
      const response = await api.get('/chat/conversations');
      
      if (response.data.status === 'success' && response.data.data?.conversations) {
        const newConversations = await Promise.all(
          response.data.data.conversations.map(async (conv) => {
            const otherParticipant = conv.participant.isCurrentUser
              ? conv.otherParticipant
              : conv.participant;
  
            const userInfo = await fetchUserInfo(otherParticipant.phone);
  
            return {
              id: conv.conversationId,
              title: userInfo?.name || otherParticipant.phone,
              avatar: userInfo?.avatar,
              phone: otherParticipant.phone
            };
          })
        );
  
        setConversations(newConversations);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const handleUserSelect = (phone) => {
    if (selectedUsers.includes(phone)) {
      setSelectedUsers(prev => prev.filter(p => p !== phone));
    } else {
      setSelectedUsers(prev => [...prev, phone]);
    }
  };

  const handleForward = () => {
    onForward(selectedUsers);
    setSelectedUsers([]);
    onClose();
  };

  if (!isOpen) return null;

  const filteredConversations = conversations.filter(conv => 
    conv.phone.includes(searchTerm) ||
    (conv.title && conv.title.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="modal-overlay">
      <div className="forward-modal">
        <div className="modal-header">
          <h3>Chuyển tiếp tin nhắn</h3>
          <button onClick={onClose} className="close-button">&times;</button>
        </div>

        <div className="modal-content">
          <div style={{ margin: 15, marginBottom: 0 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 6 }}>Nội dung tin nhắn:</div>
            {(() => {
              // Nếu là ảnh
              if (typeof messageContent === 'string' && messageContent.match(/\.(jpg|jpeg|png|gif)$/i)) {
                return (
                  <img src={messageContent} alt="preview" style={{ width: 120, height: 120, borderRadius: 8, marginBottom: 8, objectFit: 'cover' }} />
                );
              }
              // Nếu là video
              if (typeof messageContent === 'string' && messageContent.match(/\.(mp4|mov|avi)$/i)) {
                return (
                  <video src={messageContent} controls style={{ width: 120, height: 120, borderRadius: 8, marginBottom: 8, background: '#eee' }} />
                );
              }
              // Nếu là file (link S3 hoặc file khác)
              if (typeof messageContent === 'string' && messageContent.startsWith('http') && messageContent.match(/\.(pdf|docx?|xlsx?|pptx?|zip|rar)$/i)) {
                return (
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 24, marginRight: 8 }}>📄</span>
                    <a href={messageContent} target="_blank" rel="noopener noreferrer">{messageContent.split('/').pop()}</a>
                  </div>
                );
              }
              // Nếu là link
              if (typeof messageContent === 'string' && messageContent.startsWith('http')) {
                return (
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 20, marginRight: 8 }}>🔗</span>
                    <a href={messageContent} target="_blank" rel="noopener noreferrer" style={{ color: '#2196F3', textDecoration: 'underline' }}>{messageContent}</a>
                  </div>
                );
              }
              // Nếu là text
              return (
                <div style={{ background: '#f5f5f5', borderRadius: 6, padding: 10, color: '#333' }}>
                  {messageContent}
                </div>
              );
            })()}
          </div>

          <div className="search-box">
            <input
              type="text"
              placeholder="Tìm kiếm người nhận..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="chat-items">
            {filteredConversations.map((chat) => (
              <div
                key={chat.id}
                className={`chat-item ${selectedUsers.includes(chat.phone) ? 'active' : ''}`}
                onClick={() => handleUserSelect(chat.phone)}
                style={{ 
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  borderBottom: '1px solid #E6E8EB',
                  cursor: 'pointer',
                  backgroundColor: selectedUsers.includes(chat.phone) ? '#e7f3ff' : 'transparent'
                }}
              >
                <div style={{ position: 'relative', marginRight: '12px' }}>
                  <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '50%',
                    overflow: 'hidden',
                    backgroundColor: '#e4e6eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {chat.avatar ? (
                      <img 
                        src={chat.avatar} 
                        alt="" 
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : (
                      <div style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#65676b'
                      }}>
                        {chat.title.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '4px'
                  }}>
                    <h3 style={{ 
                      margin: 0,
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#081C36',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {chat.title}
                    </h3>
                  </div>

                  {/* <p style={{ 
                    margin: 0,
                    fontSize: '13px',
                    color: '#7589A3',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {chat.phone}
                  </p> */}
                </div>

                {selectedUsers.includes(chat.phone) && (
                  <div style={{
                    marginLeft: '8px',
                    color: '#0084ff',
                    fontSize: '20px'
                  }}>
                    ✓
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button 
            onClick={onClose} 
            className="cancel-button"
          >
            Hủy
          </button>
          <button
            onClick={handleForward}
            className="forward-button"
            disabled={selectedUsers.length === 0}
          >
            Chuyển tiếp ({selectedUsers.length})
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForwardMessageModal; 