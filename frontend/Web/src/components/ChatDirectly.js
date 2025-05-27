// Optimized ChatDirectly component
import React, {
  useState,
  useEffect,
  useRef,
  useContext,
  useMemo,
  useCallback,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import api, { getBaseUrl, getApiUrl } from "../config/api";
import "./css/ChatDirectly.css";
import MessageContextMenu from "./MessageContextMenu";
import ForwardMessageModal from "./ForwardMessageModal";
import ConfirmModal from "../../../Web/src/components/ConfirmModal";
import { SocketContext } from "../App";
import VideoCall from './VideoCall';

const ChatDirectly = () => {
  const { phone } = useParams();
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const socket = useContext(SocketContext);
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
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [oldestMessageDate, setOldestMessageDate] = useState(null);
  const [visibleDates, setVisibleDates] = useState([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [isLoadingDate, setIsLoadingDate] = useState(false);
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
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);

  // Helper functions
  const extractFilenameFromUrl = (url) => {
    if (!url) return null;
    try {
      // Ưu tiên lấy tên file từ query string nếu có
      const urlObj = new URL(url, window.location.origin);
      const filenameParam = urlObj.searchParams.get("filename");
      if (filenameParam) {
        return decodeURIComponent(filenameParam);
      }
      // Nếu không có, lấy phần cuối cùng sau dấu /
      let lastPart = url.split("/").pop();
      // Nếu có dấu ?, cắt bỏ phần query string
      if (lastPart.includes("?")) {
        lastPart = lastPart.split("?")[0];
      }
      return decodeURIComponent(lastPart);
    } catch (error) {
      console.error("Error extracting filename from URL:", error);
      return null;
    }
  };

  const formatDate = (timestamp) => {
    try {
      if (!timestamp) return "";
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return "";
      return date.toLocaleDateString("vi-VN");
    } catch (error) {
      console.warn("Date formatting error:", error);
      return "";
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return "";
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (mimeType, fileName = "") => {
    // Ưu tiên kiểm tra đuôi file nếu có
    const ext = fileName.split('.').pop().toLowerCase();

    // Kiểm tra đuôi file trước
    if (ext === "doc" || ext === "docx") {
      return <img src="/icons/word.svg" alt="Word" style={{ width:40 , height: 40 }} />;
    }
    if (ext === "pdf") {
      return <img src="/icons/pdf.svg" alt="PDF" style={{ width: 40, height: 40 }} />;
    }
    if (ext === "xls" || ext === "xlsx") {
      return <img src="/icons/excel.png" alt="Excel" style={{ width: 40, height: 40 }} />;
    }
    if (ext === "ppt" || ext === "pptx") {
      return <img src="/icons/ppt.png" alt="PowerPoint" style={{ width: 40, height: 40 }} />;
    }
    if (ext === "zip" || ext === "rar") {
      return <img src="/icons/zip.png" alt="Archive" style={{ width: 40, height: 40 }} />;
    }

    // Nếu không có đuôi file, mới kiểm tra mimeType
    if (mimeType) {
      if (mimeType.includes("word")) {
        return <img src="/icons/word.svg" alt="Word" style={{ width: 40, height: 40 }} />;
      }
      if (mimeType.includes("pdf")) {
        return <img src="/icons/pdf.svg" alt="PDF" style={{ width: 40, height: 40 }} />;
      }
      if (mimeType.includes("excel")) {
        return <img src="/icons/excel.png" alt="Excel" style={{ width: 40, height: 40 }} />;
      }
      if (mimeType.includes("powerpoint")) {
        return <img src="/icons/ppt.png" alt="PowerPoint" style={{ width: 40, height: 40 }} />;
      }
      if (mimeType.includes("zip") || mimeType.includes("rar")) {
        return <img src="/icons/zip.png" alt="Archive" style={{ width: 40, height: 40 }} />;
      }
    }
  };

  const handleDownloadFile = (url, fileName) => {
    let downloadFileName = fileName;
    if (!downloadFileName && url) {
      downloadFileName = extractFilenameFromUrl(url);
    }
    if (!downloadFileName) {
      downloadFileName = "downloaded-file";
    }
    const link = document.createElement("a");
    link.href = url;
    link.download = downloadFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  const groupMessagesByDate = (messages) => {
    const groups = {};
    messages.forEach((msg) => {
      const date = formatDate(msg.timestamp);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(msg);
    });
    return groups;
  };

  const loadChatHistory = useCallback(
    async (loadMore = false) => {
      try {
        if (loadMore && !hasMore) return;

        setIsLoadingMore(loadMore);
        const options = {
          limit: 50,
        };

        if (loadMore && oldestMessageDate) {
          options.date = oldestMessageDate;
          options.before = true;
        }

        const response = await api.get(`/chat/history/${phone}`, {
          params: options,
        });

        if (response.data.status === "success" && response.data.data.messages) {
          const messageArray = Object.values(response.data.data.messages)
            .flat()
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

          setMessages((prev) => {
            if (loadMore) {
              const combined = [...messageArray, ...prev];
              const unique = Array.from(
                new Map(combined.map((msg) => [msg.messageId, msg])).values()
              );
              return unique.sort(
                (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
              );
            }
            return messageArray;
          });

          // Update pagination state
          setHasMore(response.data.data.pagination.hasMore);
          if (response.data.data.pagination.oldestTimestamp) {
            setOldestMessageDate(response.data.data.pagination.oldestTimestamp);
          }

          // Update visible dates
          if (!loadMore) {
            const today = formatDate(Date.now());
            setVisibleDates([today]);
            setInitialLoad(false);
          }
        }

        // Set loading to false after successful data fetch
        setLoading(false);
      } catch (error) {
        console.error("Error loading chat history:", error);
        setError("Không thể tải lịch sử trò chuyện");
        // Also set loading to false in case of error
        setLoading(false);
      } finally {
        setIsLoadingMore(false);
      }
    },
    [phone, hasMore]
  );

  const loadMoreMessages = useCallback(() => {
    if (isLoadingDate) return;

    const dates = Object.keys(groupMessagesByDate(messages)).sort(
      (a, b) => new Date(a) - new Date(b)
    );

    // Find the oldest visible date
    const oldestVisibleDate = visibleDates[visibleDates.length - 1];
    const oldestVisibleIndex = dates.indexOf(oldestVisibleDate);

    // Load just one previous date
    if (oldestVisibleIndex > 0) {
      const previousDate = dates[oldestVisibleIndex - 1];
      setIsLoadingDate(true);
      setVisibleDates((prev) => [...prev, previousDate]);

      setTimeout(() => {
        setIsLoadingDate(false);
      }, 500);
      return;
    }

    // If we've shown all local dates and there might be more on server
    if (oldestVisibleIndex === 0 && hasMore && !isLoadingMore) {
      loadChatHistory(true);
    }
  }, [
    messages,
    visibleDates,
    hasMore,
    isLoadingMore,
    isLoadingDate,
    loadChatHistory,
  ]);

  const handleScroll = useCallback(
    (e) => {
      const element = e.target;
      if (element.scrollTop === 0) {
        loadMoreMessages();
      }
    },
    [loadMoreMessages]
  );

  // Update useEffect for initial load
  useEffect(() => {
    if (messages.length > 0) {
      if (initialLoad) {
        const today = formatDate(Date.now());
        setVisibleDates([today]);
        setInitialLoad(false);
      }
    }
  }, [messages, initialLoad]);

  // Update message rendering logic
  const renderedMessages = useMemo(() => {
    const messagesByDate = groupMessagesByDate(messages);

    return Object.keys(messagesByDate)
      .sort((a, b) => new Date(a) - new Date(b))
      .map((date) => {
        if (!visibleDates.includes(date)) {
          return null;
        }

        const messagesForDate = messagesByDate[date];

        return (
          <div key={date} className="date-group">
            <div className="date-header">
              <div className="date-line"></div>
              <span className="date-text">{date}</span>
              <div className="date-line"></div>
            </div>
            {messagesForDate.map((msg, idx) => {
              const isOther = msg.senderPhone !== localStorage.getItem("phone");
              const isRecalled = msg.status === "recalled";

              return (
                <div
                  key={msg.messageId || idx}
                  className={`message ${isOther ? "received" : "sent"}`}
                  onContextMenu={(e) => handleContextMenu(e, msg)}
                >
                  <div
                    className={`message-content ${
                      isRecalled ? "recalled" : ""
                    }`}
                  >
                    {isRecalled ? (
                      <div className="recalled-message-box">
                        <span className="recalled-icon" style={{ marginRight: 6, verticalAlign: 'middle' }}>
                          <svg width="18" height="18" fill="#1976d2" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18.2A8.2 8.2 0 1 1 12 3.8a8.2 8.2 0 0 1 0 16.4zm-.9-5.7h1.8v1.8h-1.8v-1.8zm0-7.2h1.8v5.4h-1.8V7.3z"/></svg>
                        </span>
                        <span className="recalled-text" style={{ fontStyle: 'italic', color: '#1976d2' }}>
                          Tin nhắn đã bị thu hồi
                        </span>
                      </div>
                    ) : msg.type === "file" ? (
                      <div className="file-message">
                        {msg.fileType?.startsWith("image/") ? (
                          <div
                            className="image-preview"
                            onClick={() => handleImagePreview(msg.content)}
                          >
                            <img src={msg.content} alt="Image" />
                          </div>
                        ) : msg.fileType?.startsWith("video/") ? (
                          <div
                            className="video-preview"
                            onClick={() => handleVideoPreview(msg.content)}
                          >
                            <video src={msg.content} controls />
                          </div>
                        ) : (
                          <div
                            className="document-preview"
                            onClick={() =>
                              handleDownloadFile(msg.content, msg.fileName)
                            }
                          >
                            <div className="document-icon">
                              {getFileIcon(msg.fileType, msg.fileName || extractFilenameFromUrl(msg.content))}
                            </div>
                            <div className="document-info">
                              <div className="document-name" style={{ fontWeight: 700, color: '#1565c0' }}>
                                {msg.fileName || extractFilenameFromUrl(msg.content) || "File"}
                              </div>
                              {msg.fileSize && !isNaN(msg.fileSize) && msg.fileSize > 0 && (
                                <div className="document-size">
                                  {formatFileSize(msg.fileSize)}
                                </div>
                              )}
                              <div className="document-desc" style={{ color: '#1976d2', fontSize: 13, marginTop: 2 }}>
                                Tải về để xem lâu dài
                              </div>
                            </div>
                            <div className="document-download">
                              <button onClick={() => handleDownloadFile(msg.content, msg.fileName)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                <Download size={20} color="#1976d2" />
                              </button>
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

                  {/* {!isRecalled && (
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
                          onContextMenu={(e) => handleContextMenu(e, msg)}
                          title="Thêm"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      )}
                    </div>
                  )} */}
                </div>
              );
            })}
          </div>
        );
      })
      .filter(Boolean);
  }, [messages, visibleDates]);

  const scrollToBottom = useCallback(() => {
    const el = messagesEndRef.current;
    if (!el) return;
    const container = el.parentElement;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      150;
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
    if (!socket) return;
    setLoading(true);
    socket.emit("join-chat", { receiverPhone: phone });

    socket.on("new-message", (msg) => {
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
        setOldestMessageDate(Math.min(msg.timestamp, oldestMessageDate || 0));
        return [...prev, { ...msg, status: "received" }];
      });
      scrollToBottom();
    });
    socket.on("typing", ({ senderPhone }) => {
      if (senderPhone === phone) {
        setIsTyping(true);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
      }
    });
    socket.on("stop_typing", ({ senderPhone }) => {
      if (senderPhone === phone) {
        setIsTyping(false);
      }
    });
    socket.on("message-recalled", ({ messageId }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.messageId === messageId
            ? { ...msg, content: "Tin nhắn đã bị thu hồi", status: "recalled" }
            : msg
        )
      );
    });
    socket.on("message-deleted", ({ messageId }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.messageId === messageId ? { ...msg, status: "deleted" } : msg
        )
      );
    });

    // Initial load
    Promise.all([fetchUserInfo(), loadChatHistory()])
      .catch((err) => {
        console.error("Error during initial load:", err);
        setError("Không thể tải dữ liệu chat");
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      if (socket) {
        socket.emit("leave-chat", { receiverPhone: phone });
        socket.off("new-message");
        socket.off("typing");
        socket.off("stop_typing");
        socket.off("message-recalled");
        socket.off("message-deleted");
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [socket, phone, loadChatHistory]);

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

      const response = await fetch(getApiUrl() + "/chat/upload", {
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
        if (
          file.type.includes("pdf") ||
          file.type.includes("word") ||
          file.type.includes("document") ||
          file.type.includes("powerpoint") ||
          file.type.includes("presentation") ||
          file.type.includes("excel") ||
          file.type.includes("spreadsheet")
        ) {
          // Add filename as a query parameter to the URL
          const separator = url.includes("?") ? "&" : "?";
          fileUrl = `${url}${separator}filename=${encodeURIComponent(
            originalFileName
          )}`;
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
    // Log từng receiverPhone để kiểm tra kiểu dữ liệu
    selectedUsers.forEach((receiverPhone, idx) => {
      console.log(`receiverPhone[${idx}]:`, receiverPhone, 'type:', typeof receiverPhone);
    });
    try {
      const promises = selectedUsers.map((receiverPhone) =>
        api.post("/chat/messages/forward", {
          messageId: forwardModal.messageId,
          receiverPhone:receiverPhone.id,
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

  const handleVideoCall = () => {
    setIsVideoCallOpen(true);
  };

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
            <button 
              key={i}
              onClick={() => {
                if (Icon === Video) {
                  handleVideoCall();
                }
              }}
            >
              <Icon size={20} />
            </button>
          ))}
        </div>
      </div>

      <div className="messages-container" onScroll={handleScroll}>
        {isLoadingMore && (
          <div className="loading-more">
            <div className="loading-spinner"></div>
            <span>Đang tải tin nhắn cũ...</span>
          </div>
        )}
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
        style={{ display: "none" }}
        accept="image/*,video/*"
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
                  <div className="file-icon">{getFileIcon(file.type)}</div>
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
                <div className="progress-text">
                  Đang upload... {uploadProgress}%
                </div>
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
              <button
                className="close-button"
                onClick={() => setShowImagePreview(false)}
              >
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
              <button
                className="close-button"
                onClick={() => setShowVideoPreview(false)}
              >
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
              <Send
                size={20}
                color={
                  message.trim() || selectedFiles.length > 0
                    ? "#1877f2"
                    : "#666"
                }
              />
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

      <VideoCall
        isOpen={isVideoCallOpen}
        onClose={() => setIsVideoCallOpen(false)}
        receiverPhone={phone}
        receiverName={userInfo?.name || phone}
      />
    </div>
  );
};

export default ChatDirectly;