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
import { WebView } from 'react-native-webview';
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
  const [recalledMessages, setRecalledMessages] = useState(new Set()); // Thêm state mới để theo dõi tin nhắn đã thu hồi
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
  const [showDocumentPreview, setShowDocumentPreview] = useState(false);
  const [previewDocument, setPreviewDocument] = useState(null);

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
        // Xử lý các tin nhắn theo ngày
        const messageArray = await Promise.all(
          Object.entries(response.data.messages).flatMap(([date, messages]) =>
            messages.map(async (msg) => {
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

              return {
                ...msg,
                ...senderInfo,
                status: msg.status || "sent",
                isMe,
              };
            })
          )
        );

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

        newSocket.on("group-message-deleted", (deleteData) => {
          console.log("Received delete event:", deleteData);
          if (deleteData.groupId === groupId) {
            // Nếu người dùng hiện tại là người xóa, xóa tin nhắn khỏi UI
            if (deleteData.deletedBy === userId) {
              console.log(
                "User is the deleter, removing message:",
                deleteData.deletedMessageId
              );
              setMessages((prev) =>
                prev.filter(
                  (msg) => msg.groupMessageId !== deleteData.deletedMessageId
                )
              );
            }
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

      const messageAge = Date.now() - new Date(targetMessage.createdAt).getTime();
      const MAX_RECALL_TIME = 24 * 60 * 60 * 1000; // 24h

      if (messageAge > MAX_RECALL_TIME) {
        Alert.alert(
          "Không thể thu hồi",
          "Tin nhắn chỉ có thể được thu hồi trong vòng 24h sau khi gửi"
        );
        return;
      }

      const response = await recallGroupMessage(groupId, messageId);
      if (response.status === "success") {
        setRecalledMessages((prev) => new Set([...prev, messageId]));
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.groupMessageId === messageId) {
              return {
                ...msg,
                content: "Tin nhắn đã bị thu hồi",
                status: "recalled",
                metadata: {
                  ...msg.metadata,
                  recalledBy: response.data.recalledBy,
                  recalledAt: response.data.recalledAt,
                },
              };
            }
            return msg;
          })
        );

        socket?.emit("recall-group-message", {
          groupId,
          messageId,
          content: "Tin nhắn đã bị thu hồi",
          recalledBy: response.data.recalledBy,
          recalledAt: response.data.recalledAt,
        });
      }
    } catch (error) {
      console.error("Error recalling message:", error);
      Alert.alert("Lỗi", "Đã xảy ra lỗi khi thu hồi tin nhắn");
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

      const response = await deleteGroupMessage(groupId, messageId);
      if (response.status === "success") {
        setMessages((prev) =>
          prev.filter((msg) => msg.groupMessageId !== messageId)
        );
        Alert.alert("Thành công", "Tin nhắn đã được xóa");
      } else {
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

  const showMessageOptions = (message) => {
    setSelectedMessage(message);
    const isMe = message.isMe || message.senderId === currentUserId;

    if (isMe) {
      const messageAge = Date.now() - new Date(message.createdAt).getTime();
      const MAX_RECALL_TIME = 24 * 60 * 60 * 1000; // 24h

      if (messageAge <= MAX_RECALL_TIME) {
        setShowOptionsModal(true);
      } else {
        setShowOptionsModal(true);
      }
    } else {
      setShowOptionsModal(true);
    }
  };

  const loadMoreMessages = async () => {
    if (isLoadingMore || !hasMoreMessages) return;

    try {
      setIsLoadingMore(true);
      console.log("Loading more messages...");

      const response = await getGroupMessages(groupId, {
        limit: 20,
        lastEvaluatedKey: lastEvaluatedKey,
      });

      if (response.status === "success" && response.data.messages) {
        const newMessages = response.data.messages;

        if (newMessages.length > 0) {
          setMessages((prevMessages) => [...newMessages, ...prevMessages]);
          setLastEvaluatedKey(response.data.lastEvaluatedKey);
        } else {
          setHasMoreMessages(false);
        }
      }
    } catch (error) {
      console.error("Error loading more messages:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);

      const formData = new FormData();
      files.forEach((file) => {
        const fileObject = {
          uri: file.uri,
          type: file.type || file.mimeType,
          name: file.name,
        };
        console.log("File object:", fileObject);
        formData.append("files", fileObject);
      });

      console.log("FormData:", formData);

      const token = await getAccessToken();
      console.log("Token:", token);

      const uploadUrl = `${getApiUrl()}/chat-group/${groupId}/upload`;
      console.log("Upload URL:", uploadUrl);

      const response = await axios.post(
        uploadUrl,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
            Accept: "application/json",
          },
          onUploadProgress: (progressEvent) => {
            const progress = (progressEvent.loaded / progressEvent.total) * 100;
            setUploadProgress(progress);
          },
        }
      );

      console.log("Upload response:", response.data);

      if (response.data.status === "success") {
        const uploadedFiles = response.data.data.files;
        const fileUrls = response.data.data.urls;
        
        console.log("Uploaded files:", uploadedFiles);
        console.log("File URLs:", fileUrls);

        if (!uploadedFiles || !fileUrls || uploadedFiles.length !== fileUrls.length) {
          throw new Error("Dữ liệu file không hợp lệ từ server");
        }

        // Tạo và lưu tin nhắn cho mỗi file
        for (let i = 0; i < uploadedFiles.length; i++) {
          const file = uploadedFiles[i];
          const fileUrl = fileUrls[i];
          
          try {
            // Gọi API để lưu tin nhắn vào DynamoDB
            const messageResponse = await sendGroupMessage(
              groupId,
              fileUrl,
              "file",
              file.mimetype
            );

            console.log("Message saved to DynamoDB:", messageResponse);

            if (messageResponse.status === "success") {
              // Tạo tin nhắn với ID thật từ DynamoDB
              const message = {
                groupMessageId: messageResponse.data.groupMessageId,
                senderId: currentUserId,
                content: fileUrl,
                type: "file",
                fileType: file.mimetype,
                createdAt: new Date().toISOString(),
                status: "sent",
                isTempId: false,
                senderName: "You",
                senderAvatar: null,
              };

              // Thêm tin nhắn vào danh sách
              setMessages((prev) => {
                const uniqueMessages = prev.filter(
                  (msg) => msg.groupMessageId !== message.groupMessageId
                );
                return [...uniqueMessages, message].sort(
                  (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
                );
              });

              // Gửi tin nhắn qua socket
              if (socket) {
                console.log("Emitting socket message with content:", fileUrl);
                socket.emit("new-group-message", {
                  groupId: groupId,
                  senderId: currentUserId,
                  content: fileUrl,
                  type: "file",
                  fileType: file.mimetype,
                  createdAt: message.createdAt,
                  status: "sent",
                  groupMessageId: message.groupMessageId
                });
              }
            } else {
              throw new Error(messageResponse.message || "Failed to save message");
            }
          } catch (error) {
            console.error("Error saving message to DynamoDB:", error);
            Alert.alert("Lỗi", "Không thể lưu tin nhắn");
          }
        }

        // Đóng modal và xóa danh sách file đã chọn
        setShowFilePreview(false);
        setSelectedFiles([]);
        scrollToBottom();
      } else {
        throw new Error(response.data.message || "Upload failed");
      }
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert("Lỗi", error.message || "Không thể tải lên file");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleAttachPress = async () => {
    Alert.alert(
      "Chọn loại file",
      "Bạn muốn đính kèm loại file nào?",
      [
        {
          text: "Hình ảnh",
          onPress: async () => {
            try {
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: "Images",
                allowsMultipleSelection: true,
                selectionLimit: 10,
                quality: 1,
              });

              if (!result.canceled) {
                const newFiles = result.assets.map((asset) => ({
                  uri: asset.uri,
                  type: "image/jpeg",
                  name: `image_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`,
                  mimeType: asset.mimeType || "image/jpeg",
                  size: asset.fileSize || 0,
                }));
                setSelectedFiles((prev) => [...prev, ...newFiles]);
                setShowFilePreview(true);
              }
            } catch (error) {
              console.error("Error picking image:", error);
              Alert.alert("Lỗi", "Không thể chọn ảnh");
            }
          }
        },
        {
          text: "Video",
          onPress: async () => {
            try {
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: "Videos",
                allowsMultipleSelection: true,
                selectionLimit: 5,
                quality: 1,
              });

              if (!result.canceled) {
                const newFiles = result.assets.map((asset) => ({
                  uri: asset.uri,
                  type: "video/mp4",
                  name: `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`,
                  mimeType: asset.mimeType || "video/mp4",
                  size: asset.fileSize || 0,
                }));
                setSelectedFiles((prev) => [...prev, ...newFiles]);
                setShowFilePreview(true);
              }
            } catch (error) {
              console.error("Error picking video:", error);
              Alert.alert("Lỗi", "Không thể chọn video");
            }
          }
        },
        {
          text: "Tài liệu",
          onPress: async () => {
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: [
                  "application/pdf",
                  "application/msword",
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                  "application/vnd.ms-powerpoint",
                  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                  "application/vnd.ms-excel",
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                  "text/plain",
                ],
                multiple: true,
                copyToCacheDirectory: true,
              });

              if (result.type !== "cancel") {
                const newFiles = result.assets.map((asset) => ({
                  uri: asset.uri,
                  type: asset.mimeType,
                  name: asset.name,
                  mimeType: asset.mimeType,
                  size: asset.size || 0,
                }));
                setSelectedFiles((prev) => [...prev, ...newFiles]);
                setShowFilePreview(true);
              }
            } catch (error) {
              console.error("Error picking document:", error);
              Alert.alert("Lỗi", "Không thể chọn tài liệu");
            }
          }
        },
        {
          text: "Hủy",
          style: "cancel"
        }
      ]
    );
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (fileType) => {
    if (fileType?.startsWith("image/")) return "image-outline";
    if (fileType?.startsWith("video/")) return "videocam-outline";
    if (fileType?.startsWith("audio/")) return "musical-notes-outline";
    return "document-outline";
  };

  const handleFilePress = async (message) => {
    try {
      if (message.type === "file" && message.content) {
        if (message.fileType?.startsWith("image/")) {
          setPreviewImage(message.content);
          setShowImagePreview(true);
        } else if (message.fileType?.startsWith("video/")) {
          setPreviewVideo(message.content);
          setShowVideoPreview(true);
        } else if (message.fileType?.includes("pdf") || message.fileType?.includes("word") || message.fileType?.includes("powerpoint")) {
          // Mở file trực tiếp với Google Drive Viewer
          const driveUrl = `https://drive.google.com/viewerng/viewer?embedded=true&url=${encodeURIComponent(message.content)}`;
          Linking.openURL(driveUrl);
        } else {
          // Xử lý các loại file khác
          try {
            const fileUrl = message.content;
            const driveUrl = `https://drive.google.com/viewerng/viewer?embedded=true&url=${encodeURIComponent(fileUrl)}`;
            await Linking.openURL(driveUrl);
          } catch (error) {
            console.error("Error handling file press:", error);
            Alert.alert("Lỗi", "Không thể mở file: " + error.message);
          }
        }
      }
    } catch (error) {
      console.error("Error handling file press:", error);
      Alert.alert("Lỗi", "Không thể mở file: " + error.message);
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
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.groupMessageId || item.id}
        renderItem={({ item }) => {
          if (item.type === "system") return null;

          // Kiểm tra nếu tin nhắn đã bị xóa
          if (deletedMessages.has(item.groupMessageId)) {
            console.log("Message is in deletedMessages:", item.groupMessageId);
            return null;
          }

          const isMe = item.isMe || item.senderId === currentUserId;
          const isRecalled =
            item.status === "recalled" ||
            recalledMessages.has(item.groupMessageId);

          return (
            <TouchableOpacity
              key={item.groupMessageId || item.id}
              onLongPress={() => showMessageOptions(item)}
              style={[
                styles.messageContainer,
                isMe ? styles.myMessage : styles.otherMessage,
              ]}
            >
              {!isMe && (
                <Image
                  source={{
                    uri: item.senderAvatar || "https://via.placeholder.com/50",
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
                    {item.senderName || "Người dùng"}
                  </Text>
                )}
                {isRecalled ? (
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
                ) : item.type === "text" ? (
                  <Text
                    style={[
                      styles.messageText,
                      isMe ? styles.myMessageText : styles.otherMessageText,
                    ]}
                  >
                    {item.content}
                  </Text>
                ) : item.type === "file" ? (
                  <TouchableOpacity
                    style={styles.fileContainer}
                    onPress={() => handleFilePress(item)}
                  >
                    {item.fileType?.startsWith("image/") ? (
                      <Image
                        source={{ uri: item.content }}
                        style={styles.fileImage}
                        resizeMode="cover"
                        onError={(e) => {
                          console.error("Error loading image:", e.nativeEvent.error);
                          Alert.alert("Lỗi", "Không thể tải ảnh");
                        }}
                      />
                    ) : item.fileType?.startsWith("video/") ? (
                      <View style={styles.videoContainer}>
                        <Video
                          source={{ uri: item.content }}
                          style={styles.video}
                          resizeMode="cover"
                          useNativeControls
                          onError={(e) => {
                            console.error("Error loading video:", e.nativeEvent.error);
                            Alert.alert("Lỗi", "Không thể tải video");
                          }}
                        />
                        <View style={styles.playButton}>
                          <Ionicons name="play" size={24} color="white" />
                        </View>
                      </View>
                    ) : (
                      <View style={styles.documentContainer}>
                        <Ionicons
                          name={getFileIcon(item.fileType)}
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
                          {item.content.split("/").pop() || "Tài liệu"}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ) : null}
                <View style={styles.messageFooter}>
                  <Text
                    style={[
                      styles.messageTime,
                      isMe ? styles.myMessageTime : styles.otherMessageTime,
                    ]}
                  >
                    {formatTime(item.createdAt)}
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
                      {item.status === "sending"
                        ? "Đang gửi..."
                        : item.status === "sent"
                        ? "✓"
                        : item.status === "error"
                        ? "✕"
                        : item.status === "recalled"
                        ? "Đã thu hồi"
                        : ""}
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        onEndReached={loadMoreMessages}
        onEndReachedThreshold={0.5}
        inverted={false}
        contentContainerStyle={styles.scrollContent}
        ListFooterComponent={() =>
          isLoadingMore ? (
            <View style={styles.loadingMoreContainer}>
              <ActivityIndicator size="small" color="#2196F3" />
            </View>
          ) : null
        }
      />

      {/* Message Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        style={styles.inputContainer}
      >
        <TouchableOpacity 
          style={styles.attachButton}
          onPress={handleAttachPress}
        >
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
            {selectedMessage && (
              <>
                {/* Tùy chọn cho tin nhắn của mình */}
                {selectedMessage.senderId === currentUserId && (
                  <>
                    {new Date().getTime() -
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
                      <Text style={[styles.optionText, styles.deleteText]}>
                        Xóa
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* Tùy chọn cho tin nhắn của người khác */}
                {selectedMessage.senderId !== currentUserId && (
                  <>
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
                      <Text style={[styles.optionText, styles.deleteText]}>
                        Xóa
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* Nút Thoát chung cho cả hai trường hợp */}
                <TouchableOpacity
                  style={styles.optionButton}
                  onPress={() => setShowOptionsModal(false)}
                >
                  <Ionicons name="close" size={24} color="#666" />
                  <Text style={styles.optionText}>Thoát</Text>
                </TouchableOpacity>
              </>
            )}
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

      {showImagePreview && (
        <Modal visible={showImagePreview} transparent={true} animationType="fade">
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowImagePreview(false)}
              >
                <Ionicons name="close" size={30} color="white" />
              </TouchableOpacity>
            </View>
            <Image
              source={{ uri: previewImage }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          </View>
        </Modal>
      )}

      {showVideoPreview && (
        <Modal visible={showVideoPreview} transparent={true} animationType="fade">
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowVideoPreview(false)}
              >
                <Ionicons name="close" size={30} color="white" />
              </TouchableOpacity>
            </View>
            <Video
              source={{ uri: previewVideo }}
              style={styles.fullscreenVideo}
              resizeMode="contain"
              useNativeControls
              shouldPlay
            />
          </View>
        </Modal>
      )}

      {showDocumentPreview && (
        <Modal visible={showDocumentPreview} transparent={true} animationType="fade">
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowDocumentPreview(false)}
              >
                <Ionicons name="close" size={30} color="white" />
              </TouchableOpacity>
            </View>
            <WebView
              source={{ uri: previewDocument }}
              style={styles.fullscreenDocument}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#1877f2" />
                </View>
              )}
            />
          </View>
        </Modal>
      )}

      {/* File Preview Modal */}
      <Modal
        visible={showFilePreview}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFilePreview(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Đã chọn {selectedFiles.length} file
            </Text>
            <ScrollView style={styles.fileList}>
              {selectedFiles.map((file, index) => (
                <View key={index} style={styles.fileItem}>
                  <Ionicons
                    name={getFileIcon(file.type)}
                    size={24}
                    color="#1877f2"
                  />
                  <View style={styles.fileInfo}>
                    <Text style={styles.fileName} numberOfLines={1}>
                      {file.name}
                    </Text>
                    <Text style={styles.fileSize}>
                      {formatFileSize(file.size)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.removeFileButton}
                    onPress={() => {
                      const newFiles = [...selectedFiles];
                      newFiles.splice(index, 1);
                      setSelectedFiles(newFiles);
                      if (newFiles.length === 0) setShowFilePreview(false);
                    }}
                  >
                    <Ionicons name="close-circle" size={24} color="#666" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
            {isUploading ? (
              <View style={styles.uploadStatus}>
                <Text>Đang upload... {uploadProgress}%</Text>
              </View>
            ) : (
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setShowFilePreview(false);
                    setSelectedFiles([]);
                  }}
                >
                  <Text style={styles.buttonText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.sendButton]}
                  onPress={() => handleUpload(selectedFiles)}
                  disabled={selectedFiles.length === 0}
                >
                  <Text style={styles.buttonText}>Gửi</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
    padding: 5,
  },
  fileImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
  },
  videoContainer: {
    width: 200,
    height: 200,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  playButton: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -12 }, { translateY: -12 }],
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  documentContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.1)",
    padding: 8,
    borderRadius: 8,
  },
  fileName: {
    marginLeft: 5,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
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
  loadingMoreContainer: {
    padding: 10,
    alignItems: "center",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 20,
    width: "90%",
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  fileList: {
    maxHeight: 300,
    marginVertical: 10,
  },
  fileItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    marginBottom: 8,
  },
  fileInfo: {
    flex: 1,
    marginLeft: 10,
  },
  fileSize: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  removeFileButton: {
    padding: 5,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  modalButton: {
    padding: 10,
    borderRadius: 5,
    minWidth: 100,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#ccc",
  },
  sendButton: {
    backgroundColor: "#1877f2",
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
  },
  uploadStatus: {
    marginTop: 20,
    alignItems: "center",
  },
  modalHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
    paddingTop: 50,
    zIndex: 1,
  },
  closeButton: {
    padding: 10,
  },
  fullscreenImage: {
    width: "100%",
    height: "100%",
  },
  fullscreenVideo: {
    width: "100%",
    height: "100%",
    backgroundColor: "black",
  },
  fullscreenDocument: {
    width: "100%",
    height: "100%",
    backgroundColor: "white",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "white",
  },
});

export default GroupChatScreen;