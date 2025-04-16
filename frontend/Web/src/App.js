import { useState, useEffect, createContext, useContext, useCallback } from "react"
import { Routes, Route, Navigate, useNavigate } from "react-router-dom"
import {
  Search,
  MessageCircle,
  FileText,
  CheckSquare,
  Database,
  Cloud,
  Briefcase,
  Settings,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Users,
  User,
  ImageIcon,
  LogOut
} from "lucide-react"
import "bootstrap/dist/css/bootstrap.min.css"
import "./App.css"

import { io } from "socket.io-client"
import Login from "./components/Login"
import ChatDirectly from "./components/ChatDirectly"
import api, { getBaseUrl ,getApiUrl} from "./config/api"

// Create socket context
export const SocketContext = createContext(null)

// Add debounce function
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

function MainApp({ setIsAuthenticated }) {
  const { socket, socketConnected } = useContext(SocketContext)
  const [activeTab, setActiveTab] = useState("Ưu tiên")
  const [currentSlide, setCurrentSlide] = useState(0)
  const [user, setUser] = useState(null)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [chats, setChats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userCache, setUserCache] = useState({})
  const [selectedChat, setSelectedChat] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(Date.now())
  const navigate = useNavigate()

  const fetchUserInfo = async (phone) => {
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
  }

  const fetchConversations = async () => {
    try {
      console.log("Fetching conversations...");
      const response = await api.get('/chat/conversations');
      console.log("Conversations response:", response.data);
      
      if (response.data.status === 'success' && response.data.data?.conversations) {
        const newChats = await Promise.all(
          response.data.data.conversations.map(async (conv) => {
            try {
              const otherParticipant = conv.participant.isCurrentUser
                ? conv.otherParticipant
                : conv.participant;
    
              const userInfo = await fetchUserInfo(otherParticipant.phone);
              console.log("User info for", otherParticipant.phone, ":", userInfo);
    
              return {
                id: conv.conversationId,
                title: userInfo?.name || otherParticipant.phone,
                message: conv.lastMessage?.content || "",
                time: conv.lastMessage?.timestamp ? formatTime(conv.lastMessage.timestamp) : "",
                avatar: userInfo?.avatar,
                isFromMe: conv.lastMessage?.isFromMe || false,
                unreadCount: conv.unreadCount || 0,
                otherParticipantPhone: otherParticipant.phone,
                senderName: conv.lastMessage?.isFromMe ? 'Bạn' : (userInfo?.name || otherParticipant.phone)
              };
            } catch (error) {
              console.error("Error processing conversation:", error);
              return null;
            }
          })
        );
  
        // Filter out any null conversations
        const validChats = newChats.filter(chat => chat !== null);
  
        // 🔍 So sánh dữ liệu mới với dữ liệu cũ
        const isEqual = JSON.stringify(validChats) === JSON.stringify(chats);
        if (!isEqual) {
          setChats(validChats);
        }
  
        setError(null);
      } else {
        console.error("Invalid response format:", response.data);
        setError("Invalid response format from server");
      }
    } catch (err) {
      console.error("Error in fetchConversations:", err);
      setError(err.message || "Failed to load conversations");
    } finally {
      setLoading(false);
    }
  };

  // Create debounced version of fetchConversations with shorter delay
  const debouncedFetchConversations = debounce(fetchConversations, 300);

  // Initial fetch and user setup
  useEffect(() => {
    const userStr = localStorage.getItem("user")
    if (userStr) {
      try {
        const userData = JSON.parse(userStr)
        setUser(userData)
      } catch (err) {
        console.error("Error parsing user data:", err)
      }
    }
    fetchConversations()
  }, []) // Run only once on mount

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;
  
    const handleNewMessage = async (data) => {
      console.log("New message received:", data);
      
      // Immediately update the chat list for the specific conversation
      if (data.conversationId) {
        setChats(prevChats => {
          // Find the conversation to update
          const chatToUpdate = prevChats.find(chat => chat.id === data.conversationId);
          if (!chatToUpdate) {
            // If conversation not found, fetch all conversations
            fetchConversations();
            return prevChats;
          }

          // Move the updated chat to the top and update its content
          const otherChats = prevChats.filter(chat => chat.id !== data.conversationId);
          const updatedChat = {
            ...chatToUpdate,
            message: data.content || data.message || "", // Handle both content and message fields
            time: formatTime(data.timestamp || new Date().getTime()),
            unreadCount: !data.isFromMe ? (chatToUpdate.unreadCount || 0) + 1 : chatToUpdate.unreadCount,
            isFromMe: data.isFromMe || false,
            lastMessageId: data.messageId, // Store message ID if available
            lastUpdate: new Date().getTime() // Add timestamp to force re-render
          };

          // Log the update for debugging
          console.log("Updating chat:", {
            before: chatToUpdate,
            after: updatedChat,
            messageData: data
          });

          // Always move updated chat to top of list
          return [updatedChat, ...otherChats];
        });
      } else {
        console.warn("Received message without conversationId:", data);
        // Fetch all conversations if we can't update specifically
        fetchConversations();
      }
    };
  
    const handleMessageRead = async (data) => {
      console.log("Message read status updated:", data);
      
      if (data.conversationId) {
        setChats(prevChats => {
          const updatedChats = prevChats.map(chat => {
            if (chat.id === data.conversationId) {
              return {
                ...chat,
                unreadCount: 0,
                lastReadMessageId: data.messageId // Store last read message ID if available
              };
            }
            return chat;
          });

          // Keep the same order
          return updatedChats;
        });
      }
    };
  
    const handleNewConversation = async (data) => {
      console.log("New conversation created:", data);
      // For new conversations, we need to fetch to get complete data
      await fetchConversations();
    };
  
    // Socket listeners
    socket.on("new_message", handleNewMessage);
    socket.on("message_read", handleMessageRead);
    socket.on("new_conversation", handleNewConversation);
  
    // ✅ Dùng Page Visibility API để load lại khi user quay lại tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchConversations();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
  
    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("message_read", handleMessageRead);
      socket.off("new_conversation", handleNewConversation);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [socket, fetchConversations]); // Add fetchConversations to dependencies
  

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date

    if (diff < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    }
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]
      return days[date.getDay()]
    }
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
    })
  }

  const handleLogout = () => {
    localStorage.removeItem("accessToken")
    localStorage.removeItem("refreshToken")
    localStorage.removeItem("user")
    setIsAuthenticated(false)
    navigate("/login", { replace: true })
  }

  const handlePrevSlide = () => {
    setCurrentSlide((prev) => (prev > 0 ? prev - 1 : 0))
  }

  const handleNextSlide = () => {
    setCurrentSlide((prev) => (prev < 4 ? prev + 1 : 4))
  }

  const handleChatClick = (chat) => {
    setSelectedChat(chat.otherParticipantPhone)
    navigate(`/app/chat/${chat.otherParticipantPhone}`)
  }

  const slides = [
    {
      id: 1,
      image: "/images/slide1.png",
      title: "Nhắn tin nhiều hơn, soạn thảo ít hơn",
      description: "Sử dụng Tin Nhắn Nhanh để lưu sẵn các tin nhắn thường dùng và gửi nhanh trong hội thoại bất kỳ."
    },
    {
      id: 2,
      image: "/images/slide2.png",
      title: "Trải nghiệm xuyên suốt",
      description: "Kết nối và giải quyết công việc trên mọi thiết bị với dữ liệu luôn được đồng bộ."
    },
    {
      id: 3,
      image: "/images/slide3.png",
      title: "Gửi file không giới hạn",
      description: "Chia sẻ hình ảnh, file văn bản, bảng tính... với dung lượng không giới hạn."
    },
    {
      id: 4,
      image: "/images/slide4.png",
      title: "Chat nhóm với đồng nghiệp",
      description: "Trao đổi công việc nhóm một cách hiệu quả trong không gian làm việc riêng."
    }
  ]

  // Add this useEffect to force re-render when chats change
  useEffect(() => {
    const checkForUpdates = async () => {
      const response = await api.get('/chat/conversations');
      if (response.data.status === 'success' && response.data.data?.conversations) {
        const serverChats = response.data.data.conversations;
        
        // Compare with current chats
        const hasNewMessages = serverChats.some((serverChat) => {
          const currentChat = chats.find(chat => chat.id === serverChat.conversationId);
          return !currentChat || 
                 currentChat.message !== (serverChat.lastMessage?.content || "") ||
                 currentChat.time !== formatTime(serverChat.lastMessage?.timestamp);
        });

        if (hasNewMessages) {
          console.log("New messages detected, updating chat list...");
          fetchConversations();
          setLastUpdate(Date.now());
        }
      }
    };

    // Check for updates every 5 seconds
    const intervalId = setInterval(checkForUpdates, 5000);

    return () => clearInterval(intervalId);
  }, [chats]);

  return (
    <div className="d-flex vh-100" style={{ backgroundColor: "#f0f5ff" }}>
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-top">
          <div className="user-profile">
            <div>
              <img 
                src={user?.avatar} 
                alt={user?.name || "User"} 
                className="avatar"
                title={user?.name || "User"}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "User")}&background=random`;
                }}
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  objectFit: "cover"
                }}
              />
              {user?.status === "online" && (
                <span className="status-badge"></span>
              )}
            </div>
          </div>
          <div className="nav-items">
            <button className="nav-item active">
              <MessageCircle size={24} />
            </button>
            <button className="nav-item">
              <Users size={24} />
            </button>
            <button className="nav-item">
              <FileText size={24} />
            </button>
            <button className="nav-item">
              <Cloud size={24} />
            </button>
            <button className="nav-item">
              <CheckSquare size={24} />
            </button>
            <button className="nav-item">
              <Database size={24} />
            </button>
            <button className="nav-item">
              <Briefcase size={24} />
            </button>
          </div>
        </div>
        <div className="sidebar-bottom">
          <button 
            className="nav-item settings"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
          >
            <Settings size={24} />
            {showProfileMenu && (
              <div className="profile-menu">
                <button className="menu-item">
                  <User size={16} />
                  Thông tin tài khoản
                </button>
                <hr />
                <button className="menu-item danger" onClick={handleLogout}>
                  <LogOut size={16} />
                  Đăng xuất
                </button>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Chat List */}
      <div className="chat-list">
        <div className="chat-list-header">
          <div className="search-box">
            <div className="search-input-container">
              <Search size={20} className="search-icon" />
              <input 
                type="text" 
                placeholder="Tìm kiếm bạn bè, nhóm chat" 
                className="search-input"
              />
            </div>
            <button className="action-button" title="Thêm bạn">
              <User size={20} />
            </button>
            <button className="action-button" title="Tạo nhóm chat">
              <Users size={20} />
            </button>
          </div>
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
        {/* Chat items */}
        <div className="chat-items">
          {loading ? (
            <div className="loading-state">Đang tải...</div>
          ) : error ? (
            <div className="error-state">
              <p>{error}</p>
              <button onClick={fetchConversations}>Thử lại</button>
            </div>
          ) : chats.length === 0 ? (
            <div className="empty-state">Không có cuộc trò chuyện nào</div>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                className={`chat-item ${selectedChat === chat.otherParticipantPhone ? 'active' : ''}`}
                onClick={() => handleChatClick(chat)}
              >
                <div className="chat-avatar">
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
                  {chat.unreadCount > 0 && (
                    <span className="unread-badge">{chat.unreadCount}</span>
                  )}
                </div>
                <div className="chat-info">
                  <div className="chat-header">
                    <h3 className="chat-title">{chat.title}</h3>
                    <span className="chat-time">{chat.time}</span>
                  </div>
                  <p className={`chat-message ${chat.unreadCount > 0 ? 'unread' : ''}`}>
                    {chat.isFromMe ? 'Bạn: ' : ''}{chat.message}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <Routes>
          <Route path="chat/:phone" element={<ChatDirectly />} />
          <Route path="/" element={
            <div className="welcome-screen">
              <div className="carousel-container">
                <button className="carousel-btn prev" onClick={handlePrevSlide}>
                  <ChevronLeft size={24} />
                </button>
                <div className="carousel-content">
                  {slides[currentSlide] && (
                    <>
                      <img
                        src={slides[currentSlide].image}
                        alt={slides[currentSlide].title}
                        className="carousel-image"
                      />
                      <div className="welcome-text">
                        <h2>{slides[currentSlide].title}</h2>
                        <p>{slides[currentSlide].description}</p>
                      </div>
                    </>
                  )}
                </div>
                <button className="carousel-btn next" onClick={handleNextSlide}>
                  <ChevronRight size={24} />
                </button>
              </div>
              
              <div className="carousel-indicators">
                {slides.map((slide, index) => (
                  <button
                    key={slide.id}
                    className={`carousel-indicator ${currentSlide === index ? 'active' : ''}`}
                    onClick={() => setCurrentSlide(index)}
                  />
                ))}
              </div>
            </div>
          } />
        </Routes>
      </div>
    </div>
  )
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [socket, setSocket] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);

  // Khởi tạo socket connection
  const initializeSocket = useCallback(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) return null;

    const newSocket = io(getBaseUrl(), {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ["websocket"],
      withCredentials: true,
    });

    newSocket.on("connect", () => {
      console.log("Socket connected!");
      setSocketConnected(true);
    });

    newSocket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      setSocketConnected(false);
    });

    newSocket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      setSocketConnected(false);
    });

    return newSocket;
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      setIsAuthenticated(true);
      const newSocket = initializeSocket();
      if (newSocket) {
        setSocket(newSocket);
        return () => {
          newSocket.close();
        };
      }
    }
  }, [isAuthenticated, initializeSocket]);

  return (
    <SocketContext.Provider value={{ socket, socketConnected }}>
      <Routes>
        <Route
          path="/login"
          element={
            !isAuthenticated ? (
              <Login setIsAuthenticated={setIsAuthenticated} />
            ) : (
              <Navigate to="/app" replace />
            )
          }
        />
        <Route
          path="/app/*"
          element={
            isAuthenticated ? (
              <MainApp setIsAuthenticated={setIsAuthenticated} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="/" element={<Navigate to="/app" replace />} />
      </Routes>
    </SocketContext.Provider>
  );
}

function ChatItem({ avatars, name, message, time, count, hasMore }) {
  return (
    <div className="chat-item" style={{ 
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'flex-start',
      borderBottom: '1px solid #E6E8EB',
      cursor: 'pointer',
      ':hover': {
        backgroundColor: '#f5f5f5'
      }
    }}>
      <div style={{ position: 'relative', marginRight: '12px' }}>
        {avatars.length === 1 ? (
          <div style={{ 
            width: '48px', 
            height: '48px', 
            borderRadius: '12px',
            overflow: 'hidden'
          }}>
            <img 
              src={avatars[0]} 
              alt="" 
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          </div>
        ) : (
          <div style={{ 
            position: 'relative',
            width: '48px',
            height: '48px'
          }}>
            <div style={{
              position: 'absolute',
              top: '0',
              left: '0',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '2px solid white'
            }}>
              <img 
                src={avatars[0]} 
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            </div>
            <div style={{
              position: 'absolute',
              bottom: '0',
              right: '0',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '2px solid white'
            }}>
              <img 
                src={avatars[1]} 
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'flex-start',
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
            {name}
          </h3>
          <span style={{ 
            fontSize: '12px',
            color: '#7589A3',
            whiteSpace: 'nowrap',
            marginLeft: '8px'
          }}>
            {time}
          </span>
        </div>

        <div style={{ 
          display: 'flex',
          alignItems: 'center'
        }}>
          <p style={{ 
            margin: 0,
            fontSize: '13px',
            color: '#7589A3',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {message}
          </p>

          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            marginLeft: '8px'
          }}>
            {count && (
              <span style={{ 
                backgroundColor: '#0068FF',
                color: 'white',
                padding: '2px 6px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '500',
                minWidth: '20px',
                textAlign: 'center'
              }}>
                {count}
              </span>
            )}
            {hasMore && (
              <span style={{ 
                backgroundColor: '#E6E8EB',
                color: '#7589A3',
                padding: '2px 6px',
                borderRadius: '12px',
                fontSize: '12px',
                marginLeft: '4px'
              }}>
                +
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App 