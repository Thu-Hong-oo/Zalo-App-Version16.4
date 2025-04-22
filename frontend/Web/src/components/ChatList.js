import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './css/ChatList.css';
import api from '../config/api';
import { io } from 'socket.io-client';
import { getBaseUrl } from '../config/api';

const ChatList = () => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [socket, setSocket] = useState(null);
  const navigate = useNavigate();

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/chat/conversations');
      if (response.data.status === 'success') {
        setConversations(response.data.data.conversations || []);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
      setError('Không thể tải danh sách chat');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize socket connection
  useEffect(() => {
    const initSocket = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (!token) {
          console.error('No token found for socket connection');
          return;
        }

        const newSocket = io(getBaseUrl(), {
          auth: { token },
          transports: ['websocket'],
          reconnection: true
        });

        newSocket.on('connect', () => {
          console.log('Socket connected in ChatList');
        });

        // Listen for group events
        newSocket.on('group:created', (data) => {
          console.log('New group created:', data);
          fetchConversations();
        });

        newSocket.on('group:member_added', (data) => {
          console.log('Added to group:', data);
          fetchConversations();
        });

        newSocket.on('group:member_removed', (data) => {
          console.log('Removed from group:', data);
          fetchConversations();
        });

        newSocket.on('group:updated', (data) => {
          console.log('Group updated:', data);
          fetchConversations();
        });

        newSocket.on('chat:update', (data) => {
          console.log('Chat update received:', data);
          fetchConversations();
        });

        setSocket(newSocket);

        return () => {
          if (newSocket) {
            newSocket.disconnect();
          }
        };
      } catch (error) {
        console.error('Socket initialization error:', error);
      }
    };

    initSocket();
  }, [fetchConversations]);

  // Initial fetch
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleConversationClick = (conversation) => {
    if (conversation.type === 'group') {
      navigate(`/app/groups/${conversation.groupId}`);
    } else {
      navigate(`/app/chat/${conversation.otherParticipant.phone}`);
    }
  };

  if (loading) return <div className="loading">Đang tải...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="chat-list">
      {conversations.map((conversation) => (
        <div
          key={conversation.conversationId}
          className="conversation-item"
          onClick={() => handleConversationClick(conversation)}
        >
          <div className="conversation-avatar">
            {conversation.type === 'group' ? (
              <img
                src={conversation.groupAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(conversation.groupName)}&background=random`}
                alt={conversation.groupName}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(conversation.groupName)}&background=random`;
                }}
              />
            ) : (
              <img
                src={conversation.otherParticipant.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(conversation.otherParticipant.name)}&background=random`}
                alt={conversation.otherParticipant.name}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(conversation.otherParticipant.name)}&background=random`;
                }}
              />
            )}
          </div>
          <div className="conversation-info">
            <div className="conversation-name">
              {conversation.type === 'group' 
                ? conversation.groupName 
                : conversation.otherParticipant.name || conversation.otherParticipant.phone}
            </div>
            <div className="conversation-preview">
              {conversation.lastMessage?.content || 'Chưa có tin nhắn'}
            </div>
          </div>
          <div className="conversation-meta">
            <div className="conversation-time">
              {conversation.lastMessage?.timestamp 
                ? new Date(conversation.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : ''}
            </div>
            {conversation.unreadCount > 0 && (
              <div className="unread-count">{conversation.unreadCount}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ChatList; 