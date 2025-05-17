import React, { useState, useRef, useEffect } from 'react';
import { MoreHorizontal } from 'lucide-react';
import './css/FriendItem.css';
import { useNavigate } from 'react-router-dom';
import api from '../config/api';

const FriendItem = ({ friend, onRefresh }) => {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  const handleFriendClick = () => {
    if (showMenu) return; // Đang mở menu → không navigate
    const user = JSON.parse(localStorage.getItem("user"));
    const from = user.phone;
    const to = friend.phone;

    api.post("/conversations", { from, to })  .then(() => {
      navigate(`/app/chat/${to}`);
    });
  };

  const handleMoreClick = (e) => {
    e.stopPropagation(); // ❗ Ngăn không chạy handleFriendClick
    setShowMenu((prev) => !prev);
  };

  const handleDeleteFriend = async () => {
    const currentUser = JSON.parse(localStorage.getItem("user"));
    try {
      await api.post('/friends/delete', {
        userId: currentUser.userId,
        friendId: friend.userId,
      });
      setShowMenu(false);
      onRefresh?.();
    } catch (err) {
      console.error("❌ Lỗi xóa bạn:", err);
    }
  };

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <div className="friend-item" onClick={handleFriendClick}>
      <div className="friend-left">
        <img
          src={friend.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.name)}&background=random`}
          alt={friend.name}
          className="friend-avatar"
        />
        <div className="friend-name">{friend.name}</div>
      </div>

      <div className="friend-more-wrapper" ref={menuRef}>
        <MoreHorizontal
          size={18}
          className="friend-more"
          onClick={handleMoreClick}
        />
        {showMenu && (
          <div className="friend-popup-menu">
            <div className="menu-item" onClick={handleDeleteFriend}>
              ❌ Xóa bạn
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendItem;
