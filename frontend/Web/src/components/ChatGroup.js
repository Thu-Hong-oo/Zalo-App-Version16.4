import React, { useState, useEffect, useContext, useRef } from "react";
import { useParams } from "react-router-dom";
import { Send, Image, Paperclip, MoreHorizontal, Users } from "lucide-react";
import { SocketContext } from "../App";
import api from "../config/api";
import "./ChatGroup.css";

function ChatGroup() {
  const { groupId } = useParams();
  const { socket } = useContext(SocketContext);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [groupInfo, setGroupInfo] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const fetchGroupInfo = async () => {
      try {
        const response = await api.get(`/groups/${groupId}`);
        setGroupInfo(response.data);
      } catch (error) {
        console.error("Error fetching group info:", error);
        setError("Không thể tải thông tin nhóm");
      }
    };

    const fetchGroupMessages = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/groups/${groupId}/messages`);
        if (response.data) {
          setMessages(response.data);
        }
        setError(null);
      } catch (err) {
        console.error("Error fetching messages:", err);
        setError("Không thể tải tin nhắn");
      } finally {
        setLoading(false);
      }
    };

    fetchGroupInfo();
    fetchGroupMessages();
  }, [groupId]);

  useEffect(() => {
    if (!socket) return;

    const handleNewGroupMessage = (data) => {
      if (data.groupId === groupId) {
        setMessages((prevMessages) => [...prevMessages, data]);
      }
    };

    socket.on("new_group_message", handleNewGroupMessage);

    return () => {
      socket.off("new_group_message", handleNewGroupMessage);
    };
  }, [socket, groupId]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const response = await api.post(`/groups/${groupId}/messages`, {
        content: newMessage,
      });

      if (response.data) {
        setMessages((prev) => [...prev, response.data]);
        setNewMessage("");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setError("Không thể gửi tin nhắn");
    }
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files.length) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }

    try {
      const uploadResponse = await api.post("/chat/upload", formData);
      if (uploadResponse.data.status === "success") {
        const urls = uploadResponse.data.data.urls;
        for (const url of urls) {
          await api.post(`/groups/${groupId}/messages`, {
            content: url,
            type: "file",
          });
        }
      }
    } catch (error) {
      console.error("Error uploading files:", error);
      setError("Không thể tải lên tệp");
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) return <div className="loading">Đang tải...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="chat-container">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-info">
          <div className="chat-avatar">
            {groupInfo?.avatar ? (
              <img src={groupInfo.avatar} alt={groupInfo.name} />
            ) : (
              <div className="avatar-placeholder">
                {groupInfo?.name?.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="chat-details">
            <h2>{groupInfo?.name}</h2>
            <p>{groupInfo?.memberCount} thành viên</p>
          </div>
        </div>
        <div className="chat-header-actions">
          <button className="icon-button" title="Thành viên nhóm">
            <Users size={20} />
          </button>
          <button className="icon-button" title="Thêm">
            <MoreHorizontal size={20} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container">
        {messages.map((message, index) => (
          <div
            key={message.messageId || index}
            className={`message ${message.isFromMe ? "sent" : "received"}`}
          >
            {!message.isFromMe && (
              <div className="message-sender">{message.senderName}</div>
            )}
            <div className="message-content">
              {message.type === "file" ? (
                message.content.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                  <img
                    src={message.content}
                    alt="Uploaded"
                    className="message-image"
                  />
                ) : (
                  <a
                    href={message.content}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="file-link"
                  >
                    {message.content.split("/").pop()}
                  </a>
                )
              ) : (
                message.content
              )}
              <span className="message-time">
                {formatTime(message.timestamp)}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form className="chat-input" onSubmit={handleSendMessage}>
        <button
          type="button"
          className="icon-button"
          onClick={() => fileInputRef.current.click()}
        >
          <Paperclip size={20} />
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={() => fileInputRef.current.click()}
        >
          <Image size={20} />
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          multiple
          style={{ display: "none" }}
        />
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Nhập tin nhắn..."
          className="message-input"
        />
        <button
          type="submit"
          className="send-button"
          disabled={!newMessage.trim()}
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}

export default ChatGroup;
