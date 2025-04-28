import React, { useState, useEffect, useCallback, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import './css/ChatList.css';
import api from '../config/api';
import { Search, User, Users } from 'lucide-react';
import { markAsReadGroup, getGroupMessages } from '../services/group';
import { useDispatch, useSelector } from 'react-redux';
import { setGroups, updateGroup, setSelectedGroup } from '../redux/slices/groupSlice';
import { formatDistanceToNow, format } from 'date-fns';
import vi from 'date-fns/locale/vi';
import MemberInfoModal from './MemberInfoModal';

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function ChatList({ user, setShowAddFriendModal, setShowCreateGroupModal, socket, selectedChat, setSelectedChat, groupUpdates }) {
  const [activeTab, setActiveTab] = useState("Ưu tiên");
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userCache, setUserCache] = useState({});
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [unreadCounts, setUnreadCounts] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [searchUserResult, setSearchUserResult] = useState(null);
  const [searchingUser, setSearchingUser] = useState(false);
  const [showSelfModal, setShowSelfModal] = useState(false);
  const navigate = useNavigate();
  const hasFetchedRef = useRef(false);
  const dispatch = useDispatch();

  const currentUser = user || JSON.parse(localStorage.getItem('user'));

  // Memoize formatTime function
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();

    // Nếu cùng ngày
    if (date.toDateString() === now.toDateString()) {
      let timeStr = formatDistanceToNow(date, { addSuffix: true, locale: vi });
      timeStr = timeStr.replace(/^khoảng /, '').replace(/^dưới /, '');
      return timeStr;
    }

    // Nếu hôm qua
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Hôm qua';
    }

    // Nếu trong 7 ngày: "x ngày trước"
    const diffDays = Math.floor((now - date) / (24 * 60 * 60 * 1000));
    if (diffDays < 7) {
      let timeStr = formatDistanceToNow(date, { addSuffix: true, locale: vi });
      timeStr = timeStr.replace(/^khoảng /, '').replace(/^dưới /, '');
      return timeStr;
    }

    // Nếu lâu hơn: hiển thị ngày/tháng/năm
    return format(date, 'dd/MM/yyyy');
  };

  // Memoize fetchUserInfo function
  const fetchUserInfo = useCallback(async (phone) => {
    try {
      if (userCache[phone]) {
        return userCache[phone]
      }
      const response = await api.get(`/users/${phone}`)
      if (response.data) {
        setUserCache(prev => ({
          ...prev,
          [phone]: response.data
        }))
        return response.data
      }
    } catch (error) {
      console.error("Get user info error:", error)
      return null
    }
  }, [userCache]);

  // Memoize fetchConversations function
  const fetchConversations = useCallback(async () => {
    if (!user || !socket) return;
    try {
      setLoading(true);
      const response = await api.get('/chat/conversations');
      if (response.data.status === 'success' && response.data.data?.conversations) {
        const directChats = await Promise.all(
          response.data.data.conversations.map(async (conv) => {
            try {
              const otherParticipant = conv.participant.isCurrentUser
                ? conv.otherParticipant
                : conv.participant;
              const userInfo = await fetchUserInfo(otherParticipant.phone);
              return {
                id: conv.conversationId,
                title: userInfo?.name || otherParticipant.phone,
                message: conv.lastMessage?.content || "",
                time: formatTime(conv.lastMessage?.timestamp),
                avatar: userInfo?.avatar,
                isFromMe: conv.lastMessage?.isFromMe || false,
                unreadCount: conv.unreadCount || 0,
                otherParticipantPhone: otherParticipant.phone,
                lastMessageAt: conv.lastMessage?.timestamp,
                type: 'direct',
                senderName: conv.lastMessage?.isFromMe ? 'Bạn' : (userInfo?.name || otherParticipant.phone)
              };
            } catch (error) {
              console.error("Error processing conversation:", error);
              return null;
            }
          })
        );
        // Fetch groups
        const userStr = localStorage.getItem('user');
        if (!userStr) {
          console.error('User not found in localStorage');
          return;
        }
        const userObj = JSON.parse(userStr);
        const groupsResponse = await api.get(`/users/${userObj.userId}/groups`);
        let groupChats = [];
        if (groupsResponse.data?.groups) {
          groupChats = await Promise.all(groupsResponse.data.groups.map(async group => {
            let unreadCount = 0;
            if (group.lastMessage && group.lastReadAt && new Date(group.lastMessage.timestamp) > new Date(group.lastReadAt)) {
              // Fetch messages mới hơn lastReadAt để đếm số chưa đọc
              try {
                const res = await getGroupMessages(group.groupId, { after: group.lastReadAt });
                unreadCount = Object.values(res.data.messages || {}).flat().length;
              } catch (e) {
                unreadCount = 1; // fallback nếu lỗi
              }
            }
            return {
              id: group.groupId,
              title: group.name,
              message: group.lastMessage?.content || "Chưa có tin nhắn",
              time: formatTime(group.lastMessageAt || group.createdAt),
              avatar: group.avatar,
              lastMessageAt: group.lastMessageAt || group.createdAt,
              lastMessageTimestamp: group.lastMessage?.timestamp,
              lastReadAt: group.lastReadAt,
              unreadCount,
              type: 'group',
              memberCount: group.memberCount,
              members: group.members || []
            };
          }));
        }
        const validDirectChats = directChats.filter(chat => chat !== null);
        const allChats = [...validDirectChats, ...groupChats].sort((a, b) => {
          const timeA = new Date(a.lastMessageAt || 0);
          const timeB = new Date(b.lastMessageAt || 0);
          return timeB - timeA;
        });
        setChats(allChats);
        dispatch(setGroups(groupChats));
        setError(null);
      } else {
        setError("Invalid response format from server");
      }
    } catch (err) {
      setError(err.message || "Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }, [user, socket, fetchUserInfo, formatTime, dispatch]);

  // Debounce fetchConversations
  const debouncedFetchConversations = useCallback(debounce(fetchConversations, 300), [fetchConversations]);

  // Initial fetch: chỉ chạy một lần khi user và socket đã sẵn sàng
  useEffect(() => {
    if (user && socket && !hasFetchedRef.current) {
      fetchConversations();
      hasFetchedRef.current = true;
    }
  }, [user, socket, fetchConversations]);

  // Socket event handlers - only attach when user and socket are ready
  useEffect(() => {
    if (!user || !socket) return;

    const handleNewMessage = async (data) => {
      if (data.conversationId || data.groupId) {
        setChats(prevChats => {
          const chatId = data.conversationId || data.groupId;
          const chatToUpdate = prevChats.find(chat => chat.id === chatId);
          if (!chatToUpdate) {
            fetchConversations();
            return prevChats;
          }
          const otherChats = prevChats.filter(chat => chat.id !== chatId);
          let senderName = '';
          if (data.isFromMe) {
            senderName = 'Bạn';
          } else if (chatToUpdate.type === 'group') {
            senderName = data.senderName || 'Unknown';
          } else {
            senderName = chatToUpdate.title;
          }
          const isCurrentChat = selectedChat === (chatToUpdate.type === 'group' ? chatToUpdate.id : chatToUpdate.otherParticipantPhone);
          const updatedChat = {
            ...chatToUpdate,
            message: data.content || data.message || "",
            time: formatTime(data.timestamp || new Date().getTime()),
            isFromMe: data.isFromMe || false,
            lastMessageId: data.groupMessageId || data.messageId || chatToUpdate.lastMessageId,
            lastMessageAt: data.timestamp || data.createdAt || new Date().getTime(),
            lastUpdate: new Date().getTime()
          };
          if (chatToUpdate.type === 'group' && !data.isFromMe) {
            updatedChat.message = `${senderName}: ${updatedChat.message}`;
          }
          return [updatedChat, ...otherChats];
        });
      } else {
        fetchConversations();
      }
    };

    const handleMessageRead = async (data) => {
      if (data.conversationId || data.groupId) {
        setChats(prevChats => {
          const chatId = data.conversationId || data.groupId;
          const updatedChats = prevChats.map(chat => {
            if (chat.id === chatId) {
              return {
                ...chat,
                unreadCount: 0,
                lastReadMessageId: data.messageId
              };
            }
            return chat;
          });
          return updatedChats;
        });
      }
    };

    const handleNewConversation = async (data) => {
      await fetchConversations();
    };

    const handleGroupUpdate = async (data) => {
      if (data.groupId) {
        const userStr = localStorage.getItem('user');
        if (!userStr) return;
        const userObj = JSON.parse(userStr);
        const response = await api.get(`/users/${userObj.userId}/groups`);
        if (response.data?.groups) {
          setChats(prevChats => {
            const updatedGroup = response.data.groups.find(g => g.groupId === data.groupId);
            if (!updatedGroup) return prevChats;
            const otherChats = prevChats.filter(chat => chat.id !== data.groupId);
            const updatedChat = {
              id: updatedGroup.groupId,
              title: updatedGroup.name,
              message: updatedGroup.lastMessage?.content || "Chưa có tin nhắn",
              time: formatTime(updatedGroup.lastMessageAt || updatedGroup.createdAt),
              avatar: updatedGroup.avatar,
              unreadCount: updatedGroup.unreadCount || 0,
              lastMessageAt: updatedGroup.lastMessageAt || updatedGroup.createdAt,
              type: 'group',
              memberCount: updatedGroup.memberCount,
              members: updatedGroup.members || []
            };
            return [updatedChat, ...otherChats];
          });
        }
      }
    };

    const handleConversationUpdated = (data) => {
      setChats(prevChats => {
        const chatId = data.conversationId || data.groupId;
        const chatToUpdate = prevChats.find(chat => chat.id === chatId);
        if (!chatToUpdate) {
          fetchConversations();
          return prevChats;
        }
        const otherChats = prevChats.filter(chat => chat.id !== chatId);
        const isCurrentChat = selectedChat === (chatToUpdate.type === 'group' ? chatToUpdate.id : chatToUpdate.otherParticipantPhone);
        const updatedChat = {
          ...chatToUpdate,
          message: data.lastMessage,
          time: formatTime(data.timestamp),
          lastMessageAt: data.timestamp,
          unreadCount: isCurrentChat ? 0 : chatToUpdate.unreadCount + 1
        };
        return [updatedChat, ...otherChats];
      });
    };

    // Lắng nghe event group:updated để realtime đổi tên/ảnh nhóm
    const handleGroupUpdated = (data) => {
      setChats(prevChats => prevChats.map(chat => {
        if (chat.type === 'group' && chat.id === data.groupId) {
          let updated = { ...chat };
          if (data.type === 'NAME_UPDATED') updated.title = data.data.name;
          if (data.type === 'AVATAR_UPDATED') updated.avatar = data.data.avatarUrl;
          return updated;
        }
        return chat;
      }));
    };

    socket.on("new_message", handleNewMessage);
    socket.on("message_read", handleMessageRead);
    socket.on("new_conversation", handleNewConversation);
    socket.on("group_message", handleNewMessage);
    socket.on("group_update", handleGroupUpdate);
    socket.on("conversation-updated", handleConversationUpdated);
    socket.on('group:updated', handleGroupUpdated);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        debouncedFetchConversations();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("message_read", handleMessageRead);
      socket.off("new_conversation", handleNewConversation);
      socket.off("group_message", handleNewMessage);
      socket.off("group_update", handleGroupUpdate);
      socket.off("conversation-updated", handleConversationUpdated);
      socket.off('group:updated', handleGroupUpdated);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user, socket, fetchConversations, debouncedFetchConversations, formatTime]);

  // Polling: only run when user and socket are ready
  useEffect(() => {
    if (!user || !socket) return;
    const checkForUpdates = async () => {
      const response = await api.get('/chat/conversations');
      if (response.data.status === 'success' && response.data.data?.conversations) {
        const serverChats = response.data.data.conversations;
        const hasNewMessages = serverChats.some((serverChat) => {
          const currentChat = chats.find(chat => chat.id === serverChat.conversationId);
          return !currentChat ||
            currentChat.message !== (serverChat.lastMessage?.content || "") ||
            currentChat.time !== formatTime(serverChat.lastMessage?.timestamp);
        });
        if (hasNewMessages) {
          debouncedFetchConversations();
          setLastUpdate(Date.now());
        }
      }
    };
    const intervalId = setInterval(checkForUpdates, 5000);
    return () => clearInterval(intervalId);
  }, [user, socket, chats, debouncedFetchConversations, formatTime]);

  // Set unreadCount về 0 mỗi khi selectedChat thay đổi (đang xem đoạn chat nào thì đoạn đó không có unread)
  useEffect(() => {
    if (!selectedChat) return;
    setChats(prevChats => prevChats.map(c =>
      ((c.id === selectedChat || c.otherParticipantPhone === selectedChat) ? { ...c, unreadCount: 0 } : c)
    ));
  }, [selectedChat]);

  const handleChatClick = async (chat) => {
    if (chat.type === 'group') {
      setSelectedChat(chat.id);
      dispatch(setSelectedGroup(chat));
      await markAsReadGroup(chat.id); // cập nhật lastReadAt trên backend
      navigate(`/app/groups/${chat.id}`);
    } else {
      setSelectedChat(chat.otherParticipantPhone);
      navigate(`/app/chat/${chat.otherParticipantPhone}`);
    }
  };

  // Add function to fetch unread counts
  const fetchUnreadCounts = async () => {
    try {
      const counts = {};
      for (const group of chats.filter(chat => chat.type === 'group')) {
        const response = await api.get(`/chat-group/${group.id}/unread`);
        if (response.status === 200) {
          counts[group.id] = response.data.data.unreadCount;
        }
      }
      setUnreadCounts(counts);
    } catch (error) {
      console.error("Error fetching unread counts:", error);
    }
  };

  // Update useEffect to fetch unread counts
  useEffect(() => {
    fetchUnreadCounts();
  }, [chats]);

  // Add socket event listener for unread counts
  useEffect(() => {
    if (socket) {
      socket.on("group-history", ({ groupId, unreadCount }) => {
        setUnreadCounts(prev => ({
          ...prev,
          [groupId]: unreadCount
        }));
      });
    }

    return () => {
      if (socket) {
        socket.off("group-history");
      }
    };
  }, [socket]);

  useEffect(() => {
    if (!groupUpdates) return;
    dispatch(updateGroup(groupUpdates));
    setChats(prevChats => prevChats.map(chat => {
      if (chat.type === 'group' && chat.id === groupUpdates.groupId) {
        let updated = { ...chat };
        if (groupUpdates.type === 'NAME_UPDATED') updated.title = groupUpdates.data.name;
        if (groupUpdates.type === 'AVATAR_UPDATED') updated.avatar = groupUpdates.data.avatarUrl;
        // Có thể bổ sung các loại event khác
        return updated;
      }
      return chat;
    }));
  }, [groupUpdates, dispatch]);

  // Hàm chuyển đổi số điện thoại 84xxxxxx -> 0xxxxxx
  function displayPhone(phone) {
    if (/^84\d{9}$/.test(phone)) {
      return '0' + phone.slice(2);
    }
    return phone;
  }

  const handleSearchChange = async (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setSearchUserResult(null);
    let apiPhone = value;
    if (/^0\d{9}$/.test(value)) {
      apiPhone = '84' + value.slice(1);
    }
    if (/^\d{8,15}$/.test(value)) {
      // Nếu là số điện thoại, kiểm tra có trong chat chưa
      const found = chats.find(
        chat => chat.type === 'direct' && (chat.otherParticipantPhone === value || chat.otherParticipantPhone === apiPhone)
      );
      if (!found) {
        setSearchingUser(true);
        try {
          const res = await api.get(`/users/${apiPhone}`);
          if (res.data && res.data.userId) {
            setSearchUserResult(res.data);
          } else {
            setSearchUserResult(null);
          }
        } catch (err) {
          setSearchUserResult(null);
        } finally {
          setSearchingUser(false);
        }
      }
    }
  };

  // Lọc danh sách chat theo searchTerm
  const filteredChats = searchTerm
    ? chats.filter(chat => {
        const lower = searchTerm.toLowerCase();
        if (chat.type === 'group') {
          return chat.title.toLowerCase().includes(lower);
        } else {
          // So sánh cả hai dạng số điện thoại
          const phone0 = chat.otherParticipantPhone && displayPhone(chat.otherParticipantPhone);
          return (
            chat.title.toLowerCase().includes(lower) ||
            (phone0 && phone0.includes(searchTerm)) ||
            (chat.otherParticipantPhone && chat.otherParticipantPhone.includes(searchTerm))
          );
        }
      })
    : chats;

  // Sau khi đã gọi hết các hook, mới đến các return điều kiện
  if (!user || !socket) return <div className="loading">Đang tải...</div>;
  if (loading) return <div className="loading">Đang tải...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="chat-list">
      <div className="chat-list-header">
        <div className="search-box">
          <div className="search-input-container">
            <Search size={20} className="search-icon" />
            <input
              type="text"
              placeholder="Tìm kiếm bạn bè, nhóm chat"
              className="search-input"
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </div>
          <button className="action-button" title="Thêm bạn" onClick={() => setShowAddFriendModal(true)}>
            <User size={20} />
          </button>
          <button
            className="action-button"
            title="Tạo nhóm chat"
            onClick={() => setShowCreateGroupModal(true)}
          >
            <Users size={20} />
          </button>
        </div>
        {/* Kết quả tìm kiếm user theo số điện thoại */}
        {searchTerm && searchUserResult && (
          <div
            className="search-user-result"
            style={{padding: '8px', background: '#f5f6fa', borderRadius: 8, marginTop: 8, display: 'flex', alignItems: 'center', gap: 12, cursor: searchUserResult.userId === currentUser.userId ? 'pointer' : 'default'}}
            onClick={() => {
              if (searchUserResult.userId === currentUser.userId) setShowSelfModal(true);
            }}
          >
            <img
              src={searchUserResult.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(searchUserResult.name)}&background=random`}
              alt={searchUserResult.name}
              style={{width: 40, height: 40, borderRadius: '50%'}}
            />
            <div style={{flex: 1}}>
              <div style={{fontWeight: 500}}>{searchUserResult.name}</div>
              <div style={{fontSize: 13, color: '#888'}}>{displayPhone(searchUserResult.phone)}</div>
            </div>
            {searchUserResult.userId !== currentUser.userId && (
              <button
                style={{background: '#2e89ff', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', cursor: 'pointer'}}
                onClick={e => {
                  e.stopPropagation();
                  setSelectedChat(searchUserResult.phone);
                  navigate(`/app/chat/${searchUserResult.phone}`);
                }}
              >
                Nhắn tin
              </button>
            )}
          </div>
        )}
        {searchTerm && searchingUser && (
          <div style={{padding: '8px', color: '#888'}}>Đang tìm kiếm...</div>
        )}
      </div>

      <div className="chat-tabs">
        <button
          className={`chat-tab ${activeTab === "Ưu tiên" ? "active" : ""}`}
          onClick={() => setActiveTab("Ưu tiên")}
        >
          Ưu tiên
        </button>
        <button
          className={`chat-tab ${activeTab === "Khác" ? "active" : ""}`}
          onClick={() => setActiveTab("Khác")}
        >
          Khác
        </button>
      </div>

      <div className="chat-items">
        {loading ? (
          <div className="loading-state">Đang tải...</div>
        ) : error ? (
          <div className="error-state">
            <p>{error}</p>
            <button onClick={fetchConversations}>Thử lại</button>
          </div>
        ) : filteredChats.length === 0 && !searchUserResult ? (
          <div className="empty-state">Không có cuộc trò chuyện nào</div>
        ) : (
          filteredChats.map((chat) => (
            <div
              key={chat.id}
              className={`chat-item ${selectedChat === (chat.type === 'group' ? chat.id : chat.otherParticipantPhone) ? 'active' : ''}`}
              onClick={() => handleChatClick(chat)}
            >
              <div className="chat-avatar">
                {chat.type === 'group' && (
                  <div style={{ position: 'relative' }}>
                    {chat.avatar ? (
                      <img
                        src={chat.avatar}
                        alt={chat.title}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.title)}&background=random`;
                        }}
                      />
                    ) : (
                      <div className="avatar-placeholder">
                        <Users size={24} className="group-icon" />
                      </div>
                    )}
                  </div>
                )}
                {chat.type === 'direct' && (
                  <div style={{ position: 'relative' }}>
                    {chat.avatar ? (
                      <img
                        src={chat.avatar}
                        alt={chat.title}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.title)}&background=random`;
                        }}
                      />
                    ) : (
                      <div className="avatar-placeholder">
                        {chat.title.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="chat-info">
                <div className="chat-header">
                  <h3 className="chat-title">
                    {chat.type === 'group' && <Users size={16} className="me-1" />}
                    {chat.title}
                    {/* {chat.type === 'group' && chat.memberCount && (
                      <span className="member-count"> · {chat.memberCount}</span>
                    )} */}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span className="chat-time">{chat.time}</span>
                    {chat.type === 'group' && unreadCounts[chat.id] > 0 && selectedChat !== (chat.type === 'group' ? chat.id : chat.otherParticipantPhone) && (
                      <span className="unread-badge unread-badge-below-time">{unreadCounts[chat.id] > 99 ? "99+" : unreadCounts[chat.id]}</span>
                    )}
                  </div>
                </div>
                <p className={`chat-message ${chat.unreadCount > 0 ? 'unread' : ''}`}>
                  {chat.isFromMe ? 'Bạn: ' : ''}{chat.message}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
      {showSelfModal && (
        <MemberInfoModal
          member={searchUserResult}
          commonGroups={0}
          onClose={() => setShowSelfModal(false)}
          onMessage={() => {}}
          currentUserId={currentUser.userId}
        />
      )}
    </div>
  );
}

export default ChatList; 