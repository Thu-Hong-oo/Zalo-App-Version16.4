import React, { useState, useEffect } from 'react';
import './css/ForwardMessageModal.css';
import api from '../config/api';

const ForwardMessageModal = ({ isOpen, onClose, onForward, messageContent, userId }) => {
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [activeTab, setActiveTab] = useState('recent');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchContactsAndGroups();
    }
    // eslint-disable-next-line
  }, [isOpen, activeTab]);

  const fetchUserInfo = async (phone) => {
    try {
      const res = await api.get(`/users/${phone}`);
      if (res.data) return res.data;
    } catch (e) {
      return {};
    }
  };

  const fetchContactsAndGroups = async () => {
    setLoading(true);
    try {
      // Fetch contacts (recent or all friends)
      let contactsRes = [];
      if (activeTab === 'recent') {
        const res = await api.get('/chat/conversations');
        if (res.data.status === 'success' && res.data.data?.conversations) {
          contactsRes = await Promise.all(
            res.data.data.conversations.map(async (conv) => {
              const other = conv.participant.isCurrentUser ? conv.otherParticipant : conv.participant;
              // Fetch thêm info nếu thiếu
              let name = other.name, avatar = other.avatar;
              if (!name || !avatar) {
                const userInfo = await fetchUserInfo(other.phone);
                name = userInfo.name || other.phone;
                avatar = userInfo.avatar;
              }
              return {
                id: other.phone,
                name,
                avatar,
                type: 'contact',
                phone: other.phone
              };
            })
          );
        }
      } else {
        // Lấy danh bạ bạn bè
        const res = await api.get('/users/friends');
        if (res.data && Array.isArray(res.data)) {
          contactsRes = await Promise.all(res.data.map(async friend => {
            let name = friend.name, avatar = friend.avatar;
            if (!name || !avatar) {
              const userInfo = await fetchUserInfo(friend.phone);
              name = userInfo.name || friend.phone;
              avatar = userInfo.avatar;
            }
            return {
              id: friend.phone,
              name,
              avatar,
              type: 'contact',
              phone: friend.phone
            };
          }));
        }
      }
      setContacts(contactsRes);
      // Fetch groups
      if (userId) {
        const groupRes = await api.get(`/users/${userId}/groups`);
        if (groupRes.data && groupRes.data.groups) {
          setGroups(groupRes.data.groups.map(group => ({
            id: group.groupId,
            name: group.name,
            avatar: group.avatar,
            type: 'group',
            memberCount: group.memberCount
          })));
        } else {
          setGroups([]);
        }
      }
    } catch (err) {
      setContacts([]);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (item) => {
    setSelectedItems(prev => {
      const exists = prev.some(i => i.id === item.id && i.type === item.type);
      if (exists) {
        return prev.filter(i => !(i.id === item.id && i.type === item.type));
      }
      return [...prev, item];
    });
  };

  const handleForward = () => {
    onForward(selectedItems);
    setSelectedItems([]);
    onClose();
  };

  // Filter
  const filteredContacts = contacts.filter(contact =>
    contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.phone?.includes(searchTerm)
  );
  const filteredGroups = groups.filter(group =>
    group.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="forward-modal" style={{ width: 500, borderRadius: 12, overflow: 'hidden', background: '#fff', boxShadow: '0 2px 16px rgba(0,0,0,0.15)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '18px 20px 10px 20px', borderBottom: 'none' }}>
          <div style={{ fontWeight: 700, fontSize: 22, flex: 1, color: '#18191A' }}>Chuyển tiếp tin nhắn</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 26, color: '#222', cursor: 'pointer', fontWeight: 400, marginLeft: 8 }}>&times;</button>
        </div>
        {/* Search */}
        <div style={{ padding: '0 20px 8px 20px' }}>
          <input
            type="text"
            placeholder="Tìm kiếm liên hệ hoặc nhóm..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', border: '1px solid #E6E8EB', borderRadius: 8, padding: '10px 14px', fontSize: 15, outline: 'none', marginBottom: 0, background: '#F5F6FA' }}
          />
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1.5px solid #E6E8EB', margin: '0 0 0 0', padding: '0 20px' }}>
          <button
            className={activeTab === 'recent' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('recent')}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              fontWeight: 600,
              fontSize: 15,
              color: activeTab === 'recent' ? '#0084FF' : '#A0A4AB',
              borderBottom: activeTab === 'recent' ? '2.5px solid #0084FF' : '2.5px solid transparent',
              padding: '10px 0',
              cursor: 'pointer',
              outline: 'none',
              transition: 'color 0.2s'
            }}
          >
            GẦN ĐÂY
          </button>
          <button
            className={activeTab === 'contacts' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('contacts')}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              fontWeight: 600,
              fontSize: 15,
              color: activeTab === 'contacts' ? '#0084FF' : '#A0A4AB',
              borderBottom: activeTab === 'contacts' ? '2.5px solid #0084FF' : '2.5px solid transparent',
              padding: '10px 0',
              cursor: 'pointer',
              outline: 'none',
              transition: 'color 0.2s'
            }}
          >
            DANH BẠ
          </button>
        </div>
        {/* Preview nội dung tin nhắn */}
        <div style={{ padding: '16px 20px 0 20px' }}>
          <div style={{ fontSize: 14, color: '#7589A3', marginBottom: 8 }}>Nội dung tin nhắn:</div>
          {(() => {
            if (typeof messageContent === 'string' && messageContent.match(/\.(jpg|jpeg|png|gif)$/i)) {
              return (
                <img src={messageContent} alt="preview" style={{ width: 120, height: 120, borderRadius: 8, marginBottom: 8, objectFit: 'cover', boxShadow: '0 2px 8px #eee' }} />
              );
            }
            if (typeof messageContent === 'string' && messageContent.match(/\.(mp4|mov|avi)$/i)) {
              return (
                <video src={messageContent} controls style={{ width: 120, height: 120, borderRadius: 8, marginBottom: 8, background: '#eee', boxShadow: '0 2px 8px #eee' }} />
              );
            }
            if (typeof messageContent === 'string' && messageContent.startsWith('http') && messageContent.match(/\.(pdf|docx?|xlsx?|pptx?|zip|rar)$/i)) {
              return (
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, background: '#f5f5f5', borderRadius: 6, padding: 10 }}>
                  <span style={{ fontSize: 24, marginRight: 8 }}>📄</span>
                  <a href={messageContent} target="_blank" rel="noopener noreferrer" style={{ color: '#2196F3', textDecoration: 'underline', fontWeight: 500 }}>{messageContent.split('/').pop()}</a>
                </div>
              );
            }
            if (typeof messageContent === 'string' && messageContent.startsWith('http')) {
              return (
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, background: '#f5f5f5', borderRadius: 6, padding: 10 }}>
                  <span style={{ fontSize: 20, marginRight: 8 }}>🔗</span>
                  <a href={messageContent} target="_blank" rel="noopener noreferrer" style={{ color: '#2196F3', textDecoration: 'underline', fontWeight: 500 }}>{messageContent}</a>
                </div>
              );
            }
            return (
              <div style={{ background: '#f5f5f5', borderRadius: 6, padding: 10, color: '#333', fontSize: 16 }}>
                {messageContent}
              </div>
            );
          })()}
        </div>
        {/* Danh sách liên hệ và nhóm */}
        <div className="chat-items" style={{ maxHeight: 340, overflowY: 'auto', padding: '0 0 0 0', margin: '0 0 0 0' }}>
          {loading ? <div style={{ padding: 20 }}>Đang tải...</div> : (
            <>
              {/* Liên hệ */}
              {filteredContacts.length > 0 && (
                <>
                  {filteredContacts.map(contact => (
                    <div
                      key={contact.id}
                      className={`chat-item ${selectedItems.some(i => i.id === contact.id && i.type === 'contact') ? 'active' : ''}`}
                      onClick={() => handleSelect(contact)}
                      style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', cursor: 'pointer', background: selectedItems.some(i => i.id === contact.id && i.type === 'contact') ? '#e7f3ff' : 'transparent', border: 'none', borderBottom: 'none' }}
                    >
                      <div style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', background: '#e4e6eb', marginRight: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {contact.avatar ? (
                          <img src={contact.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontWeight: 600, color: '#65676b', fontSize: 16 }}>{contact.name.slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <div style={{ flex: 1, fontWeight: 600, color: '#18191A', fontSize: 16 }}>{contact.name}</div>
                      {selectedItems.some(i => i.id === contact.id && i.type === 'contact') && (
                        <span style={{ color: '#0084ff', fontSize: 22, marginLeft: 8 }}>✓</span>
                      )}
                    </div>
                  ))}
                </>
              )}
              {/* Nhóm */}
              {filteredGroups.length > 0 && (
                <>
                  <div style={{ background: '#f5f5f5', fontWeight: 700, color: '#18191A', fontSize: 15, padding: '8px 20px 8px 20px', marginTop: 2 }}>Nhóm</div>
                  {filteredGroups.map(group => (
                    <div
                      key={group.id}
                      className={`chat-item ${selectedItems.some(i => i.id === group.id && i.type === 'group') ? 'active' : ''}`}
                      onClick={() => handleSelect(group)}
                      style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', cursor: 'pointer', background: selectedItems.some(i => i.id === group.id && i.type === 'group') ? '#e7f3ff' : 'transparent', border: 'none', borderBottom: 'none' }}
                    >
                      <div style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', background: '#e4e6eb', marginRight: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {group.avatar ? (
                          <img src={group.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontWeight: 600, color: '#65676b', fontSize: 16 }}>{group.name.slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: '#18191A', fontSize: 16 }}>{group.name}</div>
                        <div style={{ fontSize: 13, color: '#7589A3', fontWeight: 400 }}>{group.memberCount} thành viên</div>
                      </div>
                      {selectedItems.some(i => i.id === group.id && i.type === 'group') && (
                        <span style={{ color: '#0084ff', fontSize: 22, marginLeft: 8 }}>✓</span>
                      )}
                    </div>
                  ))}
                </>
              )}
              {filteredContacts.length === 0 && filteredGroups.length === 0 && (
                <div style={{ color: '#666', padding: 20, textAlign: 'center' }}>Không tìm thấy kết quả phù hợp</div>
              )}
            </>
          )}
        </div>
        {/* Footer */}
        <div style={{ display: 'flex', gap: 12, padding: '18px 20px 18px 20px', background: '#fff', borderTop: '1.5px solid #E6E8EB' }}>
          <button
            onClick={onClose}
            style={{ flex: 1, background: '#F0F2F5', color: '#18191A', fontWeight: 700, fontSize: 16, border: 'none', borderRadius: 8, padding: '13px 0', cursor: 'pointer' }}
          >
            Hủy
          </button>
          <button
            onClick={handleForward}
            style={{ flex: 1, background: selectedItems.length === 0 ? '#E4E6EB' : '#0084FF', color: selectedItems.length === 0 ? '#A0A4AB' : '#fff', fontWeight: 700, fontSize: 16, border: 'none', borderRadius: 8, padding: '13px 0', cursor: selectedItems.length === 0 ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}
            disabled={selectedItems.length === 0}
          >
            Chuyển tiếp ({selectedItems.length})
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForwardMessageModal; 