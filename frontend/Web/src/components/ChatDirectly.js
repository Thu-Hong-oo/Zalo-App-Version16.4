// Optimized ChatDirectly component
import React, { useState, useEffect, useRef, useContext, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import EmojiPicker from "emoji-picker-react";
import {
  ChevronLeft,
  Phone,
  Video,
  Search,
  Settings,
  Smile,
  Image,
  Link,
  UserPlus,
  Sticker,
  Type,
  Zap,
  MoreHorizontal,
  ThumbsUp,
  Send,
  Image as ImageIcon,
  Paperclip,
  ArrowRight,
  Download,
  X,
  FileText,
  File,
  FileImage,
  FileVideo,
  FileArchive,
  AlertCircle,
} from "lucide-react";
import api, { getBaseUrl,getApiUrl } from "../config/api";
import "./css/ChatDirectly.css";
import MessageContextMenu from "./MessageContextMenu";
import ForwardMessageModal from "./ForwardMessageModal";
import ConfirmModal from "../../../Web/src/components/ConfirmModal";

const ChatDirectly = () => {
  const { phone } = useParams();
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [socket, setSocket] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewVideo, setPreviewVideo] = useState(null);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const attachMenuRef = useRef(null);
  const fileInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const navigate = useNavigate();
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    position: { x: 0, y: 0 },
    messageId: null,
    isOwnMessage: false,
  });
  const [forwardModal, setForwardModal] = useState({
    isOpen: false,
    messageContent: "",
    messageId: null,
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: "default",
    title: "",
    message: "",
    onConfirm: () => {},
  });
  const [errorModal, setErrorModal] = useState({
    isOpen: false,
    title: "",
    message: "",
  });

  const extractFilenameFromUrl = (url) => {
    if (!url) return null;
    
    try {
      // Try to get the filename from the URL
      const urlParts = url.split('/');
      const lastPart = urlParts[urlParts.length - 1];
      
      // Check if the URL contains a filename parameter
      const urlParams = new URLSearchParams(url);
      const filenameParam = urlParams.get('filename');
      
      if (filenameParam) {
        return decodeURIComponent(filenameParam);
      }
      
      // If no filename parameter, use the last part of the URL
      return lastPart;
    } catch (error) {
      console.error("Error extracting filename from URL:", error);
      return null;
    }
  };

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target)
      ) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Xử lý đóng context menu khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".message-context-menu")) {
        setContextMenu((prev) => ({ ...prev, visible: false }));
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const fetchUserInfo = async () => {
    try {
      const response = await api.get(`/users/${phone}`);
      if (response.data) setUserInfo(response.data);
    } catch (err) {
      console.error("User info error:", err);
      setError("Không thể tải thông tin người dùng");
    }
  };

  const loadChatHistory = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/chat/history/${phone}`);
      if (res.data.status === "success") {
        const sorted = res.data.data.messages.sort(
          (a, b) => a.timestamp - b.timestamp
        );
        setMessages(sorted);
        scrollToBottom();
      }
    } catch (err) {
      console.error("Chat history error:", err);
      setError("Không thể tải lịch sử chat");
    } finally {
      setLoading(false);
    }
  }, [phone]);

  const scrollToBottom = useCallback(() => {
    const el = messagesEndRef.current;
    if (!el) return;
    const container = el.parentElement;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (isNearBottom) el.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() && !selectedFiles.length) return;

    let tempId = null;
    try {
      if (message.trim()) {
        const currentUserPhone = localStorage.getItem("phone");
        tempId = `temp-${Date.now()}`;
        const newMsg = {
          messageId: tempId,
          senderPhone: currentUserPhone,
          receiverPhone: phone,
          content: message.trim(),
          timestamp: Date.now(),
          status: "sending",
          isTempId: true,
        };

        setMessage("");
        setMessages((prev) => [...prev, newMsg]);
        scrollToBottom();

        socket.emit("send-message", {
          tempId,
          receiverPhone: phone,
          content: newMsg.content,
        });

        socket.once("message-sent", (response) => {
          if (response && response.messageId) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.messageId === tempId
                  ? {
                      ...msg,
                      messageId: response.messageId,
                      isTempId: false,
                      status: "sent",
                    }
                  : msg
              )
            );
          }
        });

        socket.once("error", (error) => {
          console.error("Error sending message:", error);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.messageId === tempId ? { ...msg, status: "error" } : msg
            )
          );
        });
      }

      if (selectedFiles.length > 0) {
        await handleUpload(selectedFiles);
      }
    } catch (err) {
      console.error("Error sending message:", err);
      if (tempId) {
        setMessages((prev) => prev.filter((msg) => msg.messageId !== tempId));
      }
      alert("Không thể gửi tin nhắn. Vui lòng thử lại.");
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }

    const newSocket = io(getBaseUrl(), {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ["websocket"],
      withCredentials: true,
    });

    newSocket.on("connect", () => {
      console.log("Socket connected");
      newSocket.emit("join-chat", { receiverPhone: phone });
    });

    newSocket.on("new-message", (msg) => {
      if (!msg || !msg.messageId) return;

      setMessages((prev) => {
        const exists = prev.some(
          (m) =>
            m.messageId === msg.messageId ||
            (m.content === msg.content &&
              m.senderPhone === msg.senderPhone &&
              Math.abs(m.timestamp - msg.timestamp) < 1000)
        );

        if (exists) return prev;
        return [...prev, { ...msg, status: "received" }];
      });
      scrollToBottom();
    });

    newSocket.on("typing", ({ senderPhone }) => {
      if (senderPhone === phone) {
        setIsTyping(true);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
      }
    });

    newSocket.on("stop_typing", ({ senderPhone }) => {
      if (senderPhone === phone) {
        setIsTyping(false);
      }
    });

    newSocket.on("message-recalled", ({ messageId }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.messageId === messageId
            ? { ...msg, content: "Tin nhắn đã bị thu hồi", status: "recalled" }
            : msg
        )
      );
    });

    newSocket.on("message-deleted", ({ messageId }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.messageId === messageId ? { ...msg, status: "deleted" } : msg
        )
      );
    });

    setSocket(newSocket);

    // Initial load
    fetchUserInfo();
    loadChatHistory();

    return () => {
      if (newSocket) {
        newSocket.emit("leave-chat", { receiverPhone: phone });
        newSocket.disconnect();
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [phone, navigate, loadChatHistory]);

  const handleRecallMessage = async () => {
    try {
      const targetMessage = messages.find(
        (msg) => msg.messageId === contextMenu.messageId
      );

      if (!targetMessage) {
        alert("Không tìm thấy tin nhắn");
        return;
      }

      // Chỉ kiểm tra tin nhắn đang gửi, cho phép thu hồi tin nhắn đã gửi
      if (targetMessage.status === "sending") {
        alert("Không thể thu hồi tin nhắn đang gửi");
        return;
      }

      const response = await api.put("/chat/messages/recall", {
        messageId: targetMessage.messageId,
        receiverPhone: phone,
      });

      if (response.data.status === "success") {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageId === targetMessage.messageId
              ? {
                  ...msg,
                  content: "Tin nhắn đã bị thu hồi",
                  status: "recalled",
                }
              : msg
          )
        );
        setContextMenu((prev) => ({ ...prev, visible: false }));

        // Emit socket event để thông báo cho người nhận
        socket?.emit("message-recalled", {
          messageId: targetMessage.messageId,
          receiverPhone: phone,
        });
      } else {
        throw new Error(response.data.message || "Không thể thu hồi tin nhắn");
      }
    } catch (error) {
      console.error("Error recalling message:", error);
      alert(
        error.response?.data?.message ||
          "Không thể thu hồi tin nhắn. Vui lòng thử lại sau."
      );
    }
  };

  const handleDeleteMessage = async () => {
    const targetMessage = messages.find(
      (msg) => msg.messageId === contextMenu.messageId
    );

    if (!targetMessage) {
      alert("Không tìm thấy tin nhắn");
      return;
    }

    if (targetMessage.isTempId || targetMessage.status === "sending") {
      alert("Không thể xóa tin nhắn đang gửi");
      return;
    }

    setConfirmModal({
      isOpen: true,
      type: "danger",
      title: "Xóa tin nhắn",
      message: "Bạn có chắc chắn muốn xóa tin nhắn này?",
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          const response = await api.delete("/chat/messages/delete", {
            data: {
              messageId: targetMessage.messageId,
            },
          });

          if (response.data.status === "success") {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.messageId === targetMessage.messageId
                  ? { ...msg, status: "deleted" }
                  : msg
              )
            );
            setContextMenu((prev) => ({ ...prev, visible: false }));

            // Emit socket event để thông báo cho người nhận
            socket?.emit("message-deleted", {
              messageId: targetMessage.messageId,
              receiverPhone: phone,
            });
          } else {
            throw new Error(response.data.message || "Không thể xóa tin nhắn");
          }
        } catch (error) {
          console.error("Error deleting message:", error);
          alert(
            error.response?.data?.message ||
              error.message ||
              "Không thể xóa tin nhắn. Vui lòng thử lại sau."
          );
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const showError = (title, message) => {
    setErrorModal({
      isOpen: true,
      title,
      message,
    });
  };

  const closeError = () => {
    setErrorModal({
      isOpen: false,
      title: "",
      message: "",
    });
  };

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);

      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file, file.name);
      });

      const token = localStorage.getItem("accessToken");
      console.log("Starting upload with token:", token);
      console.log("Files to upload:", files);

      const response = await fetch(getApiUrl()+"/chat/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      console.log("Upload response status:", response.status);
      const result = await response.json();
      console.log("Upload result:", result);

      if (result.status === "error") {
        showError("Lỗi Upload", result.message || "Không thể upload file");
        return;
      }

      setUploadProgress(100);

      result.data.urls.forEach((url, index) => {
        const file = files[index];
        const tempId = `temp-${Date.now()}-${index}`;
        
        // Use the exact original filename
        const originalFileName = file.name;
        
        // Append filename to URL for document types
        let fileUrl = url;
        if (file.type.includes('pdf') || 
            file.type.includes('word') || 
            file.type.includes('document') || 
            file.type.includes('powerpoint') || 
            file.type.includes('presentation') ||
            file.type.includes('excel') ||
            file.type.includes('spreadsheet')) {
          // Add filename as a query parameter to the URL
          const separator = url.includes('?') ? '&' : '?';
          fileUrl = `${url}${separator}filename=${encodeURIComponent(originalFileName)}`;
        }
        
        // Thêm tin nhắn vào danh sách ngay lập tức
        const newMessage = {
          messageId: tempId,
          senderPhone: localStorage.getItem("phone"),
          receiverPhone: phone,
          content: fileUrl,
          type: "file",
          fileType: file.type,
          fileName: originalFileName,
          fileSize: file.size,
          timestamp: Date.now(),
          status: "sending",
          isTempId: true,
        };

        setMessages((prev) => [...prev, newMessage]);

        // Gửi tin nhắn qua socket với tên file gốc
        socket.emit("send-message", {
          tempId,
          receiverPhone: phone,
          fileUrl: fileUrl,
          fileType: file.type,
          fileName: originalFileName,
          fileSize: file.size,
        });

        // Lắng nghe phản hồi từ server
        socket.once("message-sent", (response) => {
          if (response && response.messageId) {
            // Cập nhật messageId thật từ server
            setMessages((prev) =>
              prev.map((msg) =>
                msg.messageId === tempId
                  ? {
                      ...msg,
                      messageId: response.messageId,
                      isTempId: false,
                      status: "sent",
                    }
                  : msg
              )
            );
          }
        });

        // Lắng nghe lỗi
        socket.once("error", (error) => {
          console.error("Error sending file message:", error);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.messageId === tempId ? { ...msg, status: "error" } : msg
            )
          );
        });
      });

      setSelectedFiles([]);
      setShowFilePreview(false);
      scrollToBottom();
    } catch (error) {
      console.error("Upload error details:", error);
      showError("Lỗi Upload", "Không thể upload file. Vui lòng thử lại sau.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
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

  const handleImagePreview = (url) => {
    setPreviewImage(url);
    setShowImagePreview(true);
  };

  const handleVideoPreview = (url) => {
    setPreviewVideo(url);
    setShowVideoPreview(true);
  };

  const handleDownloadFile = (url, fileName) => {
    // For document files, use the exact filename from S3 if available
    let downloadFileName = fileName;
    
    if (!downloadFileName && url) {
      // Try to extract the exact filename from the URL
      downloadFileName = extractFilenameFromUrl(url);
    }
    
    // If still no filename, use a default name
    if (!downloadFileName) {
      downloadFileName = 'downloaded-file';
    }
    
    const link = document.createElement('a');
    link.href = url;
    link.download = downloadFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const onEmojiClick = (emojiObject) => {
    const cursor = document.querySelector(".message-input").selectionStart;
    const text =
      message.slice(0, cursor) + emojiObject.emoji + message.slice(cursor);
    setMessage(text);
    setShowEmojiPicker(false);
  };

  const handleAttachClick = () => {
    setShowAttachMenu(!showAttachMenu);
  };

  const handleContextMenu = (e, msg) => {
    e.preventDefault();
    const currentUserPhone = localStorage.getItem("phone");
    const isOwnMessage = msg.senderPhone === currentUserPhone;

    setContextMenu({
      visible: true,
      position: { x: e.clientX, y: e.clientY },
      messageId: msg.messageId,
      isOwnMessage,
      message: msg,
    });
  };

  const handleForwardClick = (msg) => {
    setForwardModal({
      isOpen: true,
      messageContent: msg.content,
      messageId: msg.messageId,
      message: msg,
    });
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleForwardMessage = async (selectedUsers) => {
    try {
      const promises = selectedUsers.map((receiverPhone) =>
        api.post("/chat/messages/forward", {
          messageId: forwardModal.messageId,
          receiverPhone,
          content: forwardModal.messageContent,
        })
      );

      const results = await Promise.all(promises);
      const allSuccessful = results.every(
        (res) => res.data.status === "success"
      );

      if (allSuccessful) {
        setForwardModal({ isOpen: false, messageContent: "", messageId: null });
      }
    } catch (error) {
      console.error("Error forwarding message:", error);
      alert("Không thể chuyển tiếp tin nhắn. Vui lòng thử lại sau.");
    }
  };

  const renderedMessages = useMemo(
    () =>
      messages
        .filter((msg) => {
          // Chỉ ẩn tin nhắn deleted nếu là tin nhắn của người dùng hiện tại
          const currentUserPhone = localStorage.getItem("phone");
          if (msg.status === "deleted" && msg.senderPhone === currentUserPhone) {
            return false;
          }
          return true;
        })
        .map((msg, idx) => {
          const isOther = msg.senderPhone !== localStorage.getItem("phone");
          const isRecalled = msg.status === "recalled";

          return (
            <div
              key={msg.messageId || idx}
              className={`message ${isOther ? "received" : "sent"}`}
              onContextMenu={(e) => handleContextMenu(e, msg)}
            >
              <div
                className={`message-content ${isRecalled ? "recalled" : ""}`}
              >
                {msg.type === "file" ? (
                  <div className="file-message">
                    {msg.fileType?.startsWith("image/") ? (
                      <div className="image-preview" onClick={() => handleImagePreview(msg.content)}>
                        <img src={msg.content} alt="Image" />
                      </div>
                    ) : msg.fileType?.startsWith("video/") ? (
                      <div className="video-preview" onClick={() => handleVideoPreview(msg.content)}>
                        <video src={msg.content} controls />
                      </div>
                    ) : (
                      <div className="document-preview" onClick={() => handleDownloadFile(msg.content, msg.fileName)}>
                        <div className="document-icon">
                          {getFileIcon(msg.fileType)}
                        </div>
                        <div className="document-info">
                          <div className="document-name">
                            {msg.fileName || extractFilenameFromUrl(msg.content) || "File"}
                          </div>
                          <div className="document-size">{formatFileSize(msg.fileSize)}</div>
                        </div>
                        <div className="document-download">
                          <Download size={20} />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p>{msg.content}</p>
                )}
                <div className="message-info">
                  <span className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {!isOther && msg.status === "sending" && (
                    <span className="loading-dot">
                      <span>.</span>
                      <span>.</span>
                      <span>.</span>
                    </span>
                  )}
                  {!isOther && msg.status === "delivered" && (
                    <span className="message-status">Đã nhận</span>
                  )}
                  {isRecalled && (
                    <span className="message-status">Đã thu hồi</span>
                  )}
                </div>
              </div>

              {!isRecalled && (
                <div className="message-actions">
                  <button
                    className="action-button forward"
                    onClick={() => handleForwardClick(msg)}
                    title="Chuyển tiếp"
                  >
                    <ArrowRight size={16} />
                  </button>
                  {!isOther && (
                    <button
                      className="action-button more"
                      onClick={(e) => handleContextMenu(e, msg)}
                      title="Thêm"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        }),
    [messages]
  );

  if (loading) return <div className="loading">Đang tải...</div>;
  if (error) return <div className="error">{error}</div>;

  //layout
  return (
    <div className="chat-directly">
      <div className="chat-header">
        <div className="header-left">
          <button onClick={() => navigate(-1)}>
            <ChevronLeft size={24} />
          </button>
          <div className="user-info">
            {userInfo?.avatar ? (
              <img src={userInfo.avatar} alt="avatar" className="avatar" />
            ) : (
              <div className="avatar-placeholder">
                {userInfo?.name?.slice(0, 2) || phone.slice(0, 2)}
              </div>
            )}
            <div>
              <h3>{userInfo?.name || phone}</h3>
              {isTyping && <p>Đang soạn tin nhắn...</p>}
            </div>
          </div>
        </div>
        <div className="header-actions">
          {[Search, Phone, Video, UserPlus, Settings].map((Icon, i) => (
            <button key={i}>
              <Icon size={20} />
            </button>
          ))}
        </div>
      </div>

      <div className="messages-container">
        <div className="messages-list">
          {renderedMessages}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <MessageContextMenu
        isVisible={contextMenu.visible}
        position={contextMenu.position}
        onClose={() => setContextMenu((prev) => ({ ...prev, visible: false }))}
        onRecall={handleRecallMessage}
        onDelete={handleDeleteMessage}
        onForward={() => handleForwardClick(contextMenu.message)}
        isOwnMessage={contextMenu.isOwnMessage}
        isDeleting={isDeleting}
      />

      <ForwardMessageModal
        isOpen={forwardModal.isOpen}
        onClose={() =>
          setForwardModal({
            isOpen: false,
            messageContent: "",
            messageId: null,
          })
        }
        onForward={handleForwardMessage}
        messageContent={forwardModal.messageContent}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
      />

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

      {/* File preview modal */}
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
                  onClick={() => handleUpload(selectedFiles)}
                  disabled={selectedFiles.length === 0}
                >
                  Gửi
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image preview modal */}
      {showImagePreview && (
        <div className="modal-overlay">
          <div className="image-preview-modal">
            <div className="modal-header">
              <button className="close-button" onClick={() => setShowImagePreview(false)}>
                <X size={24} />
              </button>
              <button 
                className="download-button"
                onClick={() => handleDownloadFile(previewImage, "image.jpg")}
              >
                <Download size={24} />
              </button>
            </div>
            <div className="image-container">
              <img src={previewImage} alt="Preview" />
            </div>
          </div>
        </div>
      )}

      {/* Video preview modal */}
      {showVideoPreview && (
        <div className="modal-overlay">
          <div className="video-preview-modal">
            <div className="modal-header">
              <button className="close-button" onClick={() => setShowVideoPreview(false)}>
                <X size={24} />
              </button>
              <button 
                className="download-button"
                onClick={() => handleDownloadFile(previewVideo, "video.mp4")}
              >
                <Download size={24} />
              </button>
            </div>
            <div className="video-container">
              <video src={previewVideo} controls autoPlay />
            </div>
          </div>
        </div>
      )}

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

        <form onSubmit={handleSendMessage} className="input-form">
          <input
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
            }}
            onBlur={() => socket?.emit("stop_typing", { receiverPhone: phone })}
            placeholder={`Nhập @, tin nhắn tới ${userInfo?.name || phone}`}
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

      {/* Error Modal */}
      {errorModal.isOpen && (
        <div className="error-modal">
          <div className="error-modal-content">
            <div className="error-modal-header">
              <div className="error-icon">
                <AlertCircle />
              </div>
              <h3 className="error-title">{errorModal.title}</h3>
            </div>
            <p className="error-message">{errorModal.message}</p>
            <div className="error-modal-footer">
              <button 
                className="error-modal-button secondary"
                onClick={closeError}
              >
                Đóng
              </button>
              <button 
                className="error-modal-button primary"
                onClick={closeError}
              >
                Thử lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatDirectly;