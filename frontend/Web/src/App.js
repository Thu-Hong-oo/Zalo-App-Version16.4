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
import { Provider } from 'react-redux';
import { store } from './redux/store';
import { useDispatch, useSelector } from 'react-redux';
import { updateGroup, updateGroupMembers, removeGroup } from './redux/slices/groupSlice';
import { setUser, updateUserAvatar, updateUserProfile, updateUserStatus } from './redux/slices/userSlice';
import { io } from "socket.io-client";
import { getSocketUrl } from "./config/api";
import Login from "./components/Login"
import ChatDirectly from "./components/ChatDirectly"
import GroupChat from "./components/GroupChat"
import FriendList from "./components/FriendList";
import FriendPanel from "./components/FriendPanel";
import FriendRequests from "./components/FriendRequests";
import AddFriendModal from "./components/AddFriendModal";
import CreateGroupModal from "./components/CreateGroupModal";
import ChatList from "./components/ChatList";
import SelfProfileModal from "./components/SelfProfileModal";
import VideoCall from "./components/VideoCall";
// Tạo context cho socket
export const SocketContext = createContext(null);
export const useSocket = () => useContext(SocketContext);

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
  const [currentSlide, setCurrentSlide] = useState(0)
  const [user, setUserState] = useState(null)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [sidebarTab, setSidebarTab] = useState("chat"); // mặc định là chat
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [socket, setSocket] = useState(null);
  const [selectedChat, setSelectedChat] = useState(null);
  const [showSelfProfileModal, setShowSelfProfileModal] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [videoCallProps, setVideoCallProps] = useState({});

  const navigate = useNavigate()
  const dispatch = useDispatch();
  const reduxUser = useSelector(state => state.user);


  // Khởi tạo socket khi đăng nhập
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    const newSocket = io(getSocketUrl(), {
      auth: { token },
      reconnection: true,
      transports: ["websocket", "polling"],
    });
    setSocket(newSocket);
    return () => newSocket.disconnect();
  }, []);

  // Initial fetch and user setup
  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const userData = JSON.parse(userStr);
        console.log("userData", userData);
        setUserState(userData);
        dispatch(setUser(userData));
      } catch (err) {
        console.error("Error parsing user data:", err);
      }
    }
  }, [dispatch]);

  // Tích hợp socket realtime user update
  useEffect(() => {
    if (!socket || !reduxUser?.userId) return;
    // Join vào room riêng
    socket.emit('join', `user:${reduxUser.userId}`);
    // Avatar update
    socket.on('user:avatar_updated', (data) => {
      dispatch(updateUserAvatar(data.avatarUrl));
      // Update localStorage
      const userLS = JSON.parse(localStorage.getItem('user'));
      if (userLS) {
        userLS.avatar = data.avatarUrl;
        localStorage.setItem('user', JSON.stringify(userLS));
      }
    });
    // Profile update
    socket.on('user:profile_updated', (data) => {
      dispatch(updateUserProfile(data));
      const userLS = JSON.parse(localStorage.getItem('user'));
      if (userLS) {
        Object.assign(userLS, data);
        localStorage.setItem('user', JSON.stringify(userLS));
      }
    });
    // Status update
    socket.on('user:status_updated', (data) => {
      dispatch(updateUserStatus(data.status));
      const userLS = JSON.parse(localStorage.getItem('user'));
      if (userLS) {
        userLS.status = data.status;
        localStorage.setItem('user', JSON.stringify(userLS));
      }
    });
    return () => {
      socket.off('user:avatar_updated');
      socket.off('user:profile_updated');
      socket.off('user:status_updated');
    };
  }, [socket, reduxUser?.userId, dispatch]);

  // Lắng nghe tất cả các event nhóm và dispatch redux
  useEffect(() => {
    if (!socket) return;

    const handleGroupUpdated = (payload) => {
      dispatch(updateGroup(payload));
    };
    const handleMemberJoined = (payload) => {
      dispatch(updateGroupMembers({ groupId: payload.groupId, members: payload.members }));
    };
    const handleMemberRemoved = (payload) => {
      dispatch(updateGroupMembers({ groupId: payload.groupId, members: payload.members }));
    };
    const handleGroupDissolved = (groupId) => {
      dispatch(removeGroup(groupId));
      // Optionally: chuyển hướng về trang chủ nếu đang ở group đó
      // navigate('/app');
    };

    socket.on('group:updated', handleGroupUpdated);
    socket.on('group:member_joined', handleMemberJoined);
    socket.on('group:member_removed', handleMemberRemoved);
    socket.on('group:dissolved', handleGroupDissolved);
    socket.on('call:offer', handleCallOffer);
    socket.on('call:answer', handleCallAnswer);
    socket.on('call:ice_candidate', handleCallIceCandidate);
    socket.on('call:end', handleCallEnd);

    return () => {
      socket.off('group:updated', handleGroupUpdated);
      socket.off('group:member_joined', handleMemberJoined);
      socket.off('group:member_removed', handleMemberRemoved);
      socket.off('group:dissolved', handleGroupDissolved);
      socket.off('call:offer', handleCallOffer);
      socket.off('call:answer', handleCallAnswer);
      socket.off('call:ice_candidate', handleCallIceCandidate);
      socket.off('call:end', handleCallEnd);
    };
  }, [socket, dispatch]);

  // Video Call Handlers
  const handleCallOffer = useCallback(({ offer, callerId }) => {
    if (socket) {
      socket.emit('video-call-answer', {
        callerId,
        answer: offer
      });
    }
  }, [socket]);

  const handleCallAnswer = useCallback(({ answer }) => {
    if (socket) {
      socket.emit('video-call-answer', {
        answer
      });
    }
  }, [socket]);

  const handleCallIceCandidate = useCallback(({ candidate }) => {
    if (socket) {
      socket.emit('ice-candidate', {
        candidate
      });
    }
  }, [socket]);

  const handleCallEnd = useCallback(() => {
    if (socket) {
      socket.emit('end-video-call');
    }
  }, [socket]);

  useEffect(() => {
    if (socket) {
      // Video Call Events
      socket.on('video-call-offer', handleCallOffer);
      socket.on('video-call-answer', handleCallAnswer);
      socket.on('ice-candidate', handleCallIceCandidate);
      socket.on('video-call-ended', handleCallEnd);

      return () => {
        socket.off('video-call-offer', handleCallOffer);
        socket.off('video-call-answer', handleCallAnswer);
        socket.off('ice-candidate', handleCallIceCandidate);
        socket.off('video-call-ended', handleCallEnd);
      };
    }
  }, [socket, handleCallOffer, handleCallAnswer, handleCallIceCandidate, handleCallEnd]);

  // Lắng nghe cuộc gọi đến
  useEffect(() => {
    if (!socket) return;
    const handleIncomingCall = (data) => {
      setIncomingCall(data);
    };
    socket.on('incoming-video-call', handleIncomingCall);
    return () => socket.off('incoming-video-call', handleIncomingCall);
  }, [socket]);

  // Khi người gọi nhận được call-accepted thì join VideoCall
  useEffect(() => {
    if (!socket) return;
    const handleCallAccepted = (data) => {
      setVideoCallProps({
        isOpen: true,
        callId: data.callId,
        roomName: data.roomName,
        isCreator: true,
        // Có thể truyền thêm identity, localName, remoteName, ...
      });
      setShowVideoCall(true);
    };
    socket.on('call-accepted', handleCallAccepted);
    return () => socket.off('call-accepted', handleCallAccepted);
  }, [socket]);

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

  return (
    <SocketContext.Provider value={socket}>
      <div className="d-flex vh-100" style={{ backgroundColor: "#f0f5ff" }}>
        {/* Sidebar */}
        <div className="sidebar">
          <div className="sidebar-top">
            <div className="user-profile">
            
                <button
                  className="profile-avatar-btn"
                  onClick={() => setShowSelfProfileModal(true)}
                 
                >
                  <img
                    src={reduxUser?.avatar || '/default-avatar.png'}
                    alt={reduxUser?.name || "User"}
                    className="avatar-sidebar"
                    title={reduxUser?.name || "User"}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(reduxUser?.name || "User")}&background=random`;
                    }}
                  />
                 {reduxUser?.status === "online" && (
                  <span className="status-badge"></span>
                )}
                </button>
               
            
            </div>
            <div className="nav-items">
              <button
                className={`nav-item${sidebarTab === 'chat' ? ' active' : ''}`}
                onClick={() => setSidebarTab('chat')}
              >
                <MessageCircle size={24} />
              </button>
              <button
                className={`nav-item${sidebarTab === 'friends' ? ' active' : ''}`}
                onClick={() => setSidebarTab('friends')}
              >
                <User size={24} />
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
                  <button className="menu-item" onClick={() => setShowSelfProfileModal(true)}>
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

        {/* Layout: Khi ở tab chat, hiển thị ChatList + main-content; Khi ở tab friends, chỉ hiển thị FriendPanel */}
        {user && socket && (
          <>
            {sidebarTab === 'chat' && (
              <>
                <ChatList
                  user={user}
                  setShowAddFriendModal={setShowAddFriendModal}
                  setShowCreateGroupModal={setShowCreateGroupModal}
                  socket={socket}
                  selectedChat={selectedChat}
                  setSelectedChat={setSelectedChat}
                />
                <div className="main-content">
                  <Routes>
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
                    <Route path="chat/:phone" element={<ChatDirectly />} />
                    <Route path="friends" element={<FriendList />} />
                    <Route path="contacts" element={<FriendPanel />} />
                    <Route path="chat/:conversationId" element={<ChatDirectly />} />
                    <Route path="chat/id/:userId" element={<ChatDirectly />} />
                    <Route path="groups/:groupId" element={<GroupChat selectedChat={selectedChat} />} />
                    <Route path="friend-requests" element={<FriendRequests />} />
                    <Route path="call/:callId" element={<VideoCall />} />
                  </Routes>
                </div>
              </>
            )}
            {sidebarTab === 'friends' && (
              <FriendPanel />
            )}
          </>
        )}

        {showAddFriendModal && (
          <AddFriendModal
            currentUser={user} //Truyền toàn bộ user object
            onClose={() => setShowAddFriendModal(false)}
          />
        )}
        {showSelfProfileModal && (
          <SelfProfileModal
            onClose={() => setShowSelfProfileModal(false)}
            userId={user.userId}
          />
        )}

        {/* Modals */}
        <CreateGroupModal
          isOpen={showCreateGroupModal}
          onClose={() => setShowCreateGroupModal(false)}
          onGroupCreated={null} // Xử lý group mới sẽ do ChatList quản lý
        />

        {/* <GroupSidebar
          isOpen={showProfileMenu}
          onClose={() => setShowProfileMenu(false)}
        /> */}

        {incomingCall && (
          <div className="incoming-call-modal">
            <div>
              <b>{incomingCall.senderPhone}</b> đang gọi cho bạn
            </div>
            <button
              onClick={async () => {
                socket.emit('accept-video-call', { callId: incomingCall.callId });
                setVideoCallProps({
                  isOpen: true,
                  callId: incomingCall.callId,
                  roomName: incomingCall.roomName,
                  isCreator: false,
                  // Có thể truyền thêm identity, localName, remoteName, ...
                });
                setShowVideoCall(true);
                setIncomingCall(null);
              }}
            >
              Nhận cuộc gọi
            </button>
            <button
              onClick={() => {
                socket.emit('decline-video-call', { callId: incomingCall.callId });
                setIncomingCall(null);
              }}
            >
              Từ chối
            </button>
          </div>
        )}

        {showVideoCall && (
          <VideoCall
            {...videoCallProps}
            onClose={() => setShowVideoCall(false)}
          />
        )}

      </div>
    </SocketContext.Provider>
  )
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const token = localStorage.getItem("accessToken");
    const user = localStorage.getItem("user");
    return !!(token && user);
  });

  // Check authentication on mount and when localStorage changes
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem("accessToken");
      const user = localStorage.getItem("user");
      setIsAuthenticated(!!(token && user));
    };

    // Check auth on mount
    checkAuth();

    // Listen for storage changes
    window.addEventListener('storage', checkAuth);
    return () => window.removeEventListener('storage', checkAuth);
  }, []);

  return (
    <Provider store={store}>
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
    </Provider>
  );
}

export default App 