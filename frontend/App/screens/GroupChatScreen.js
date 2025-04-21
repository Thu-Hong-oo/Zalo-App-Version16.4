import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
  Modal,
  Alert,
  Dimensions,
  Linking,
  FlatList,
} from "react-native";
import {
  Ionicons,
  FontAwesome,
  MaterialIcons,
  Feather,
} from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { io } from "socket.io-client";
import {
  getGroupMessages,
  sendGroupMessage,
  recallGroupMessage,
  forwardGroupMessage,
  deleteGroupMessage,
  getGroupInfo,
} from "../modules/chat-group/chatGroupController";
import { getAccessToken, getUserId } from "../services/storage";
import * as ImagePicker from "expo-image-picker";
import { Video } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import ForwardMessageModal from "./ForwardMessageModal";
import { getApiUrl, getBaseUrl, api } from "../config/api";
import axios from "axios";
// import jwt_decode from "jwt-decode"; // Tạm thời comment lại

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const GroupChatScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const {
    groupId,
    groupName: initialGroupName,
    memberCount: initialMemberCount,
  } = route.params;

  const [message, setMessage] = useState("");
  const scrollViewRef = useRef();
  const [groupDetails, setGroupDetails] = useState(null); // State lưu chi tiết nhóm
  const [loading, setLoading] = useState(true); // State loading
  const [error, setError] = useState(null); // State lỗi
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [socket, setSocket] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewVideo, setPreviewVideo] = useState(null);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [forwardModalVisible, setForwardModalVisible] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [oldestMessageDate, setOldestMessageDate] = useState(null);
  const [visibleDates, setVisibleDates] = useState([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [isLoadingDate, setIsLoadingDate] = useState(false);
  const [shouldRenderAll, setShouldRenderAll] = useState(false);
  const [messageGroups, setMessageGroups] = useState([]);
  const [viewableItems, setViewableItems] = useState([]);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const flatListRef = useRef(null);
  const [currentDate, setCurrentDate] = useState(null);
  const [showLoadMore, setShowLoadMore] = useState(false);
  const [isLoadingPrevious, setIsLoadingPrevious] = useState(false);
  const [loadedDates, setLoadedDates] = useState([]);
  const [isNearTop, setIsNearTop] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [lastEvaluatedKey, setLastEvaluatedKey] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [userCache, setUserCache] = useState({});
  const [deletedMessages, setDeletedMessages] = useState(new Set());

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 300,
  };

  useEffect(() => {
    const fetchGroupDetails = async () => {
      if (!groupId) {
        setError("Không tìm thấy ID nhóm.");
        setLoading(false);
        return;
      }

      console.log(`Fetching details for groupId: ${groupId}`);
      setLoading(true);
      setError(null);
      try {
        const response = await getGroupInfo(groupId);
        console.log("Fetched group details:", response);
        if (response && response.groupId) {
          setGroupDetails(response);
          // Thêm tin nhắn hệ thống vào messages khi có groupDetails
          const systemMessage = createSystemMessage(response);
          if (systemMessage) {
            setMessages([systemMessage]);
          }
        } else {
          throw new Error("Dữ liệu nhóm không hợp lệ từ API");
        }
      } catch (err) {
        console.error("Error fetching group details:", err);
        setError(err.message || "Không thể tải thông tin nhóm.");
      } finally {
        setLoading(false);
      }
    };

    fetchGroupDetails();
  }, [groupId]);

  const getUserIdFromToken = async () => {
    try {
      const token = await getAccessToken();
      console.log("Token:", token);

      // Decode token manually để kiểm tra
      if (token) {
        const parts = token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          console.log("Token payload:", payload);
          // Kiểm tra các trường có thể chứa userId
          console.log("Possible user identifiers:", {
            userId: payload.userId,
            sub: payload.sub,
            id: payload.id,
            user_id: payload.user_id,
            user: payload.user,
          });
          return payload.userId || payload.sub || payload.id || payload.user_id;
        }
      }
      return null;
    } catch (error) {
      console.error("Error decoding token:", error);
      // Nếu token không phải JWT hoặc có lỗi, thử lấy từ response của socket
      return currentUserId;
    }
  };

  // Tạo tin nhắn hệ thống dựa trên dữ liệu nhóm
  const createSystemMessage = (details) => {
    if (!details || !details.members || details.members.length === 0)
      return null;

    const creator = details.members.find((m) => m.userId === details.createdBy);
    const creatorName = creator?.name || "Người tạo";

    // Lấy tên của tối đa 2 thành viên khác (không phải người tạo)
    const otherMemberNames = details.members
      .filter((m) => m.userId !== details.createdBy)
      .slice(0, 2)
      .map((m) => m.name || "Thành viên");

    let displayText = creatorName;
    if (otherMemberNames.length > 0) {
      displayText += `, ${otherMemberNames.join(", ")}`;
    }

    // Lấy avatar của những người được hiển thị tên
    const displayUserIds = [
      creator?.userId,
      ...details.members
        .filter((m) => m.userId !== details.createdBy)
        .slice(0, 2)
        .map((m) => m.userId),
    ].filter(Boolean);
    const memberAvatars = details.members
      .filter((m) => displayUserIds.includes(m.userId))
      .map((m) => m.avatar || "https://via.placeholder.com/50");

    return {
      id: "system-" + details.groupId,
      type: "system",
      text: `${displayText} đã tham gia nhóm`,
      memberNames: displayText,
      memberAvatars: memberAvatars,
      timestamp: new Date(details.createdAt),
    };
  };

  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return `${date.getHours()}:${
      date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes()
    } Hôm nay`;
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const sendMessage = () => {
    if (message.trim() === "") return;
    console.log("Sending message:", message);
    setMessage("");
  };

  const fetchUserInfo = async (userId) => {
    try {
      // Check cache first
      if (userCache[userId]) {
        return userCache[userId];
      }

      const response = await axios.get(`${getApiUrl()}/users/byId/${userId}`, {
        headers: {
          Authorization: `Bearer ${await getAccessToken()}`,
        },
      });

      if (!response.data) {
        throw new Error("Không nhận được dữ liệu từ server");
      }

      // Update cache
      setUserCache((prev) => ({
        ...prev,
        [userId]: response.data,
      }));

      return response.data;
    } catch (error) {
      console.error("Get user info error:", error);
      return null;
    }
  };

  const loadChatHistory = async (loadMore = false) => {
    try {
      if (loadMore && !hasMoreMessages) return;

      setIsLoadingMore(loadMore);
      const options = {
        limit: 50,
        before: true,
      };

      if (loadMore && oldestMessageDate) {
        options.date = oldestMessageDate;
      }

      if (lastEvaluatedKey) {
        options.lastEvaluatedKey = lastEvaluatedKey;
      }

      const response = await getGroupMessages(groupId, options);
      const userId = await getUserIdFromToken();

      if (response.status === "success" && response.data.messages) {
        // Tạo map để theo dõi tin nhắn bị thu hồi và xóa
        const recallMap = new Map();
        const deleteMap = new Map();

        // Xử lý các tin nhắn theo ngày
        const messageArray = await Promise.all(
          Object.entries(response.data.messages).flatMap(([date, messages]) => {
            // Trước tiên, lọc ra các record thu hồi và xóa
            messages.forEach((msg) => {
              if (
                msg.type === "recall_record" &&
                msg.metadata?.originalMessageId
              ) {
                recallMap.set(msg.metadata.originalMessageId, msg);
              }
              if (
                msg.type === "delete_record" &&
                msg.metadata?.deletedMessageId
              ) {
                deleteMap.set(msg.metadata.deletedMessageId, msg);
              }
            });

            // Sau đó xử lý các tin nhắn thông thường
            return messages
              .filter(
                (msg) =>
                  msg.type !== "recall_record" && msg.type !== "delete_record"
              ) // Loại bỏ các record thu hồi và xóa
              .map(async (msg) => {
                const recallRecord = recallMap.get(msg.groupMessageId);
                const deleteRecord = deleteMap.get(msg.groupMessageId);
                const isMe = msg.senderId === userId;

                // Nếu là tin nhắn của người khác, fetch thông tin người gửi
                let senderInfo = {};
                if (!isMe) {
                  const userInfo = await fetchUserInfo(msg.senderId);
                  if (userInfo) {
                    senderInfo = {
                      senderName: userInfo.name,
                      senderAvatar: userInfo.avatar,
                    };
                  }
                }

                // Nếu tin nhắn đã bị thu hồi
                if (recallRecord) {
                  return {
                    ...msg,
                    ...senderInfo,
                    content: "Tin nhắn đã bị thu hồi",
                    status: "recalled",
                    type: "recall_record",
                    metadata: {
                      ...msg.metadata,
                      originalMessageId: msg.groupMessageId,
                      recalledBy: recallRecord.metadata.recalledBy,
                      recalledAt: recallRecord.metadata.recalledAt,
                    },
                    isMe,
                  };
                }

                // Nếu tin nhắn đã bị xóa bởi người dùng hiện tại
                if (
                  deleteRecord &&
                  deleteRecord.metadata.deletedBy === userId
                ) {
                  return null; // Không hiển thị tin nhắn đã xóa
                }

                return {
                  ...msg,
                  ...senderInfo,
                  status: msg.status || "sent",
                  isMe,
                };
              });
          })
        );

        // Lọc bỏ các tin nhắn null (đã bị xóa)
        const filteredMessages = (await Promise.all(messageArray)).filter(
          Boolean
        );

        setMessages((prev) => {
          if (loadMore) {
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
          }
          return filteredMessages.sort(
            (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
          );
        });

        setHasMoreMessages(response.data.pagination.hasMore);
        if (response.data.pagination.lastEvaluatedKey) {
          setLastEvaluatedKey(response.data.pagination.lastEvaluatedKey);
        }
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
      Alert.alert("Lỗi", "Đã xảy ra lỗi khi tải lịch sử trò chuyện");
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    const initSocket = async () => {
      try {
        const token = await getAccessToken();
        const userId = await getUserIdFromToken();
        setCurrentUserId(userId);

        const newSocket = io(getBaseUrl(), {
          auth: { token },
          transports: ["websocket", "polling"],
          forceNew: true,
          reconnection: true,
          reconnectionAttempts: 5,
        });

        newSocket.on("connect", () => {
          console.log("Connected to socket server");
          newSocket.emit("join-group", groupId);
        });

        newSocket.on("connect_error", (error) => {
          console.error("Socket connection error:", error);
        });

        newSocket.on("new-group-message", async (newMessage) => {
          if (newMessage.groupId === groupId) {
            // Nếu tin nhắn không phải của người dùng hiện tại, lấy thông tin người gửi
            if (newMessage.senderId !== userId) {
              const senderInfo = await fetchUserInfo(newMessage.senderId);
              newMessage = {
                ...newMessage,
                senderName: senderInfo.name,
                senderAvatar: senderInfo.avatar,
              };
            }

            setMessages((prev) => {
              const uniqueMessages = prev.filter(
                (msg) => msg.groupMessageId !== newMessage.groupMessageId
              );
              return [...uniqueMessages, newMessage].sort(
                (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
              );
            });
            scrollToBottom();
          }
        });

        newSocket.on("group-message-recalled", (recallData) => {
          if (recallData.groupId === groupId) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.groupMessageId === recallData.messageId
                  ? {
                      ...msg,
                      content: "Tin nhắn đã bị thu hồi",
                      status: "recalled",
                      type: "recall_record",
                      metadata: {
                        ...msg.metadata,
                        originalMessageId: msg.groupMessageId,
                        recalledBy: recallData.recalledBy,
                        recalledAt: recallData.recalledAt,
                      },
                    }
                  : msg
              )
            );
          }
        });

        newSocket.on("group-message-deleted", (deleteData) => {
          if (deleteData.groupId === groupId) {
            // Chỉ ẩn tin nhắn nếu người dùng hiện tại là người xóa
            if (deleteData.deletedBy === userId) {
              setMessages((prev) =>
                prev.filter(
                  (msg) => msg.groupMessageId !== deleteData.messageId
                )
              );
              // Thêm vào danh sách tin nhắn đã xóa
              setDeletedMessages(
                (prev) => new Set([...prev, deleteData.messageId])
              );
            }
          }
        });

        newSocket.on("message-sent", (response) => {
          console.log("Message sent response received:", response);
          if (response) {
            setMessages((prev) => {
              const updatedMessages = prev.map((msg) => {
                if (
                  msg.tempId === response.tempId ||
                  msg.groupMessageId === response.tempId
                ) {
                  return {
                    ...msg,
                    groupMessageId:
                      response.groupMessageId || msg.groupMessageId,
                    status: "sent",
                    isTempId: false,
                    createdAt: response.createdAt || msg.createdAt,
                  };
                }
                return msg;
              });
              return updatedMessages;
            });
          }
        });

        newSocket.on("error", (error) => {
          console.log("Socket error received:", error);
          if (error && error.tempId) {
            setMessages((prev) => {
              return prev.map((msg) => {
                if (msg.tempId === error.tempId) {
                  return { ...msg, status: "error" };
                }
                return msg;
              });
            });
          }
        });

        setSocket(newSocket);
      } catch (error) {
        console.error("Socket initialization error:", error);
      }
    };

    initSocket();
    loadChatHistory();

    return () => {
      if (socket) socket.disconnect();
    };
  }, [groupId]);

  const scrollToBottom = () => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() && !selectedFiles.length) return;

    try {
      if (message.trim()) {
        const tempId = `temp-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        const newMessage = {
          groupMessageId: tempId,
          tempId: tempId,
          senderId: currentUserId,
          content: message.trim(),
          type: "text",
          createdAt: new Date().toISOString(),
          status: "sending",
          isTempId: true,
          senderName: "You",
          senderAvatar: null,
        };

        setMessages((prev) => {
          const uniqueMessages = prev.filter(
            (msg) => msg.groupMessageId !== tempId
          );
          return [...uniqueMessages, newMessage].sort(
            (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
          );
        });

        setMessage("");
        scrollToBottom();

        const response = await sendGroupMessage(groupId, message.trim());
        if (response.status === "success") {
          setMessages((prev) => {
            const updatedMessages = prev
              .filter(
                (msg) => msg.groupMessageId !== response.data.groupMessageId
              )
              .map((msg) =>
                msg.tempId === tempId
                  ? {
                      ...msg,
                      groupMessageId: response.data.groupMessageId,
                      status: "sent",
                      isTempId: false,
                    }
                  : msg
              );
            return updatedMessages.sort(
              (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
            );
          });
        }
      }

      if (selectedFiles.length > 0) {
        await handleUpload(selectedFiles);
      }
    } catch (error) {
      console.error("Error in handleSendMessage:", error);
      Alert.alert("Lỗi", "Không thể gửi tin nhắn");
    }
  };

  const handleRecallMessage = async (messageId) => {
    try {
      const targetMessage = messages.find(
        (msg) => msg.groupMessageId === messageId
      );
      if (!targetMessage) {
        Alert.alert("Lỗi", "Tin nhắn không tồn tại");
        return;
      }
      if (targetMessage.isTempId || targetMessage.status === "sending") {
        Alert.alert("Lỗi", "Không thể thu hồi tin nhắn đang gửi");
        return;
      }

      const messageAge =
        Date.now() - new Date(targetMessage.createdAt).getTime();
      const MAX_RECALL_TIME = 24 * 60 * 60 * 1000; // 24h

      if (messageAge > MAX_RECALL_TIME) {
        Alert.alert(
          "Không thể thu hồi",
          "Tin nhắn chỉ có thể được thu hồi trong vòng 24h sau khi gửi"
        );
        return;
      }

      // Cập nhật UI ngay lập tức
      setMessages((prev) =>
        prev.map((msg) =>
          msg.groupMessageId === messageId
            ? {
                ...msg,
                content: "Tin nhắn đã bị thu hồi",
                status: "recalled",
                type: "recall_record",
                metadata: {
                  ...msg.metadata,
                  originalMessageId: msg.groupMessageId,
                  recalledBy: currentUserId,
                  recalledAt: new Date().toISOString(),
                },
              }
            : msg
        )
      );

      const response = await recallGroupMessage(groupId, messageId);
      if (response.status === "success") {
        // Gửi sự kiện socket để thông báo cho các thành viên khác
        socket?.emit("recall-group-message", {
          messageId,
          groupId,
          recalledBy: currentUserId,
          recalledAt: new Date().toISOString(),
        });
        Alert.alert("Thành công", "Tin nhắn đã được thu hồi");
      } else {
        // Nếu thu hồi thất bại, khôi phục tin nhắn gốc
        setMessages((prev) =>
          prev.map((msg) =>
            msg.groupMessageId === messageId
              ? {
                  ...msg,
                  content: targetMessage.content,
                  status: "sent",
                  type: targetMessage.type,
                  metadata: targetMessage.metadata,
                }
              : msg
          )
        );
        Alert.alert("Lỗi", response.message || "Không thể thu hồi tin nhắn");
      }
    } catch (error) {
      console.error("Error recalling message:", error);
      Alert.alert("Lỗi", "Đã xảy ra lỗi khi thu hồi tin nhắn");
    }
  };

  const showMessageOptions = (message) => {
    setSelectedMessage(message);
    const isMe = message.isMe || message.senderId === currentUserId;

    if (isMe) {
      // Kiểm tra thời gian của tin nhắn cho thu hồi
      const messageAge = Date.now() - new Date(message.createdAt).getTime();
      const MAX_RECALL_TIME = 24 * 60 * 60 * 1000; // 24h

      if (messageAge > MAX_RECALL_TIME) {
        // Nếu tin nhắn quá 24h, chỉ hiển thị chuyển tiếp và xóa
        setShowOptionsModal(true);
      } else {
        // Nếu tin nhắn chưa quá 24h, hiển thị tất cả tùy chọn
        setShowOptionsModal(true);
      }
    } else {
      // Tin nhắn của người khác, hiển thị chuyển tiếp và xóa
      setShowOptionsModal(true);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      const targetMessage = messages.find(
        (msg) => msg.groupMessageId === messageId
      );
      if (!targetMessage) {
        Alert.alert("Lỗi", "Tin nhắn không tồn tại");
        return;
      }
      if (targetMessage.isTempId || targetMessage.status === "sending") {
        Alert.alert("Lỗi", "Không thể xóa tin nhắn đang gửi");
        return;
      }

      // Thêm vào danh sách tin nhắn đã xóa
      setDeletedMessages((prev) => new Set([...prev, messageId]));

      // Xóa tin nhắn ngay lập tức ở giao diện người dùng
      setMessages((prev) =>
        prev.filter((msg) => msg.groupMessageId !== messageId)
      );

      const response = await deleteGroupMessage(groupId, messageId);
      if (response.status === "success") {
        // Gửi sự kiện socket để thông báo cho các thành viên khác
        socket?.emit("delete-group-message", {
          messageId,
          groupId,
          deletedBy: currentUserId,
        });
        Alert.alert("Thành công", "Tin nhắn đã được xóa");
      } else {
        // Nếu xóa thất bại, khôi phục tin nhắn
        setDeletedMessages((prev) => {
          const newSet = new Set(prev);
          newSet.delete(messageId);
          return newSet;
        });
        setMessages((prev) => {
          const updatedMessages = [...prev];
          const index = updatedMessages.findIndex(
            (msg) => msg.groupMessageId === messageId
          );
          if (index === -1) {
            updatedMessages.push(targetMessage);
          }
          return updatedMessages.sort(
            (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
          );
        });
        Alert.alert("Lỗi", response.message || "Không thể xóa tin nhắn");
      }
    } catch (error) {
      console.error("Error deleting message:", error);
      Alert.alert("Lỗi", "Đã xảy ra lỗi khi xóa tin nhắn");
    }
  };

  const handleForwardMessage = async (receiverPhones) => {
    try {
      if (!selectedMessage) {
        Alert.alert("Lỗi", "Không có tin nhắn được chọn");
        return;
      }

      const promises = receiverPhones.map((receiverPhone) =>
        forwardGroupMessage(
          groupId,
          selectedMessage.groupMessageId,
          receiverPhone,
          selectedMessage.type === "file"
            ? selectedMessage.content
            : selectedMessage.content
        )
      );
      const results = await Promise.all(promises);
      const allSuccessful = results.every((res) => res.status === "success");

      if (allSuccessful) {
        setForwardModalVisible(false);
        Alert.alert("Thành công", "Tin nhắn đã được chuyển tiếp");
      } else {
        throw new Error("Có lỗi xảy ra khi chuyển tiếp tin nhắn");
      }
    } catch (error) {
      console.error("Error forwarding message:", error);
      Alert.alert("Lỗi", error.message || "Không thể chuyển tiếp tin nhắn");
    } finally {
      setSelectedMessage(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.containerCentered}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text>Đang tải thông tin nhóm...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.containerCentered}>
        <Text style={{ color: "red" }}>Lỗi: {error}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: "blue", marginTop: 10 }}>Quay lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!groupDetails) {
    return (
      <SafeAreaView style={styles.containerCentered}>
        <Text>Không tìm thấy thông tin nhóm.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: "blue", marginTop: 10 }}>Quay lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // --- Render UI với groupDetails ---

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerTitle}>
          <Text style={styles.title} numberOfLines={1}>
            {groupDetails.name}
          </Text>
          <Text style={styles.subtitle}>
            {groupDetails.members ? groupDetails.members.length : 0} thành viên
          </Text>
        </View>

        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="menu" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Chat Messages */}
      <ScrollView
        style={styles.messagesContainer}
        contentContainerStyle={styles.scrollContent}
        ref={scrollViewRef}
        onContentSizeChange={() =>
          scrollViewRef.current?.scrollToEnd({ animated: true })
        }
      >
        {messages &&
          messages.length > 0 &&
          messages.map((msg) => {
            if (msg.type === "system") return null;

            const isMe = msg.isMe || msg.senderId === currentUserId;
            return (
              <TouchableOpacity
                key={msg.groupMessageId || msg.id}
                onLongPress={() =>
                  isMe && msg.status !== "recalled" && showMessageOptions(msg)
                }
                style={[
                  styles.messageContainer,
                  isMe ? styles.myMessage : styles.otherMessage,
                ]}
                disabled={msg.status === "recalled"}
              >
                {!isMe && (
                  <Image
                    source={{
                      uri: msg.senderAvatar || "https://via.placeholder.com/50",
                    }}
                    style={styles.avatar}
                  />
                )}
                <View
                  style={[
                    styles.messageBubble,
                    isMe ? styles.myMessageBubble : styles.otherMessageBubble,
                  ]}
                >
                  {!isMe && (
                    <Text style={styles.senderName}>
                      {msg.senderName || "Người dùng"}
                    </Text>
                  )}
                  {msg.status === "recalled" || msg.isRecalled ? (
                    <View style={styles.recalledMessageContainer}>
                      <Ionicons
                        name="refresh"
                        size={16}
                        color={isMe ? "rgba(255,255,255,0.6)" : "#999"}
                        style={styles.recalledIcon}
                      />
                      <Text
                        style={[
                          styles.messageText,
                          isMe ? styles.myMessageText : styles.otherMessageText,
                          styles.recalledMessage,
                        ]}
                      >
                        Tin nhắn đã bị thu hồi
                      </Text>
                    </View>
                  ) : msg.type === "text" ? (
                    <Text
                      style={[
                        styles.messageText,
                        isMe ? styles.myMessageText : styles.otherMessageText,
                      ]}
                    >
                      {msg.content}
                    </Text>
                  ) : msg.type === "file" ? (
                    <TouchableOpacity
                      style={styles.fileContainer}
                      onPress={() => handleFilePress(msg)}
                    >
                      <Ionicons
                        name={getFileIcon(msg.fileType)}
                        size={24}
                        color={isMe ? "white" : "#666"}
                      />
                      <Text
                        style={[
                          styles.fileName,
                          isMe ? styles.myMessageText : styles.otherMessageText,
                        ]}
                        numberOfLines={1}
                      >
                        {msg.content}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  <View style={styles.messageFooter}>
                    <Text
                      style={[
                        styles.messageTime,
                        isMe ? styles.myMessageTime : styles.otherMessageTime,
                      ]}
                    >
                      {formatTime(msg.createdAt)}
                    </Text>
                    {isMe && (
                      <Text
                        style={[
                          styles.messageStatus,
                          isMe
                            ? styles.myMessageStatus
                            : styles.otherMessageStatus,
                        ]}
                      >
                        {msg.status === "sending"
                          ? "Đang gửi..."
                          : msg.status === "sent"
                          ? "✓"
                          : msg.status === "error"
                          ? "✕"
                          : msg.status === "recalled"
                          ? "Đã thu hồi"
                          : ""}
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
      </ScrollView>

      {/* Message Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        style={styles.inputContainer}
      >
        <TouchableOpacity style={styles.attachButton}>
          <Ionicons name="attach-outline" size={24} color="#666" />
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="Nhập tin nhắn..."
          placeholderTextColor="#999"
          value={message}
          onChangeText={setMessage}
          multiline
        />

        <TouchableOpacity
          style={styles.sendButton}
          onPress={handleSendMessage}
          disabled={!message.trim() && !selectedFiles.length}
        >
          <Ionicons
            name="send"
            size={24}
            color={message.trim() || selectedFiles.length ? "#2196F3" : "#999"}
          />
        </TouchableOpacity>
      </KeyboardAvoidingView>

      {/* Message Options Modal */}
      <Modal
        visible={showOptionsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowOptionsModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowOptionsModal(false)}
        >
          <View style={styles.optionsModalContent}>
            {selectedMessage &&
              (selectedMessage.isMe ||
                selectedMessage.senderId === currentUserId) &&
              new Date().getTime() -
                new Date(selectedMessage.createdAt).getTime() <=
                24 * 60 * 60 * 1000 && (
                <TouchableOpacity
                  style={styles.optionButton}
                  onPress={() => {
                    handleRecallMessage(selectedMessage.groupMessageId);
                    setShowOptionsModal(false);
                  }}
                >
                  <Ionicons name="arrow-undo" size={24} color="#1877f2" />
                  <Text style={styles.optionText}>Thu hồi</Text>
                </TouchableOpacity>
              )}

            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => {
                setForwardModalVisible(true);
                setShowOptionsModal(false);
              }}
            >
              <Ionicons name="arrow-redo" size={24} color="#1877f2" />
              <Text style={styles.optionText}>Chuyển tiếp</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => {
                handleDeleteMessage(selectedMessage.groupMessageId);
                setShowOptionsModal(false);
              }}
            >
              <Ionicons name="trash" size={24} color="#ff3b30" />
              <Text style={[styles.optionText, styles.deleteText]}>Xóa</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => setShowOptionsModal(false)}
            >
              <Ionicons name="close" size={24} color="#666" />
              <Text style={styles.optionText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Forward Message Modal */}
      <ForwardMessageModal
        visible={forwardModalVisible}
        onClose={() => {
          setForwardModalVisible(false);
          setSelectedMessage(null);
        }}
        onForward={handleForwardMessage}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8EEF7",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: "#2196F3",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    marginLeft: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
  },
  headerButton: {
    padding: 8,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    flexGrow: 1,
  },
  messageContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginVertical: 2,
  },
  myMessage: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingLeft: "15%",
    paddingRight: 8,
  },
  otherMessage: {
    flexDirection: "row",
    justifyContent: "flex-start",
    paddingRight: "15%",
    paddingLeft: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 4,
  },
  messageBubble: {
    padding: 8,
    borderRadius: 16,
    maxWidth: "100%",
  },
  myMessageBubble: {
    backgroundColor: "#1877f2",
    borderTopRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: "#E4E6EB",
    borderTopLeftRadius: 4,
  },
  senderName: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
    fontWeight: "500",
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: "white",
  },
  otherMessageText: {
    color: "black",
  },
  messageFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 4,
  },
  messageTime: {
    fontSize: 10,
  },
  myMessageTime: {
    color: "rgba(255, 255, 255, 0.8)",
  },
  otherMessageTime: {
    color: "#666",
  },
  messageStatus: {
    fontSize: 10,
    marginLeft: 4,
  },
  myMessageStatus: {
    color: "rgba(255, 255, 255, 0.8)",
  },
  otherMessageStatus: {
    color: "#666",
  },
  fileContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    padding: 8,
    borderRadius: 8,
  },
  fileName: {
    marginLeft: 8,
    flex: 1,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  attachButton: {
    padding: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    padding: 8,
    marginLeft: 5,
  },
  containerCentered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#E8EEF7",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  optionsModalContent: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    width: "80%",
    maxWidth: 300,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f2f5",
  },
  optionText: {
    fontSize: 16,
    marginLeft: 15,
    color: "#333",
  },
  deleteText: {
    color: "#ff3b30",
  },
  recalledMessageContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  recalledIcon: {
    marginRight: 4,
  },
  recalledMessage: {
    fontStyle: "italic",
    opacity: 0.7,
  },
});

// Thêm hàm helper để lấy icon cho loại file
const getFileIcon = (fileType) => {
  if (fileType?.startsWith("image/")) return "image-outline";
  if (fileType?.startsWith("video/")) return "videocam-outline";
  if (fileType?.startsWith("audio/")) return "musical-notes-outline";
  return "document-outline";
};

export default GroupChatScreen;
