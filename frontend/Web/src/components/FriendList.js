import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './css/FriendList.css';
import FriendItem from './FriendItem';
import api from '../config/api';

const FriendList = () => {
  const [friends, setFriends] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  // Nhóm bạn bè theo chữ cái đầu của tên
  const groupByFirstLetter = (arr) => {
    return arr.reduce((acc, friend) => {
      const letter = friend.name?.charAt(0)?.toUpperCase() || '#';
      if (!acc[letter]) acc[letter] = [];
      acc[letter].push(friend);
      return acc;
    }, {});
  };

  useEffect(() => {
    const fetchFriends = async () => {
      try {
        const user = JSON.parse(localStorage.getItem("user"));
        if (!user?.userId) return console.warn("Không tìm thấy userId trong localStorage");

        const response = await api.get(`/friends/${user.userId}`);
        setFriends(response.data.friends || []);
      } catch (err) {
        console.error("Lỗi lấy danh sách bạn bè:", err);
      }
    };

    fetchFriends();
  }, []);

  const handleFriendClick = async (friend) => {
    try {
      const currentUser = JSON.parse(localStorage.getItem("user"));
      if (!currentUser?.userId || !friend.userId) return;

      const response = await api.post("/conversations", {
        from: currentUser.userId,
        to: friend.userId,
      });

      console.log("✅ Conversation created or found:", response.data);
      navigate(`/app/chat/${friend.phone}`); // 🔁 dùng phone như bạn yêu cầu
    } catch (err) {
      console.error("❌ Lỗi khi mở đoạn chat:", err);
    }
  };

  const filtered = friends.filter((f) =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const grouped = groupByFirstLetter(filtered);

  return (
    <div className="friend-section">
      <div className="header">
        <h3>Bạn bè ({friends.length})</h3>
        <input
          className="search-input"
          placeholder="Tìm bạn bè..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="friend-list">
        {Object.keys(grouped).sort().map((letter) => (
          <div key={letter} className="group">
            <div className="letter">{letter}</div>
            {grouped[letter].map((friend) => (
              <div key={friend.userId || friend.phone} onClick={() => handleFriendClick(friend)}>
                <FriendItem friend={friend} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FriendList;