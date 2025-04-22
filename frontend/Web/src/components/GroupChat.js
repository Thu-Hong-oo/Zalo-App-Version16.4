import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getGroupDetails, sendGroupMessage } from '../services/group';
import EmojiPicker from "emoji-picker-react";
import GroupSidebar from './GroupSidebar';
import {
  Smile,
  Image as ImageIcon,
  Paperclip,
  Type,
  Sticker,
  Zap,
  MoreHorizontal,
  Send,
  X,
  Download,
  FileText,
  File,
  FileImage,
  FileVideo,
  FileArchive,
  AlertCircle,
  ChevronLeft,
  Users,
  Video,
  Search,
  Bell,
  UserPlus,
  Settings,
  ChevronDown,
  Link as LinkIcon,
  Copy,
  Share2,
  Clock,
  FileEdit,
  Info,
  Sidebar
} from "lucide-react";
import './css/GroupChat.css';

const GroupChat = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [groupDetails, setGroupDetails] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add new states for file handling
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewVideo, setPreviewVideo] = useState(null);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const emojiPickerRef = useRef(null);
  const fileInputRef = useRef(null);
  const documentInputRef = useRef(null);

  const [showSidebar, setShowSidebar] = useState(false);
  const [showMembersList, setShowMembersList] = useState(true);
  const [showGroupInfo, setShowGroupInfo] = useState(true);
  const [showMediaList, setShowMediaList] = useState(true);

  useEffect(() => {
    fetchGroupDetails();
  }, [groupId]);

  const fetchGroupDetails = async () => {
    try {
      console.log(`Fetching group details for group ID: ${groupId}`);
      const response = await getGroupDetails(groupId);
      console.log('Group details response:', response);
      
      if (response.status === 'success') {
        setGroupDetails(response.data);
        setLoading(false);
      } else {
        throw new Error('Không nhận được dữ liệu từ server');
      }
    } catch (err) {
      console.error('Error fetching group details:', err);
      setError('Không thể tải thông tin nhóm. Vui lòng thử lại sau.');
      setLoading(false);
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const sendMessage = async () => {
    if (!message.trim()) return;

    try {
      console.log(`Sending message to group ${groupId}: ${message}`);
      const response = await sendGroupMessage(groupId, message);
      
      if (response.status === 'success') {
        setMessages(prevMessages => [...prevMessages, response.data]);
        setMessage('');
      } else {
        throw new Error('Không nhận được dữ liệu từ server');
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Không thể gửi tin nhắn. Vui lòng thử lại sau.');
    }
  };

  const handleBack = () => {
    navigate('/app');
  };

  const handleAddMembers = () => {
    navigate(`/app/groups/${groupId}/add-members`);
  };

  const handleSearchMessages = () => {
    navigate(`/app/groups/${groupId}/search`);
  };

  const onEmojiClick = (emojiObject) => {
    const cursor = document.querySelector(".message-input").selectionStart;
    const text = message.slice(0, cursor) + emojiObject.emoji + message.slice(cursor);
    setMessage(text);
    setShowEmojiPicker(false);
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    if (files.length > 0) {
      setSelectedFiles(files);
      setShowFilePreview(true);
    }
  };

  const handleImageClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleDocumentClick = () => {
    if (documentInputRef.current) {
      documentInputRef.current.click();
    }
  };

  const handleFilePreviewClose = () => {
    setShowFilePreview(false);
    setSelectedFiles([]);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType) => {
    if (mimeType.includes('image')) return <FileImage size={24} />;
    if (mimeType.includes('video')) return <FileVideo size={24} />;
    if (mimeType.includes('pdf')) return <FileText size={24} />;
    if (mimeType.includes('word') || mimeType.includes('document')) return <FileText size={24} />;
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return <FileText size={24} />;
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return <FileArchive size={24} />;
    return <File size={24} />;
  };

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error">{error}</div>
        <button className="retry-button" onClick={fetchGroupDetails}>
          Thử lại
        </button>
        <button className="back-button" onClick={handleBack}>
          Quay lại
        </button>
      </div>
    );
  }

  return (
    <div className="group-chat-container">
      <div className={`chat-main ${showSidebar ? 'with-sidebar' : ''}`}>
        <header className="group-chat-header">
          <button className="back-button" onClick={handleBack}>
            <ChevronLeft size={24} />
          </button>
          <div className="header-title">
            <h1>{groupDetails?.name}</h1>
            <p>{groupDetails?.members?.length || 0} thành viên</p>
          </div>
          <div className="header-actions">
            <button className="header-button" onClick={handleAddMembers}>
              <UserPlus size={20} />
            </button>
            <button className="header-button">
              <Video size={20} />
            </button>
            <button className="header-button" onClick={handleSearchMessages}>
              <Search size={20} />
            </button>
            <button 
              className={`header-button ${showSidebar ? 'active' : ''}`}
              onClick={() => setShowSidebar(!showSidebar)}
            >
              <Sidebar size={20} />
            </button>
          </div>
        </header>

        <div className="messages-container">
          <div className="group-info-card">
            <div className="group-avatars">
              {groupDetails?.avatar ? (
                <img 
                  src={groupDetails.avatar} 
                  alt={groupDetails.name}
                  className="group-main-avatar"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(groupDetails?.name || '')}&background=random&color=fff&size=96`;
                  }}
                />
              ) : (
                <div className="group-main-avatar default-group-avatar">
                  <Users size={40} color="#65676B" />
                </div>
              )}
            </div>
            <h2 className="group-card-title">{groupDetails?.name}</h2>
            <p className="group-card-subtitle">
              Bắt đầu chia sẻ những câu chuyện thú vị cùng nhau
            </p>
          </div>

          <div className="time-indicator">
            <span className="time-text">
              {formatTime(groupDetails?.createdAt)}
            </span>
          </div>

          {messages.map(msg => (
            <div key={msg.id} className="system-message-container">
              <div className="system-message-avatars">
                {msg.memberAvatars?.map((avatarUri, index) => (
                  <img 
                    key={`sys-avatar-${index}`}
                    src={avatarUri}
                    alt={`Member ${index + 1}`}
                    className="system-message-avatar"
                  />
                ))}
              </div>
              <p className="system-message-text">
                <strong>{msg.memberNames}</strong> đã tham gia nhóm
              </p>
            </div>
          ))}

          <div className="setup-card">
            <div className="setup-avatar-container">
              <div className="setup-avatar">
                {groupDetails?.avatar ? (
                  <img 
                    src={groupDetails.avatar} 
                    alt={groupDetails.name}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(groupDetails?.name || '')}&background=random&color=fff&size=40`;
                    }}
                  />
                ) : (
                  <Users size={24} color="#65676B" />
                )}
              </div>
              <span className="setup-title">{groupDetails?.name}</span>
              <i className="chevron-icon">›</i>
            </div>

            
            <div className="member-avatars">
              {groupDetails?.members?.map((member, index) => (
                <img 
                  key={`setup-avatar-${member.userId || index}`}
                  src={member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name || '')}&background=random&color=fff&size=40`}
                  alt={`Member ${index + 1}`}
                  className="member-avatar"
                  style={{ zIndex: (groupDetails.members?.length || 0) - index }}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name || '')}&background=random&color=fff&size=40`;
                  }}
                />
              ))}
              <button className="add-member-button" onClick={handleAddMembers}>
                <i className="person-add-icon">+</i>
              </button>
            </div>

            <button className="wave-button">
              👋 Vẫy tay chào
            </button>

            <button className="qr-button">
              Xem mã QR tham gia nhóm
            </button>
          </div>
        </div>

        {/* File upload inputs */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="image/*,video/*"
          multiple
          onChange={handleFileSelect}
        />
        <input
          type="file"
          ref={documentInputRef}
          style={{ display: 'none' }}
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.rar"
          multiple
          onChange={handleFileSelect}
        />

        <div className="chat-input-area">
          <div className="input-toolbar">
            <div className="toolbar-left">
              <div className="emoji-wrapper" ref={emojiPickerRef}>
                <button
                  type="button"
                  className="toolbar-button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >
                  <Smile size={20} />
                </button>
                {showEmojiPicker && (
                  <div className="emoji-picker-container">
                    <EmojiPicker
                      onEmojiClick={onEmojiClick}
                      width={300}
                      height={400}
                    />
                  </div>
                )}
              </div>
              <button 
                type="button" 
                className="toolbar-button"
                onClick={handleImageClick}
                title="Gửi ảnh hoặc video"
              >
                <ImageIcon size={20} />
              </button>
              <button 
                type="button" 
                className="toolbar-button"
                onClick={handleDocumentClick}
                title="Gửi tài liệu"
              >
                <Paperclip size={20} />
              </button>
              <button type="button" className="toolbar-button">
                <Type size={20} />
              </button>
              <button type="button" className="toolbar-button">
                <Sticker size={20} />
              </button>
              <button type="button" className="toolbar-button">
                <Zap size={20} />
              </button>
              <button type="button" className="toolbar-button">
                <MoreHorizontal size={20} />
              </button>
            </div>
          </div>

          <form  className="input-form">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Nhập @, tin nhắn tới ${groupDetails?.name || 'Nhóm'}`}
              className="message-input"
            />
            <div className="input-buttons">
              <button
                type="submit"
                className="send-button"
                disabled={!message.trim() && selectedFiles.length === 0}
              >
                <Send size={20} color={(message.trim() || selectedFiles.length > 0) ? "#1877f2" : "#666"} />
              </button>
            </div>
          </form>
        </div>
      </div>

      <GroupSidebar 
        groupId={groupId}
        isOpen={showSidebar}
        onClose={() => setShowSidebar(false)}
        onGroupUpdate={fetchGroupDetails}
      />

      {showFilePreview && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Đã chọn {selectedFiles.length} file</h3>
              <button className="close-button" onClick={handleFilePreviewClose}>
                <X size={24} />
              </button>
            </div>
            <div className="file-list">
              {selectedFiles.map((file, index) => (
                <div key={index} className="file-item">
                  <div className="file-icon">
                    {getFileIcon(file.type)}
                  </div>
                  <div className="file-info">
                    <div className="file-name">{file.name}</div>
                    <div className="file-size">{formatFileSize(file.size)}</div>
                  </div>
                  <button
                    className="remove-file-button"
                    onClick={() => {
                      const newFiles = [...selectedFiles];
                      newFiles.splice(index, 1);
                      setSelectedFiles(newFiles);
                      if (newFiles.length === 0) {
                        setShowFilePreview(false);
                      }
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>
              ))}
            </div>
            {isUploading ? (
              <div className="upload-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <div className="progress-text">Đang upload... {uploadProgress}%</div>
              </div>
            ) : (
              <div className="modal-actions">
                <button 
                  className="cancel-button"
                  onClick={handleFilePreviewClose}
                >
                  Hủy
                </button>
                <button 
                  className="send-button"
                 // onClick={() => handleUpload(selectedFiles)}
                  disabled={selectedFiles.length === 0}
                >
                  Gửi
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupChat; 