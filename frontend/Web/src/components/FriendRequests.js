import React, { useEffect, useState, useCallback } from 'react';
import api from '../config/api';
import './css/FriendRequests.css';

export default function FriendRequests({ onRefreshConversations }) {
  const user = JSON.parse(localStorage.getItem("user"));
  const userId = user?.userId; // ✅ dùng UUID làm userId chuẩn
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const fetchFriendRequests = useCallback(async () => {
    try {
      console.log("📥 Fetch friend requests for:", userId);
      const receivedRes = await api.get(`/friends/request/received/${userId}`);
      const sentRes = await api.get(`/friends/request/sent/${userId}`);

      console.log("✅ Received:", receivedRes.data);
      console.log("✅ Sent:", sentRes.data);

      setReceivedRequests(receivedRes.data.received || []);
      setSentRequests(sentRes.data.sent || []);
    } catch (err) {
      console.error("❌ Lỗi lấy lời mời:", err);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchFriendRequests();
    }
  }, [fetchFriendRequests, userId]);

  const handleAccept = async (requestId, fromUserId) => {
    try {
      await api.post("/friends/request/accept", { requestId });
  
      const convoRes = await api.post("/conversations", {
        from: userId,
        to: fromUserId,
      });
  
      const conversationId = convoRes.data.conversationId;
  
      // Xoá lời mời đã nhận (nếu cần)
      setReceivedRequests((prev) =>
        prev.filter((req) => req.requestId !== requestId)
      );
  
      // ✅ Xoá lời mời đã gửi nếu có (so sánh cả `to` và `requestId`)
      setSentRequests((prev) =>
        prev.filter(
          (req) =>
            req.requestId !== requestId &&
            req.to !== fromUserId &&
            req.from !== fromUserId
        )
      );
  
      if (onRefreshConversations) {
        onRefreshConversations(conversationId);
      }
  
      // Optional: đồng bộ lại toàn bộ
      // await fetchFriendRequests();
  
    } catch (err) {
      console.error("❌ Lỗi đồng ý kết bạn:", err);
    }
  };
  
  
  
  

  const handleReject = async (requestId) => {
    try {
      await api.post("/friends/request/reject", { requestId });
      fetchFriendRequests();
    } catch (err) {
      console.error("❌ Lỗi từ chối lời mời:", err);
    }
  };

  const handleCancel = async (requestId) => {
    try {
      await api.post("/friends/request/cancel", { requestId });
      fetchFriendRequests();
    } catch (err) {
      console.error("❌ Lỗi hủy lời mời:", err);
    }
  };

  return (
    <div className="friend-requests">
      <h3 className="section-title">Lời mời đã nhận ({receivedRequests.length})</h3>
      <div className="requests-grid">
        {receivedRequests.map((req) => (
          <div className="request-card" key={req.requestId}>
            <div className="request-header">
              <img
                src={req.fromUser?.avatar || `https://ui-avatars.com/api/?name=${req.fromUser?.name}`}
                alt=""
                className="avatar"
              />
              <div>
                <strong>{req.fromUser?.name}</strong>
                <div className="sub-text">Từ cửa sổ trò chuyện</div>
              </div>
            </div>
            <div className="request-message">
              {req.message || "Xin chào, kết bạn với mình nhé!"}
            </div>
            <div className="action-buttons">
              <button className="decline" onClick={() => handleReject(req.requestId)}>Từ chối</button>
              <button className="accept" onClick={() => handleAccept(req.requestId, req.from)}>Đồng ý</button>
            </div>
          </div>
        ))}
      </div>

      <h3 className="section-title">Lời mời đã gửi ({sentRequests.length})</h3>
      <div className="requests-grid">
        {sentRequests.map((req) => (
          <div className="request-card small" key={req.requestId}>
            <div className="request-header">
              <img
                src={req.toUser?.avatar || `https://ui-avatars.com/api/?name=${req.toUser?.name}`}
                alt=""
                className="avatar"
              />
              <div>
                <strong>{req.toUser?.name}</strong>
                <div className="sub-text">Bạn đã gửi lời mời</div>
              </div>
            </div>
            <button className="withdraw" onClick={() => handleCancel(req.requestId)}>Thu hồi lời mời</button>
          </div>
        ))}
      </div>
    </div>
  );
}
