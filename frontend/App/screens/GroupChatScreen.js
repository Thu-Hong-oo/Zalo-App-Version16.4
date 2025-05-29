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
import { getAccessToken, getUserId, getUserInfo } from "../services/storage";
import * as ImagePicker from "expo-image-picker";
import { Video } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import ForwardMessageModal from "../components/ForwardMessageModal";
import { getApiUrl, getBaseUrl, api } from "../config/api";
import axios from "axios";
import { WebView } from "react-native-webview";
import { sendMessage, forwardMessage } from "../modules/chat/controller";
import RenderHtml from "react-native-render-html";
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
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showFileTypeModal, setShowFileTypeModal] = useState(false);

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
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      navigation.getParent()?.setOptions({
        tabBarStyle: { display: "none" },
        tabBarVisible: false,
      });
    });

    const unsubscribeBlur = navigation.addListener("blur", () => {
      navigation.getParent()?.setOptions({
        tabBarStyle: undefined,
        tabBarVisible: true,
      });
    });

    return () => {
      unsubscribe();
      unsubscribeBlur();
      navigation.getParent()?.setOptions({
        tabBarStyle: undefined,
        tabBarVisible: true,
      });
    };
  }, [navigation]);

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
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const hours = date.getHours();
    const minutes =
      date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes();

    if (isToday) {
      return `${hours}:${minutes} Hôm nay`;
    } else {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) {
        return `${hours}:${minutes} Hôm qua`;
      } else {
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        return `${hours}:${minutes} ${day}/${month}`;
      }
    }
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
          reconnectionDelayMax: 5000,
          randomizationFactor: 0.5,
          autoConnect: true,
        });

        newSocket.on("connect", () => {
          console.log("Connected to socket server");
          newSocket.emit("join-group", groupId);
        });

        newSocket.on("connect_error", (error) => {
          console.error("Socket connection error:", error);
          // Thử kết nối lại sau 3 giây
          setTimeout(() => {
            if (!newSocket.connected) {
              console.log("Attempting to reconnect...");
              newSocket.connect();
            }
          }, 3000);
        });

        newSocket.on("disconnect", (reason) => {
          console.log("Socket disconnected:", reason);
          if (
            reason === "io server disconnect" ||
            reason === "transport close"
          ) {
            // Server đã ngắt kết nối hoặc kết nối bị đóng, thử kết nối lại
            setTimeout(() => {
              if (!newSocket.connected) {
                console.log("Attempting to reconnect after disconnect...");
                newSocket.connect();
              }
            }, 3000);
          }
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

        return () => {
          if (newSocket) {
            newSocket.disconnect();
          }
        };
      } catch (error) {
        console.error("Socket initialization error:", error);
      }
    };

    initSocket();
    loadChatHistory();

    return () => {
      if (socket) {
        socket.disconnect();
      }
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
        const currentTime = new Date().toISOString();

        const newMessage = {
          groupMessageId: tempId,
          tempId: tempId,
          senderId: currentUserId,
          content: message.trim(),
          type: "text",
          createdAt: currentTime,
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
          const serverTimestamp = response.data.createdAt || currentTime;

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
                      createdAt: serverTimestamp,
                    }
                  : msg
              );
            return updatedMessages.sort(
              (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
            );
          });

          // Update group's lastMessage with server timestamp
          try {
            const token = await getAccessToken();
            const lastMessageData = {
              lastMessage: {
                content: message.trim(),
                type: "text",
                senderId: currentUserId,
                timestamp: serverTimestamp,
              },
              lastMessageAt: serverTimestamp,
            };

            await axios.put(
              `${getApiUrl()}/groups/${groupId}`,
              lastMessageData,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
              }
            );

            if (socket) {
              socket.emit("group:updated", {
                groupId,
                type: "LAST_MESSAGE_UPDATED",
                data: {
                  ...lastMessageData.lastMessage,
                  lastMessageAt: serverTimestamp,
                },
              });
            }
          } catch (error) {
            console.error("Error updating group's lastMessage:", error);
          }
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

        // Update group's lastMessage to null when recalling
        try {
          const token = await getAccessToken();
          await axios.put(
            `${getApiUrl()}/groups/${groupId}`,
            {
              lastMessage: null,
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
        } catch (error) {
          console.error(
            "Error updating group's lastMessage after recall:",
            error
          );
        }
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

  const handleForwardMessage = async (receivers) => {
    try {
      if (!selectedMessage) {
        Alert.alert("Lỗi", "Không có tin nhắn được chọn");
        return;
      }

      console.log("Selected message for forwarding:", selectedMessage);
      const currentTime = new Date().toISOString();

      const results = await Promise.all(
        receivers.map(async (receiver) => {
          try {
            if (receiver.type === "conversation") {
              const tempId = `temp-${Date.now()}-${Math.random()
                .toString(36)
                .substr(2, 9)}`;

              let messageData = {
                tempId,
                receiverPhone: receiver.id,
                content: selectedMessage.content,
                type: "text",
                timestamp: currentTime,
              };

              if (
                selectedMessage.type === "file" ||
                selectedMessage.content.match(
                  /\.(jpg|jpeg|png|gif|mp4|mov|avi)$/i
                )
              ) {
                messageData = {
                  ...messageData,
                  type: "file",
                  fileType:
                    selectedMessage.fileType ||
                    (selectedMessage.content.match(/\.(jpg|jpeg|png|gif)$/i)
                      ? "image/jpeg"
                      : selectedMessage.content.match(/\.(mp4|mov|avi)$/i)
                      ? "video/mp4"
                      : "application/octet-stream"),
                  fileName:
                    selectedMessage.fileName ||
                    selectedMessage.content.split("/").pop(),
                  fileSize: selectedMessage.fileSize,
                };

                // Update group's lastMessage for file messages
                try {
                  const token = await getAccessToken();
                  const lastMessageData = {
                    lastMessage: {
                      content: messageData.content,
                      type: "file",
                      senderId: currentUserId,
                      timestamp: currentTime,
                      fileType: messageData.fileType,
                    },
                    lastMessageAt: currentTime,
                  };

                  await axios.put(
                    `${getApiUrl()}/groups/${groupId}`,
                    lastMessageData,
                    {
                      headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                      },
                    }
                  );

                  if (socket) {
                    socket.emit("group:updated", {
                      groupId,
                      type: "LAST_MESSAGE_UPDATED",
                      data: {
                        ...lastMessageData.lastMessage,
                        lastMessageAt: currentTime,
                      },
                    });
                  }
                } catch (error) {
                  console.error(
                    "Error updating group's lastMessage for file:",
                    error
                  );
                }
              }

              if (messageData.type === "file") {
                socket.emit("send-message", {
                  ...messageData,
                  fileUrl: messageData.content,
                  preview: messageData.content,
                });
              } else {
                console.log(
                  "APP EMITTING send-message:",
                  JSON.stringify(messageData, null, 2)
                ); // <--- LOG CÁI NÀY

                socket.emit("send-message", messageData);
              }

              return { success: true, response: { tempId } };
            }

            // Logic chuyển tiếp đến nhóm
            const response = await forwardGroupMessage(
              groupId,
              selectedMessage.groupMessageId,
              receiver.id,
              receiver.type
            );
            return { success: response.status === "success", response };
          } catch (error) {
            console.error("Error forwarding to receiver:", receiver.id, error);
            return { success: false, error };
          }
        })
      );

      const failedForwards = results.filter((r) => !r.success);
      if (failedForwards.length === 0) {
        setForwardModalVisible(false);
        Alert.alert("Thành công", "Tin nhắn đã được chuyển tiếp");
      } else {
        throw new Error(
          failedForwards[0].error?.message || "Không thể chuyển tiếp tin nhắn"
        );
      }
    } catch (error) {
      console.error("Error forwarding message:", error);
      Alert.alert("Lỗi", error.message || "Không thể chuyển tiếp tin nhắn");
    } finally {
      setSelectedMessage(null);
    }
  };

  // Thêm hàm trích xuất tên file từ URL
  const extractFilenameFromUrl = (url) => {
    if (!url) return null;

    try {
      // Try to get the filename from the URL
      const urlParts = url.split("/");
      const lastPart = urlParts[urlParts.length - 1];

      // Check if the URL contains a filename parameter
      const urlParams = new URLSearchParams(url);
      const filenameParam = urlParams.get("filename");

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

      const response = await axios.post(uploadUrl, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
          Accept: "application/json",
        },
        onUploadProgress: (progressEvent) => {
          const progress = (
            (progressEvent.loaded / progressEvent.total) *
            100
          ).toFixed(2);
          setUploadProgress(progress);
        },
      });

      console.log("Upload response:", response.data);

      if (response.data.status === "error") {
        setErrorMessage(response.data.message || "Không thể upload file");
        setShowErrorModal(true);
        return;
      }

      setUploadProgress(100);

      if (response.data.status === "success") {
        const uploadedFiles = response.data.data.files;
        const fileUrls = response.data.data.urls;

        console.log("Uploaded files:", uploadedFiles);
        console.log("File URLs:", fileUrls);

        if (
          !uploadedFiles ||
          !fileUrls ||
          uploadedFiles.length !== fileUrls.length
        ) {
          setErrorMessage("Dữ liệu file không hợp lệ từ server");
          setShowErrorModal(true);
          return;
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
                  groupMessageId: message.groupMessageId,
                });
              }
            } else {
              setErrorMessage(
                messageResponse.message || "Failed to save message"
              );
              setShowErrorModal(true);
            }
          } catch (error) {
            console.error("Error saving message to DynamoDB:", error);
            setErrorMessage(error.message || "Không thể lưu tin nhắn");
            setShowErrorModal(true);
          }
        }

        // Đóng modal và xóa danh sách file đã chọn
        setShowFilePreview(false);
        setSelectedFiles([]);
        scrollToBottom();
      }
    } catch (error) {
      console.error("Upload error:", error);
      setErrorMessage(
        error.response?.data?.message || "Không thể tải lên file"
      );
      setShowErrorModal(true);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleAttachPress = async () => {
    setShowFileTypeModal(true);
  };

  const handleFileTypeSelect = async (type) => {
    setShowFileTypeModal(false);
    try {
      if (type === "image") {
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
            name: `image_${Date.now()}_${Math.random()
              .toString(36)
              .substr(2, 9)}.jpg`,
            mimeType: asset.mimeType || "image/jpeg",
            size: asset.fileSize || 0,
          }));
          setSelectedFiles((prev) => [...prev, ...newFiles]);
          setShowFilePreview(true);
        }
      } else if (type === "video") {
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
            name: `video_${Date.now()}_${Math.random()
              .toString(36)
              .substr(2, 9)}.mp4`,
            mimeType: asset.mimeType || "video/mp4",
            size: asset.fileSize || 0,
          }));
          setSelectedFiles((prev) => [...prev, ...newFiles]);
          setShowFilePreview(true);
        }
      } else if (type === "document") {
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
      }
    } catch (error) {
      console.error(`Error picking ${type}:`, error);
      Alert.alert(
        "Lỗi",
        `Không thể chọn ${
          type === "image" ? "ảnh" : type === "video" ? "video" : "tài liệu"
        }`
      );
    }
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

  const downloadFile = async (url) => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Lỗi", "Cần quyền truy cập thư viện để tải file");
        return;
      }

      const fileUri = FileSystem.documentDirectory + url.split("/").pop();
      const downloadResult = await FileSystem.downloadAsync(url, fileUri);

      if (downloadResult.status === 200) {
        const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
        await MediaLibrary.createAlbumAsync("Zalo Lite", asset, false);
        Alert.alert("Thành công", "File đã được tải xuống thư viện");
      } else {
        Alert.alert("Lỗi", "Không thể tải file");
      }
    } catch (error) {
      console.error("Error downloading file:", error);
      Alert.alert("Lỗi", "Không thể tải file");
    }
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
        } else if (
          message.fileType?.includes("pdf") ||
          message.fileType?.includes("word") ||
          message.fileType?.includes("powerpoint")
        ) {
          // Hiển thị modal với thông tin file và các tùy chọn
          setPreviewDocument(message.content);
          setShowDocumentPreview(true);
        } else {
          // Xử lý các loại file khác
          try {
            const fileUrl = message.content;
            await Linking.openURL(fileUrl);
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

  const getFileTypeName = (extension) => {
    const types = {
      pdf: "PDF Document",
      doc: "Microsoft Word",
      docx: "Microsoft Word",
      xls: "Microsoft Excel",
      xlsx: "Microsoft Excel",
      ppt: "Microsoft PowerPoint",
      pptx: "Microsoft PowerPoint",
      txt: "Text Document",
    };
    return types[extension?.toLowerCase()] || "Unknown File Type";
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
            {groupDetails.members
              ? `${groupDetails.members.length} thành viên`
              : `${initialMemberCount} thành viên`}{" "}
            {/* Cập nhật số lượng từ API */}
          </Text>
        </View>

        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="videocam" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="search" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate("GroupSetting", { groupId })}
        >
          <Ionicons name="menu" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Chat Messages */}

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.groupMessageId || item.id}
        renderItem={({ item }) => {
          const isMyMessage = item.senderId === currentUserId;
          if (item.status === "deleted") return null;

          const renderMessageContent = () => {
            if (item.type === "system") {
              return (
                <View style={styles.systemMessageContainer}>
                  <View style={styles.systemMessageBubble}>
                    <Ionicons
                      name="information-circle-outline"
                      size={18}
                      color="#2196F3"
                    />
                    <RenderHtml
                      contentWidth={SCREEN_WIDTH}
                      source={{ html: item.content }}
                      baseStyle={styles.systemMessageText}
                    />
                  </View>
                  <Text
                    style={[
                      styles.messageTime,
                      { color: "#888", marginTop: 2 },
                    ]}
                  >
                    {formatTime(item.createdAt)}
                  </Text>
                </View>
              );
            }
            if (item.status === "recalled") {
              return (
                <Text
                  style={[
                    styles.messageText,
                    isMyMessage
                      ? styles.myMessageText
                      : styles.otherMessageText,
                    styles.recalledMessage,
                  ]}
                >
                  Tin nhắn đã bị thu hồi
                </Text>
              );
            }

            // Nếu là tin nhắn file
            if (item.type === "file") {
              // Kiểm tra nếu là hình ảnh
              if (
                item.fileType?.startsWith("image/") ||
                item.content.match(/\.(jpg|jpeg|png|gif)$/i)
              ) {
                return (
                  <TouchableOpacity onPress={() => handleFilePress(item)}>
                    <Image
                      source={{ uri: item.content }}
                      style={styles.fileImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                );
              }
              // Kiểm tra nếu là video
              else if (
                item.fileType?.startsWith("video/") ||
                item.content.match(/\.(mp4|mov|avi)$/i)
              ) {
                return (
                  <TouchableOpacity onPress={() => handleFilePress(item)}>
                    <View style={styles.videoContainer}>
                      <Video
                        source={{ uri: item.content }}
                        style={styles.video}
                        resizeMode="cover"
                        useNativeControls
                      />
                      <View style={styles.playButton}>
                        <Ionicons name="play" size={24} color="white" />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }
              // Các loại file khác
              else {
                return (
                  <TouchableOpacity onPress={() => handleFilePress(item)}>
                    <View style={styles.documentContainer}>
                      <Ionicons
                        name={getFileIcon(item.fileType)}
                        size={24}
                        color={isMyMessage ? "white" : "#666"}
                      />
                      <Text
                        style={[
                          styles.fileName,
                          isMyMessage
                            ? styles.myMessageText
                            : styles.otherMessageText,
                        ]}
                      >
                        {item.fileName ||
                          item.content.split("/").pop() ||
                          "Tài liệu"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }
            }

            // Tin nhắn văn bản
            return (
              <Text
                style={[
                  styles.messageText,
                  isMyMessage ? styles.myMessageText : styles.otherMessageText,
                ]}
              >
                {item.content}
              </Text>
            );
          };

          // Nếu là system message thì chỉ render bubble căn giữa, không avatar, không senderName
          if (item.type === "system") {
            return renderMessageContent();
          }

          return (
            <TouchableOpacity
              onLongPress={() => showMessageOptions(item)}
              style={[
                styles.messageContainer,
                isMyMessage ? styles.myMessage : styles.otherMessage,
              ]}
            >
              {item.type !== "system" && !isMyMessage && (
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
                  isMyMessage
                    ? styles.myMessageBubble
                    : styles.otherMessageBubble,
                ]}
              >
                {!isMyMessage && (
                  <Text style={styles.senderName}>
                    {item.senderName || "Người dùng"}
                  </Text>
                )}
                {renderMessageContent()}
                <View style={styles.messageFooter}>
                  <Text
                    style={[
                      styles.messageTime,
                      isMyMessage
                        ? styles.myMessageTime
                        : styles.otherMessageTime,
                    ]}
                  >
                    {formatTime(item.createdAt)}
                  </Text>
                  {isMyMessage && (
                    <Text
                      style={[
                        styles.messageStatus,
                        isMyMessage
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
          <Ionicons name="attach-outline" size={24} color="#65676b" />
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="Nhập tin nhắn..."
          placeholderTextColor="#65676b"
          value={message}
          onChangeText={setMessage}
          multiline
        />

        <TouchableOpacity
          style={[
            styles.sendButton,
            !message.trim() &&
              !selectedFiles.length &&
              styles.sendButtonDisabled,
          ]}
          onPress={handleSendMessage}
          disabled={!message.trim() && !selectedFiles.length}
        >
          <Ionicons
            name="send"
            size={20}
            style={[
              styles.sendIcon,
              !message.trim() &&
                !selectedFiles.length &&
                styles.sendIconDisabled,
            ]}
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

      {/* Image Preview Modal */}
      <Modal visible={showImagePreview} transparent={true} animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowImagePreview(false)}
            >
              <Ionicons name="close" size={30} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={() => downloadFile(previewImage)}
            >
              <Ionicons name="download" size={30} color="white" />
            </TouchableOpacity>
          </View>
          <Image
            source={{ uri: previewImage }}
            style={styles.fullscreenImage}
            resizeMode="contain"
          />
        </View>
      </Modal>

      {/* Video Preview Modal */}
      <Modal visible={showVideoPreview} transparent={true} animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowVideoPreview(false)}
            >
              <Ionicons name="close" size={30} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={() => downloadFile(previewVideo)}
            >
              <Ionicons name="download" size={30} color="white" />
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

      {/* Document Preview Modal */}
      <Modal
        visible={showDocumentPreview}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.documentHeader}>
              <Ionicons
                name={getFileIcon(previewDocument?.split(".").pop())}
                size={50}
                color="#1877f2"
              />
              <Text style={styles.documentTitle} numberOfLines={10}>
                {previewDocument?.split("/").pop() || "Tài liệu"}
              </Text>
            </View>

            <View style={styles.documentInfo}>
              <Text style={styles.documentInfoText}>
                Loại file: {getFileTypeName(previewDocument?.split(".").pop())}
              </Text>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.downloadButton]}
                onPress={() => downloadFile(previewDocument)}
              >
                <Ionicons name="download" size={24} color="white" />
                <Text style={styles.buttonText}>Tải về</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.openButton]}
                onPress={() => Linking.openURL(previewDocument)}
              >
                <Ionicons name="open-outline" size={24} color="white" />
                <Text style={styles.buttonText}>Tải về</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.closeButton]}
                onPress={() => setShowDocumentPreview(false)}
              >
                <Text style={styles.closeButtonText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
                  {file.type.startsWith("image/") ? (
                    <Image
                      source={{ uri: file.uri }}
                      style={styles.fileThumbnail}
                      resizeMode="cover"
                    />
                  ) : file.type.startsWith("video/") ? (
                    <View style={styles.videoThumbnailContainer}>
                      <Video
                        source={{ uri: file.uri }}
                        style={styles.fileThumbnail}
                        resizeMode="cover"
                        shouldPlay={false}
                        isMuted={true}
                        isLooping={false}
                      />
                      <View style={styles.playIconContainer}>
                        <Ionicons name="play" size={20} color="white" />
                      </View>
                    </View>
                  ) : (
                    <Ionicons
                      name={getFileIcon(file.type)}
                      size={24}
                      color="#1877f2"
                    />
                  )}
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

      {/* Error Modal */}
      <Modal
        visible={showErrorModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowErrorModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Lỗi Upload File</Text>
            <Text style={styles.errorMessage}>{errorMessage}</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={() => {
                  setShowErrorModal(false);
                  setShowFilePreview(false);
                  setSelectedFiles([]);
                }}
              >
                <Text style={styles.buttonText}>Xác nhận</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* File Type Selection Modal */}
      <Modal
        visible={showFileTypeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowFileTypeModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowFileTypeModal(false)}
        >
          <View style={styles.fileTypeModalContent}>
            <View style={styles.fileTypeModalHeader}>
              <Text style={styles.fileTypeModalTitle}>Chọn loại file</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowFileTypeModal(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fileTypeModalSubtitle}>
              Bạn muốn đính kèm loại file nào?
            </Text>

            <View style={styles.fileTypeOptions}>
              <TouchableOpacity
                style={styles.fileTypeOption}
                onPress={() => handleFileTypeSelect("image")}
              >
                <Text style={styles.fileTypeOptionText}>HÌNH ẢNH</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.fileTypeOption}
                onPress={() => handleFileTypeSelect("video")}
              >
                <Text style={styles.fileTypeOptionText}>VIDEO</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.fileTypeOption}
                onPress={() => handleFileTypeSelect("document")}
              >
                <Text style={styles.fileTypeOptionText}>TÀI LIỆU</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
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
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    padding: 8,
  },
  documentContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.1)",
    borderRadius: 8,
    maxWidth: 250,
  },
  fileName: {
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E8EEF7",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 5,
  },
  attachButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: "#f0f2f5",
    marginRight: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "#f0f2f5",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 16,
    color: "#1c1e21",
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: "#1877f2",
    transform: [{ rotate: "45deg" }],
  },
  sendButtonDisabled: {
    backgroundColor: "#f0f2f5",
  },
  sendIcon: {
    transform: [{ rotate: "-45deg" }],
    color: "#ffffff",
  },
  sendIconDisabled: {
    color: "#bcc0c4",
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
    backgroundColor: "rgba(0,0,0,1)", // Màu background của modal khi click vào preview ảnh
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 15,
    width: "100%",
    maxWidth: 400,
    maxHeight: "80%",
    padding: 20,
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
  fileThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 4,
    marginRight: 10,
  },
  fileInfo: {
    flex: 1,
    marginLeft: 10,
  },
  fileName: {
    fontSize: 14,
    color: "#333",
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 12,
    color: "#666",
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
  downloadButton: {
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
  errorMessage: {
    fontSize: 16,
    color: "#ff3b30",
    textAlign: "center",
    marginVertical: 20,
    paddingHorizontal: 20,
  },
  confirmButton: {
    backgroundColor: "#1877f2",
  },
  documentHeader: {
    alignItems: "center",
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  documentTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 10,
    textAlign: "center",
    color: "#333",
  },
  documentInfo: {
    width: "100%",
    padding: 15,
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    marginBottom: 20,
  },
  documentInfoText: {
    fontSize: 14,
    color: "#666",
    marginVertical: 5,
  },
  buttonContainer: {
    width: "100%",
    gap: 10,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    width: "100%",
  },
  openButton: {
    backgroundColor: "#4CAF50",
  },
  closeButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "500",
  },
  fileTypeModalContent: {
    backgroundColor: "white",
    borderRadius: 15,
    padding: 20,
    width: "80%",
    maxWidth: 400,
  },
  fileTypeModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  fileTypeModalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  fileTypeModalSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
  },
  fileTypeOptions: {
    gap: 10,
  },
  fileTypeOption: {
    padding: 15,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    alignItems: "center",
  },
  fileTypeOptionText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  videoThumbnailContainer: {
    position: "relative",
    marginRight: 10,
  },
  playIconContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 4,
  },
  systemMessageContainer: {
    alignItems: "center",
    width: "100%",
    marginVertical: 6,
  },
  systemMessageBubble: {
    backgroundColor: "#f0f2f5",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 18,
    maxWidth: "90%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  systemMessageText: {
    color: "#666",
    fontStyle: "italic",
    fontSize: 15,
    marginLeft: 6,
  },
});

export default GroupChatScreen;
