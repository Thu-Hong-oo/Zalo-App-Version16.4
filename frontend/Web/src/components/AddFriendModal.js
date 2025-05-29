import React, { useState } from "react";
import "./css/AddFriendModal.css";
import api from "../config/api";

export default function AddFriendModal({ onClose, currentUser }) {
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    setError("");
    setResult(null);

    if (!phone.trim()) return;

    const formatted = phone.startsWith("0") ? phone.replace(/^0/, "84") : phone;
    if (formatted === currentUser.phone) {
      setError("Không thể tìm chính bạn!");
      return;
    }

    try {
      const res = await api.get(`/users/${formatted}`);
      if (res.data) {
        setResult(res.data); // phải chứa: name, phone, userId, avatar
      } else {
        setError("Không tìm thấy người dùng.");
      }
    } catch (err) {
      setError("Không tìm thấy người dùng.");
    }
  };

  const handleSendRequest = async () => {
    if (!result?.userId || !currentUser?.userId) {
      setError("Thiếu userId để gửi lời mời.");
      return;
    }

    try {
      const payload = {
        from: currentUser.userId, // ✅ phải là UUID
        to: result.userId         // ✅ phải là UUID
      };

      console.log("📤 Sending friend request:", payload);

      const response = await api.post("/friends/request", payload);
      console.log("✅ Friend request sent:", response.data);

      setError("✅ Đã gửi lời mời kết bạn.");
    } catch (err) {
      console.error("❌ Friend request failed:", err.response?.data || err.message);
      setError(err.response?.data?.message || "❌ Gửi lời mời thất bại.");
    }
  };

  return (
    <div className="overlay">
      <div className="modal-container">
        <button className="close-btn" onClick={onClose}>×</button>
        <h3>Thêm bạn qua số điện thoại</h3>

        <div className="phone-input">
        
          <input
            type="tel"
            placeholder="Số điện thoại"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <button className="search-btn" onClick={handleSearch}>
          Tìm kiếm
        </button>

        {error && <div className="error-text">{error}</div>}

        {result && (
          <div className="search-result">
            <img
              src={result.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(result.name)}`}
              alt="avatar"
              className="avatar"
            />
            <div className="user-info">
              <strong>{result.name}</strong>
              <p>{result.phone}</p>
            </div>
            <button className="add-btn" onClick={handleSendRequest}>
              Kết bạn
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
