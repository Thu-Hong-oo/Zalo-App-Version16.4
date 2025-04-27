import { useState, useEffect, createContext, useContext } from "react"
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
  const [user, setUser] = useState(null)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [sidebarTab, setSidebarTab] = useState("chat"); // mặc định là chat
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [groups, setGroups] = useState([]);
  const [socket, setSocket] = useState(null);

  const navigate = useNavigate()

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
        setUser(userData);
      } catch (err) {
        console.error("Error parsing user data:", err);
      }
    }
  }, []);

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
                    <Route path="groups/:groupId" element={<GroupChat />} />
                    <Route path="friend-requests" element={<FriendRequests />} />
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

        {/* Modals */}
        <CreateGroupModal
          isOpen={showCreateGroupModal}
          onClose={() => setShowCreateGroupModal(false)}
          onGroupCreated={null} // Xử lý group mới sẽ do ChatList quản lý
        />

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
  );
}

export default App 