import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useContext } from "react";
import { SocketContext } from "../App"; 
import {
  getGroupDetails,
  getGroupMessages,
  sendGroupMessage,
  recallGroupMessage,
  deleteGroupMessage,
  forwardGroupMessage,
  uploadFiles,
} from "../services/group";
import EmojiPicker from "emoji-picker-react";
import GroupSidebar from "./GroupSidebar";
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
  Sidebar,
  Check,
  CheckCheck,
} from "lucide-react";
import "./css/GroupChat.css";
import api, { getBaseUrl, getApiUrl } from "../config/api";

const GroupChat = ({ selectedChat }) => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [groupDetails, setGroupDetails] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [recalledMessages, setRecalledMessages] = useState(new Set());
  const [deletedMessages, setDeletedMessages] = useState(new Set());
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showMessageOptions, setShowMessageOptions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewVideo, setPreviewVideo] = useState(null);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showMembersList, setShowMembersList] = useState(true);
  const [showGroupInfo, setShowGroupInfo] = useState(true);
  const [showMediaList, setShowMediaList] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastReadMessageId, setLastReadMessageId] = useState(null);
  const messagesEndRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const fileInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [lastEvaluatedKey, setLastEvaluatedKey] = useState(null);
  const [userCache, setUserCache] = useState({});
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [uploadErrors, setUploadErrors] = useState([]);
  const [fullscreenMedia, setFullscreenMedia] = useState(null);
  const socket = useContext(SocketContext);
  const [groupUpdates, setGroupUpdates] = useState(null);

  useEffect(() => {
    fetchGroupDetails();
    loadChatHistory();
    getCurrentUserId();

    // Join group when component mounts
    if (socket && groupId) {
      socket.emit("join-group", groupId);
      // Mark messages as read when joining group
      markMessagesAsRead();
    }

    // Set up socket event listeners
    if (socket) {
      socket.on("new-group-message", async (newMessage) => {
        try {
          console.log("Received new message from socket:", newMessage);

          if (newMessage.groupId === groupId) {
            // Nếu tin nhắn không phải của người dùng hiện tại, lấy thông tin người gửi
            if (newMessage.senderId !== currentUserId) {
              const senderInfo = await fetchUserInfo(newMessage.senderId);
              newMessage = {
                ...newMessage,
                senderName: senderInfo.name,
                senderAvatar: senderInfo.avatar,
              };

              setMessages((prev) => {
                // Kiểm tra xem tin nhắn đã tồn tại chưa
                const existingMessage = prev.find(
                  (msg) => msg.groupMessageId === newMessage.groupMessageId
                );

                if (existingMessage) {
                  return prev;
                }

                return [...prev, newMessage].sort(
                  (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
                );
              });
              scrollToBottom();
            }
            // Luôn mark as read khi có tin nhắn mới trong phòng đang mở
            markMessagesAsRead();
          }
        } catch (error) {
          console.error("Error handling new message:", error);
        }
      });

      socket.on("group-message-recalled", (recallData) => {
        if (recallData.groupId === groupId) {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.groupMessageId === recallData.messageId) {
                return {
                  ...msg,
                  content: "Tin nhắn đã bị thu hồi",
                  status: "recalled",
                  metadata: {
                    ...msg.metadata,
                    recalledBy: recallData.recalledBy,
                    recalledAt: recallData.recalledAt,
                  },
                };
              }
              return msg;
            })
          );
        }
      });

      socket.on("group-message-deleted", (deleteData) => {
        console.log("Received delete event:", deleteData);
        if (deleteData.groupId === groupId) {
          // Remove message from UI for all users
          setMessages((prev) =>
            prev.filter(
              (msg) => msg.groupMessageId !== deleteData.deletedMessageId
            )
          );
          console.log("Message removed:", deleteData.deletedMessageId);
        }
      });

      socket.on("user-joined", ({ userId, metadata }) => {
        // Handle user joined event
        console.log(`User ${userId} joined the group`);
      });

      socket.on("user-left", ({ userId }) => {
        // Handle user left event
        console.log(`User ${userId} left the group`);
      });

      socket.on("error", ({ message }) => {
        setError(message);
      });

      // Add new socket event for unread count
      socket.on("group-history", ({ messages, unreadCount }) => {
        setUnreadCount(unreadCount);
      });
    }

    // Cleanup on unmount
    return () => {
      if (socket && groupId) {
        socket.emit("leave-group", groupId);
        socket.off("new-group-message");
        socket.off("group-message-recalled");
        socket.off("group-message-deleted");
        socket.off("user-joined");
        socket.off("user-left");
        socket.off("error");
        socket.off("group-history");
      }
    };
  }, [socket, groupId]);

  // Load lastReadMessageId from localStorage when component mounts
  useEffect(() => {
    const storedLastRead = localStorage.getItem(`lastRead_${groupId}`);
    if (storedLastRead) {
      setLastReadMessageId(storedLastRead);
    }
  }, [groupId]);

  // Save lastReadMessageId to localStorage when it changes
  useEffect(() => {
    if (lastReadMessageId) {
      localStorage.setItem(`lastRead_${groupId}`, lastReadMessageId);
    }
  }, [lastReadMessageId, groupId]);

  const getCurrentUserId = async () => {
    try {
      const token = localStorage.getItem("accessToken");
      if (!token) {
        throw new Error("No token found");
      }
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join("")
      );
      const { userId } = JSON.parse(jsonPayload);
      setCurrentUserId(userId);
    } catch (error) {
      console.error("Error getting current user ID:", error);
    }
  };

  const fetchGroupDetails = async () => {
    try {
      console.log(`Fetching group details for group ID: ${groupId}`);
      const response = await getGroupDetails(groupId);
      console.log("Group details response:", response);

      if (response.status === "success") {
        setGroupDetails(response.data);
        setLoading(false);
      } else {
        throw new Error("Không nhận được dữ liệu từ server");
      }
    } catch (err) {
      console.error("Error fetching group details:", err);
      setError("Không thể tải thông tin nhóm. Vui lòng thử lại sau.");
      setLoading(false);
    }
  };

  const fetchUserInfo = async (userId) => {
    try {
      // Check cache first
      if (userCache[userId]) {
        return userCache[userId];
      }

      const response = await api.get(`/users/byId/${userId}`);
      console.log("User info response:", response);

      if (!response.data) {
        throw new Error("Không nhận được dữ liệu từ server");
      }

      const userData = {
        userId: response.data.userId,
        name: response.data.name,
        avatar: response.data.avatar,
        phone: response.data.phone,
        status: response.data.status,
        gender: response.data.gender,
        isPhoneVerified: response.data.isPhoneVerified,
        dateOfBirth: response.data.dateOfBirth,
        createdAt: response.data.createdAt,
        updatedAt: response.data.updatedAt,
      };

      // Update cache
      setUserCache((prev) => ({
        ...prev,
        [userId]: userData,
      }));

      return userData;
    } catch (error) {
      console.error("Get user info error:", error);
      return null;
    }
  };

  const loadChatHistory = async (loadMore = false) => {
    try {
      const options = {
        limit: 50,
        before: true,
      };

      if (loadMore && messages.length > 0) {
        const lastMessage = messages[0];
        options.lastEvaluatedKey = lastMessage.createdAt;
      }

      const response = await getGroupMessages(groupId, options);
      console.log("Chat history response:", response);

      if (response.status === "success") {
        // Xử lý các tin nhắn theo ngày
        const messageArray = await Promise.all(
          Object.entries(response.data.messages).flatMap(([date, messages]) =>
            messages.map(async (msg) => {
              const isMe = msg.senderId === currentUserId;

              // Nếu là tin nhắn của người khác, fetch thông tin người gửi
              let senderInfo = {};
              if (!isMe) {
                const userInfo = await fetchUserInfo(msg.senderId);
                if (userInfo) {
                  senderInfo = {
                    senderName: userInfo.name,
                    senderAvatar: userInfo.avatar,
                    senderPhone: userInfo.phone,
                    senderStatus: userInfo.status,
                    senderGender: userInfo.gender,
                  };
                }
              }

              return {
                ...msg,
                ...senderInfo,
                status: msg.status || "sent",
                isMe,
              };
            })
          )
        );

        // Filter out messages that have been recalled or deleted
        const filteredMessages = messageArray.filter((msg) => {
          if (msg.type === 'system') return true; // luôn giữ lại system message
          const isRecalled = msg.recallStatus === "recalled";
          const isDeleted =
            msg.deleteStatus === "deleted" && msg.deletedBy === currentUserId;
          return !isRecalled && !isDeleted;
        });

        if (loadMore) {
          setMessages((prev) => {
            const messageMap = new Map();
            prev.forEach((msg) => {
              messageMap.set(msg.groupMessageId, msg);
            });
            filteredMessages.forEach((msg) => {
              messageMap.set(msg.groupMessageId, msg);
            });
            return Array.from(messageMap.values()).sort(
              (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
            );
          });
        } else {
          setMessages(
            filteredMessages.sort(
              (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
            )
          );
        }

        setHasMoreMessages(response.data.pagination?.hasMore || false);
        if (response.data.pagination?.lastEvaluatedKey) {
          setLastEvaluatedKey(response.data.pagination.lastEvaluatedKey);
        }
      } else {
        throw new Error("Không nhận được dữ liệu từ server");
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
      setError("Không thể tải tin nhắn. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return null;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadErrors([]);

    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("files", file);
      });

      const response = await uploadFiles(groupId, formData, (progress) => {
        console.log("Upload progress:", progress);
        setUploadProgress(progress);
      });

      if (response && response.status === "success" && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      console.error("Error uploading files:", error);
      setUploadErrors((prev) => [...prev, error.message]);
      return null;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() && selectedFiles.length === 0) return;

    try {
      setIsUploading(true);
      let fileData = null;

      if (selectedFiles.length > 0) {
        const uploadResult = await handleFileUpload(selectedFiles);
        if (uploadResult) {
          fileData = uploadResult;
        }
      }

      if (fileData) {
        // Send message for each uploaded file
        for (const file of fileData) {
          const tempId = `temp-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 9)}`;

          // First save to database
          const response = await sendGroupMessage(
            groupId,
            file.url,
            "file",
            file.type
          );

          if (response.status === "success") {
            const messageData = {
              groupId,
              groupMessageId: response.data.groupMessageId,
              senderId: currentUserId,
              content: file.url,
              fileUrl: file.url,
              fileType: file.type,
              fileName: file.name,
              fileSize: file.size,
              type: "file",
              createdAt: new Date().toISOString(),
              status: "sent",
            };

            // Add message to UI
            setMessages((prev) =>
              [...prev, messageData].sort(
                (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
              )
            );

            // Emit socket event with the same format as mobile
            socket.emit("new-group-message", messageData);

            // Update group's lastMessage
            try {
              const lastMessageData = {
                lastMessage: {
                  content: `[File] ${file.type}`,
                  type: "file",
                  senderId: currentUserId,
                  timestamp: messageData.createdAt,
                  fileType: file.type
                },
                lastMessageAt: messageData.createdAt
              };
              
              await api.put(
                `/groups/${groupId}`,
                lastMessageData
              );
              
              if (socket) {
                socket.emit("group:updated", {
                  groupId,
                  type: "LAST_MESSAGE_UPDATED",
                  data: {
                    ...lastMessageData.lastMessage,
                    lastMessageAt: messageData.createdAt
                  }
                });
              }
            } catch (error) {
              console.error("Error updating group's lastMessage:", error);
            }
          }
        }
      } else if (message.trim()) {
        const tempId = `temp-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        // First save to database
        const response = await sendGroupMessage(groupId, message.trim());

        if (response.status === "success") {
          const messageData = {
            groupId,
            groupMessageId: response.data.groupMessageId,
            senderId: currentUserId,
            content: message.trim(),
            type: "text",
            createdAt: new Date().toISOString(),
            status: "sent",
          };

          // Add message to UI
          setMessages((prev) =>
            [...prev, messageData].sort(
              (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
            )
          );

          // Emit socket event with the same format as mobile
          socket.emit("new-group-message", messageData);

          // Update group's lastMessage
          try {
            const lastMessageData = {
              lastMessage: {
                content: message.trim(),
                type: "text",
                senderId: currentUserId,
                timestamp: messageData.createdAt
              },
              lastMessageAt: messageData.createdAt
            };
            
            await api.put(
              `/groups/${groupId}`,
              lastMessageData
            );
            
            if (socket) {
              socket.emit("group:updated", {
                groupId,
                type: "LAST_MESSAGE_UPDATED",
                data: {
                  ...lastMessageData.lastMessage,
                  lastMessageAt: messageData.createdAt
                }
              });
            }
          } catch (error) {
            console.error("Error updating group's lastMessage:", error);
          }
        }
      }

      setMessage("");
      setSelectedFiles([]);
      setFilePreviews([]);
      scrollToBottom();
    } catch (error) {
      console.error("Error sending message:", error);
      setError("Không thể gửi tin nhắn. Vui lòng thử lại.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRecallMessage = async (messageId) => {
    try {
      socket.emit("recall-group-message", {
        groupId,
        messageId,
      });
    } catch (error) {
      console.error("Error recalling message:", error);
      setError("Failed to recall message");
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      const response = await deleteGroupMessage(groupId, messageId);
      if (response.status === "success") {
        // Remove message from UI immediately
        setMessages((prev) =>
          prev.filter((msg) => msg.groupMessageId !== messageId)
        );

        // Emit socket event for deletion
        socket.emit("delete-group-message", {
          groupId,
          messageId,
          deletedBy: currentUserId,
        });
      }
    } catch (error) {
      console.error("Error deleting message:", error);
      setError("Failed to delete message");
    }
  };

  const handleForwardMessage = async (receiverPhones) => {
    if (!selectedMessage) return;

    try {
      const response = await forwardGroupMessage(
        groupId,
        selectedMessage.groupMessageId,
        receiverPhones,
        "phone"
      );

      if (response.status === "success") {
        setSelectedMessage(null);
        setShowMessageOptions(false);
      }
    } catch (error) {
      console.error("Error forwarding message:", error);
      setError("Failed to forward message");
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (mimeType) => {
    if (mimeType.includes("image")) return <FileImage size={24} />;
    if (mimeType.includes("video")) return <FileVideo size={24} />;
    if (mimeType.includes("pdf")) return <FileText size={24} />;
    if (mimeType.includes("word") || mimeType.includes("document"))
      return <FileText size={24} />;
    if (mimeType.includes("powerpoint") || mimeType.includes("presentation"))
      return <FileText size={24} />;
    if (
      mimeType.includes("zip") ||
      mimeType.includes("rar") ||
      mimeType.includes("archive")
    )
      return <FileArchive size={24} />;
    return <File size={24} />;
  };

  const renderFileMessage = (message) => {
    const fileType = message.fileType || "";
    const isImage = fileType.startsWith("image/");
    const isVideo = fileType.startsWith("video/");
    const fileUrl = message.fileUrl || message.content;

    // Extract filename from S3 URL if no fileName is provided
    let displayFileName = message.fileName;
    if (!displayFileName && fileUrl) {
      try {
        // Extract filename from URL (assumes URL format like https://media-zalolite.s3.ap-southeast-1.amazonaws.com/filename.ext)
        const urlParts = fileUrl.split("/");
        displayFileName = decodeURIComponent(urlParts[urlParts.length - 1]);
      } catch (error) {
        console.error("Error extracting filename from URL:", error);
        displayFileName = "Unknown file";
      }
    }

    return (
      <div className="file-message">
        {isImage ? (
          <img
            src={fileUrl}
            alt={displayFileName}
            onClick={() => setFullscreenMedia({ type: "image", url: fileUrl })}
          />
        ) : isVideo ? (
          <video
            controls
            onClick={() => setFullscreenMedia({ type: "video", url: fileUrl })}
          >
            <source src={fileUrl} type={fileType} />
            Your browser does not support the video tag.
          </video>
        ) : (
          <div className="file-info">
            <div className="file-icon">{getFileIcon(fileType)}</div>
            <div className="file-details">
              <div className="file-name" title={displayFileName}>
                {displayFileName}
              </div>
              <div className="file-size">
                {message.fileSize ? formatFileSize(message.fileSize) : ""}
              </div>
            </div>
            <a
              href={fileUrl}
              download={displayFileName}
              className="download-button"
              onClick={(e) => e.stopPropagation()}
            >
              <Download size={16} />
              <span>Tải xuống</span>
            </a>
          </div>
        )}
      </div>
    );
  };

  const renderFullscreenModal = () => {
    if (!fullscreenMedia) return null;

    return (
      <div
        className="fullscreen-modal"
        onClick={() => setFullscreenMedia(null)}
      >
        <div
          className="fullscreen-content"
          onClick={(e) => e.stopPropagation()}
        >
          {fullscreenMedia.type === "image" ? (
            <img src={fullscreenMedia.url} alt="Fullscreen" />
          ) : (
            <video controls autoPlay>
              <source src={fullscreenMedia.url} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          )}
          <button
            className="close-fullscreen"
            onClick={() => setFullscreenMedia(null)}
          >
            <X size={20} />
          </button>
        </div>
      </div>
    );
  };

  const renderMessage = (msg) => {
    if (msg.type === 'system') {
      let icon = null;
      if (msg.content.toLowerCase().includes('tên nhóm')) {
        icon = <FileEdit size={13} color="#2e89ff" style={{ marginRight: 6 }} />;
      } else if (msg.content.toLowerCase().includes('avatar') || msg.content.toLowerCase().includes('ảnh đại diện')) {
        icon = <ImageIcon size={13} color="#2e89ff" style={{ marginRight: 6 }} />;
      } else {
        icon = <Info size={13} color="#2e89ff" style={{ marginRight: 6 }} />;
      }
      return (
        <div className="system-message">
          {icon}
          <span dangerouslySetInnerHTML={{ __html: msg.content }} />
        </div>
      );
    }
    const isMe = msg.senderId === currentUserId;
    const isRecalled = msg.status === "recalled";
    const isUnread = unreadCount > 0 && msg.groupMessageId === lastReadMessageId;

    return (
      <div
        key={msg.groupMessageId}
        className={`message-container ${isMe ? "my-message" : "other-message"} ${
          isUnread ? "unread" : ""
        }`}
        onContextMenu={(e) => {
          e.preventDefault();
          setSelectedMessage(msg);
          setShowMessageOptions(true);
        }}
      >
        {!isMe && (
          <img
            src={msg.senderAvatar || "https://ui-avatars.com/api/?name=User"}
            alt="avatar"
            className="avatar"
          />
        )}
        <div
          className={`message-bubble ${
            isMe ? "my-message-bubble" : "other-message-bubble"
          }`}
        >
          {!isMe && <div className="sender-name">{msg.senderName}</div>}
          {isRecalled ? (
            <div className="recalled-message">
              <AlertCircle size={16} />
              <span>Tin nhắn đã bị thu hồi</span>
            </div>
          ) : msg.fileType ? (
            renderFileMessage(msg)
          ) : (
            <div className="message-text">{msg.content}</div>
          )}
          <div className="message-footer">
            <span className="message-time">{formatTime(msg.createdAt)}</span>
            {isMe && (
              <div className="message-status">
                {msg.status === "sent" && <Clock size={12} />}
                {msg.status === "delivered" && <Check size={12} />}
                {msg.status === "read" && <CheckCheck size={12} />}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);

    // Create previews for selected files
    const previews = files.map((file) => {
      const preview = {
        type: file.type.startsWith("image/")
          ? "image"
          : file.type.startsWith("video/")
          ? "video"
          : "file",
        name: file.name,
        size: file.size,
        file: file,
      };

      if (preview.type === "image" || preview.type === "video") {
        preview.url = URL.createObjectURL(file);
      }

      return preview;
    });

    setFilePreviews(previews);
  };

  const removeFile = (index) => {
    const newFiles = [...selectedFiles];
    const newPreviews = [...filePreviews];

    // Revoke object URL to prevent memory leaks
    if (newPreviews[index].url) {
      URL.revokeObjectURL(newPreviews[index].url);
    }

    newFiles.splice(index, 1);
    newPreviews.splice(index, 1);

    setSelectedFiles(newFiles);
    setFilePreviews(newPreviews);
  };

  const renderFilePreview = (preview, index) => {
    return (
      <div key={index} className="file-preview">
        {preview.type === "image" ? (
          <img src={preview.url} alt={preview.name} />
        ) : preview.type === "video" ? (
          <video src={preview.url} controls />
        ) : (
          <div className="file-icon">
            <FileText size={24} />
          </div>
        )}
        <div className="file-info">
          <span className="file-name">{preview.name}</span>
          <span className="file-size">{formatFileSize(preview.size)}</span>
        </div>
        <button className="remove-file" onClick={() => removeFile(index)}>
          <X size={16} />
        </button>
      </div>
    );
  };

  // Add new function to mark messages as read
  const markMessagesAsRead = async () => {
    try {
      const response = await api.post(`/chat-group/${groupId}/read`);
      if (response.status === 200) {
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  };

  // Update useEffect for socket connection
  useEffect(() => {
    fetchGroupDetails();
    loadChatHistory();
    getCurrentUserId();

    // Join group when component mounts
    if (socket && groupId) {
      socket.emit("join-group", groupId);
      // Mark messages as read when joining group
      markMessagesAsRead();
    }

    // ... existing socket event listeners ...

    // Add new socket event for unread count
    if (socket) {
      socket.on("group-history", ({ messages, unreadCount }) => {
        setUnreadCount(unreadCount);
      });
    }

    // Cleanup on unmount
    return () => {
      if (socket && groupId) {
        socket.emit("leave-group", groupId);
        socket.off("new-group-message");
        socket.off("group-message-recalled");
        socket.off("group-message-deleted");
        socket.off("user-joined");
        socket.off("user-left");
        socket.off("error");
        socket.off("group-history");
      }
    };
  }, [socket, groupId]);

  // Update handleScroll to mark messages as read when scrolling to bottom
  const handleScroll = () => {
    const element = messagesEndRef.current;
    if (element) {
      const { scrollTop, scrollHeight, clientHeight } = element;
      if (scrollHeight - scrollTop === clientHeight) {
        markMessagesAsRead();
      }
    }
  };

  useEffect(() => {
    if (!groupUpdates || groupUpdates.groupId !== groupId) return;

    // Gọi lại API để lấy thông tin nhóm mới nhất khi có cập nhật
    fetchGroupDetails();

    // Có thể thêm thông báo hệ thống nếu muốn
    if (groupUpdates.type === 'NAME_UPDATED') {
      setMessages(prev => [...prev, {
        type: 'system',
        content: `Tên nhóm đã đổi thành ${groupUpdates.data.name}`,
        createdAt: new Date().toISOString()
      }]);
    }
    if (groupUpdates.type === 'AVATAR_UPDATED') {
      setMessages(prev => [...prev, {
        type: 'system',
        content: `Avatar nhóm đã được cập nhật.`,
        createdAt: new Date().toISOString()
      }]);
    }
    // Có thể bổ sung các loại event khác
  }, [groupUpdates, groupId]);

  useEffect(() => {
    if (!socket || !groupId) return;

    // Lắng nghe event cập nhật nhóm
    const handleGroupUpdated = (payload) => {
      if (payload.groupId === groupId) {
        fetchGroupDetails(); // Gọi lại API lấy thông tin mới nhất
        // Có thể thêm thông báo hệ thống nếu muốn
        if (payload.type === 'NAME_UPDATED') {
          setMessages(prev => [...prev, {
            type: 'system',
            content: `Tên nhóm đã đổi thành ${payload.data.name}`,
            createdAt: new Date().toISOString()
          }]);
        }
        if (payload.type === 'AVATAR_UPDATED') {
          setMessages(prev => [...prev, {
            type: 'system',
            content: `Avatar nhóm đã được cập nhật.`,
            createdAt: new Date().toISOString()
          }]);
        }
        // Có thể bổ sung các loại event khác
      }
    };
    socket.on('group:updated', handleGroupUpdated);

    return () => {
      socket.off('group:updated', handleGroupUpdated);
    };
  }, [socket, groupId]);

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error">{error}</div>
        <button
          className="retry-button"
          onClick={() => {
            setError(null);
            fetchGroupDetails();
            loadChatHistory();
          }}
        >
          Thử lại
        </button>
        <button className="back-button" onClick={() => navigate("/app")}>
          Quay lại
        </button>
      </div>
    );
  }

  return (
    <div className="group-chat-container">
      <div className={`chat-main ${showSidebar ? "with-sidebar" : ""}`}>
        <header className="group-chat-header">
          <button className="back-button" onClick={() => navigate("/app")}>
            <ChevronLeft size={24} />
          </button>
          <div className="header-title">
            <h1>{groupDetails?.name}</h1>
            <p>{groupDetails?.members?.length || 0} thành viên</p>
          </div>
          <div className="header-actions">
            <button
              className="header-button"
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
                  className="group-avatar"
                />
              ) : (
                <div className="group-avatar default-group-avatar">
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

          {messages.map((msg, idx) => (
            <React.Fragment key={msg.groupMessageId || msg.createdAt || idx}>
              {renderMessage(msg)}
            </React.Fragment>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          {filePreviews.length > 0 && (
            <div className="file-previews">
              {filePreviews.map((preview, index) =>
                renderFilePreview(preview, index)
              )}
            </div>
          )}

          {isUploading && (
            <div className="upload-progress">
              <div
                className="progress-bar"
                style={{ width: `${uploadProgress}%` }}
              ></div>
              <span>{uploadProgress}%</span>
            </div>
          )}

          {uploadErrors.length > 0 && (
            <div className="upload-errors">
              {uploadErrors.map((error, index) => (
                <div key={index} className="error-message">
                  {error}
                </div>
              ))}
            </div>
          )}

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
                      onEmojiClick={(emoji) => {
                        setMessage((prev) => prev + emoji.emoji);
                        setShowEmojiPicker(false);
                      }}
                    />
                  </div>
                )}
              </div>
              <button
                type="button"
                className="toolbar-button"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon size={20} />
              </button>
              <button
                type="button"
                className="toolbar-button"
                onClick={() => documentInputRef.current?.click()}
              >
                <Paperclip size={20} />
              </button>
            </div>
          </div>

          <form
            className="input-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
          >
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="message-input"
            />
            <button
              type="submit"
              className="send-button"
              disabled={!message.trim() && selectedFiles.length === 0}
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      </div>

      <GroupSidebar
        groupId={groupId}
        isOpen={showSidebar}
        onClose={() => setShowSidebar(false)}
      />

      {showMessageOptions && selectedMessage && (
        <div
          className="modal-overlay"
          onClick={() => setShowMessageOptions(false)}
        >
          <div className="modal-content">
            {selectedMessage.senderId === currentUserId ? (
              <>
                <button
                  className="modal-button"
                  onClick={() => {
                    handleRecallMessage(selectedMessage.groupMessageId);
                    setShowMessageOptions(false);
                  }}
                >
                  <AlertCircle size={20} />
                  <span>Thu hồi</span>
                </button>
                <button
                  className="modal-button"
                  onClick={() => {
                    handleDeleteMessage(selectedMessage.groupMessageId);
                    setShowMessageOptions(false);
                  }}
                >
                  <X size={20} />
                  <span>Xóa</span>
                </button>
              </>
            ) : (
              <>
                <button
                  className="modal-button"
                  onClick={() => {
                    handleDeleteMessage(selectedMessage.groupMessageId);
                    setShowMessageOptions(false);
                  }}
                >
                  <X size={20} />
                  <span>Xóa</span>
                </button>
              </>
            )}
            <button
              className="modal-button"
              onClick={() => {
                handleForwardMessage(selectedMessage.groupMessageId);
                setShowMessageOptions(false);
              }}
            >
              <Share2 size={20} />
              <span>Chuyển tiếp</span>
            </button>
          </div>
        </div>
      )}

      {showImagePreview && (
        <div
          className="modal-overlay"
          onClick={() => setShowImagePreview(false)}
        >
          <div className="modal-content">
            <img src={previewImage} alt="preview" className="preview-image" />
          </div>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar"
        multiple
        onChange={handleFileSelect}
      />
      <input
        type="file"
        ref={documentInputRef}
        style={{ display: "none" }}
        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.rar"
        multiple
        onChange={handleFileSelect}
      />

      {renderFullscreenModal()}
    </div>
  );
};

export default GroupChat;
