import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Image,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
  Dimensions,
  Linking,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { io } from "socket.io-client";
import {
  getChatHistory,
  sendMessage,
  recallMessage,
  forwardMessage,
  deleteMessage,
} from "../modules/chat/controller";
import { getAccessToken } from "../services/storage";
import * as ImagePicker from "expo-image-picker";
import { Video } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import ForwardMessageModal from "./ForwardMessageModal";
import { getApiUrl, getBaseUrl, api } from "../config/api";
import { Icon } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Hàm tạo conversationId
const createParticipantId = (phone1, phone2) => {
  return [phone1, phone2].sort().join("_");
};

// Hàm trả về icon file phù hợp cho React Native
const getFileIcon = (mimeType, fileName = "", size = 40) => {
  const ext = fileName.split('.').pop().toLowerCase();
  let iconSource = null;

  if (ext === "doc" || ext === "docx") {
    iconSource = require("../assets/icons/word.png");
  } else if (ext === "pdf") {
    iconSource = require("../assets/icons/pdf.png");
  } else if (ext === "xls" || ext === "xlsx") {
    iconSource = require("../assets/icons/excel.png");
  } else if (ext === "ppt" || ext === "pptx") {
    iconSource = require("../assets/icons/ppt.png");
  } else if (ext === "zip" || ext === "rar") {
    iconSource = require("../assets/icons/zip.png");
  }

  return (
    <Image
      source={iconSource}
      style={{ width: size, height: size, resizeMode: "contain" }}
    />
  );
};

const ChatDirectlyScreen = ({ route, navigation }) => {
  const [message, setMessage] = useState("");
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
  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 300,
  };
  const flatListRef = useRef(null);
  const { title, otherParticipantPhone, avatar } = route.params;
  const [currentDate, setCurrentDate] = useState(null);
  const [showLoadMore, setShowLoadMore] = useState(false);
  const [isLoadingPrevious, setIsLoadingPrevious] = useState(false);
  const [loadedDates, setLoadedDates] = useState([]);
  const [isNearTop, setIsNearTop] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [showOptionsModal, setShowOptionsModal] = useState(false);

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

  const formatTime = (timestamp) => {
    try {
      if (!timestamp) return "";
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return "";
      return date.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      console.warn("Time formatting error:", error);
      return "";
    }
  };

  const loadChatHistory = async (loadMore = false) => {
    try {
      if (loadMore && !hasMoreMessages) return;

      setIsLoadingMore(loadMore);
      const options = {
        limit: 50,
      };

      if (loadMore && oldestMessageDate) {
        options.date = oldestMessageDate;
        options.before = true;
      }

      const response = await getChatHistory(otherParticipantPhone, options);

      if (response.status === "success" && response.data.messages) {
        // Convert the date-grouped messages into a flat array
        const messageArray = Object.entries(response.data.messages)
          .flatMap(([date, messages]) => messages)
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        setMessages((prev) => {
          if (loadMore) {
            const combined = [...prev, ...messageArray];
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
        setHasMoreMessages(response.data.pagination.hasMore);
        if (response.data.pagination.oldestTimestamp) {
          setOldestMessageDate(response.data.pagination.oldestTimestamp);
        }

        // Update visible dates
        if (!loadMore) {
          // On initial load, show current date
          const today = formatDate(Date.now());
          setVisibleDates([today]);
        }
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
      Alert.alert("Lỗi", "Đã xảy ra lỗi khi tải lịch sử trò chuyện");
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Update socket initialization
  useEffect(() => {
    const initSocket = async () => {
      try {
        const token = await getAccessToken();
        const newSocket = io(getBaseUrl(), {
          auth: { token },
          transports: ["websocket", "polling"],
          forceNew: true,
          reconnection: true,
          reconnectionAttempts: 5,
        });

        newSocket.on("connect", () => {
          console.log("Connected to socket server");
        });

        newSocket.on("connect_error", (error) => {
          console.error("Socket connection error:", error);
        });

        // Handle new messages from others
        newSocket.on("new-message", (newMsg) => {
          console.log("Received new message:", newMsg);
          if (newMsg.senderPhone === otherParticipantPhone) {
            setMessages((prev) => {
              const newMessages = [...prev];
              const existingIndex = newMessages.findIndex(
                (msg) => msg.messageId === newMsg.messageId
              );
              if (existingIndex === -1) {
                newMessages.push(newMsg);
              }
              return newMessages.sort(
                (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
              );
            });
            scrollToBottom();
          }
        });

        // Handle message recalled
        newSocket.on("message-recalled", (data) => {
          console.log("Message recalled:", data);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.messageId === data.messageId
                ? {
                    ...msg,
                    content: data.content,
                    status: "recalled",
                  }
                : msg
            )
          );
        });

        // Handle message sent confirmation
        newSocket.on("message-sent", (response) => {
          console.log("Message sent response received:", response);
          if (response) {
            setMessages((prev) => {
              console.log("Current messages:", prev);
              console.log("Looking for message with tempId:", response.tempId);

              const updatedMessages = prev.map((msg) => {
                // Check both messageId and tempId for backward compatibility
                if (
                  msg.tempId === response.tempId ||
                  msg.messageId === response.tempId
                ) {
                  console.log("Found message to update:", msg);
                  console.log("Updating with response:", response);

                  return {
                    ...msg,
                    messageId: response.messageId || msg.messageId,
                    status: "sent",
                    isTempId: false,
                    timestamp: response.timestamp || msg.timestamp,
                  };
                }
                return msg;
              });

              console.log("Updated messages:", updatedMessages);
              return updatedMessages;
            });
          }
        });

        // Handle message send error
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

        newSocket.on("typing", ({ senderPhone }) => {
          if (senderPhone === otherParticipantPhone) setIsTyping(true);
        });

        newSocket.on("stop-typing", ({ senderPhone }) => {
          if (senderPhone === otherParticipantPhone) setIsTyping(false);
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
  }, []);

  useEffect(() => {
    navigation.setOptions({
      tabBarVisible: false,
    });
  }, [navigation]);

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

  useEffect(() => {
    if (messages.length > 0) {
      if (initialLoad) {
        const today = formatDate(Date.now());
        console.log("Initial load - Setting visibleDates to:", [today]);
        setVisibleDates([today]);
        setInitialLoad(false);
      }
    }
  }, [messages]);

  const groupMessagesByDate = React.useCallback((messages) => {
    const groups = {};
    messages.forEach((msg) => {
      const date = formatDate(msg.timestamp);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(msg);
    });
    return groups;
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      // Nhóm tin nhắn theo ngày
      const groups = groupMessagesByDate(messages);

      // Chuyển đổi thành mảng và tính toán chiều cao
      const groupArray = Object.entries(groups)
        .map(([date, messages]) => {
          const messageCount = messages.length;
          const headerHeight = 40; // Chiều cao của header ngày
          const messageHeight = 60; // Chiều cao trung bình của mỗi tin nhắn
          const spacing = 10; // Khoảng cách giữa các tin nhắn
          return {
            date,
            messages,
            height: headerHeight + messageCount * (messageHeight + spacing),
          };
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      setMessageGroups(groupArray);
    }
  }, [messages, groupMessagesByDate]);

  const scrollToBottom = () => {
    if (flatListRef.current) {
      setTimeout(
        () => flatListRef.current.scrollToEnd({ animated: true }),
        100
      );
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() && !selectedFiles.length) return;

    try {
      if (message.trim()) {
        const tempId = `temp-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`;
        console.log("Sending message with tempId:", tempId);

        const newMessage = {
          messageId: tempId,
          tempId: tempId,
          senderPhone: "me",
          content: message.trim(),
          type: "text",
          timestamp: Date.now(),
          status: "sending",
          isTempId: true,
        };

        setMessages((prev) => {
          const updatedMessages = [...prev, newMessage].sort(
            (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
          );
          return updatedMessages;
        });

        setMessage("");
        scrollToBottom();

        socket.emit("send-message", {
          tempId,
          receiverPhone: otherParticipantPhone,
          content: message.trim(),
        });
      }

      if (selectedFiles.length > 0) {
        await handleUpload(selectedFiles);
      }
    } catch (error) {
      console.error("Error in handleSendMessage:", error);
      Alert.alert("Lỗi", "Không thể gửi tin nhắn");
    }
  };

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);

      const formData = new FormData();
      files.forEach((file, index) => {
        formData.append("files", {
          uri: file.uri,
          type: file.type,
          name: file.name,
        });
      });

      const token = await getAccessToken();
      const response = await fetch(getApiUrl() + "/chat/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
        body: formData,
      });

      const result = await response.json();
      if (result.status === "error") {
        Alert.alert("Lỗi", result.message || "Không thể upload file");
        return;
      }

      setUploadProgress(100);

      result.data.urls.forEach((url, index) => {
        const file = files[index];
        const tempId = `temp-${Date.now()}-${index}-${Math.random()
          .toString(36)
          .substr(2, 9)}`;
        const newMessage = {
          messageId: tempId,
          tempId: tempId,
          senderPhone: "me",
          content: url,
          type: "file",
          fileType: file.type,
          timestamp: Date.now(),
          status: "sending",
          isTempId: true,
        };

        setMessages((prev) => {
          const updatedMessages = [...prev, newMessage].sort(
            (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
          );
          return updatedMessages;
        });

        socket.emit("send-message", {
          tempId,
          receiverPhone: otherParticipantPhone,
          fileUrl: url,
          fileType: file.type,
        });
      });

      setSelectedFiles([]);
      setShowFilePreview(false);
      scrollToBottom();
    } catch (error) {
      console.error("Upload error details:", error);
      Alert.alert("Lỗi", "Không thể upload file");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleRecallMessage = async (messageId) => {
    try {
      const targetMessage = messages.find((msg) => msg.messageId === messageId);
      if (!targetMessage) {
        Alert.alert("Lỗi", "Tin nhắn không tồn tại");
        return;
      }
      if (targetMessage.isTempId || targetMessage.status === "sending") {
        Alert.alert("Lỗi", "Không thể thu hồi tin nhắn đang gửi");
        return;
      }

      // Kiểm tra thời gian trước khi gửi yêu cầu thu hồi
      const messageAge =
        Date.now() - new Date(targetMessage.timestamp).getTime();
      const twoMinutes = 2 * 60 * 1000;

      if (messageAge > twoMinutes) {
        Alert.alert(
          "Không thể thu hồi",
          "Tin nhắn chỉ có thể được thu hồi trong vòng 2 phút sau khi gửi"
        );
        return;
      }

      const response = await recallMessage(messageId, otherParticipantPhone);
      if (response.status === "success") {
        const recallContent =
          targetMessage.type === "file"
            ? `[File] ${targetMessage.fileType || "file"} đã bị thu hồi`
            : "Tin nhắn đã bị thu hồi";
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageId === messageId
              ? { ...msg, content: recallContent, status: "recalled" }
              : msg
          )
        );
        socket?.emit("message-recalled", {
          messageId,
          receiverPhone: otherParticipantPhone,
          conversationId: createParticipantId(otherParticipantPhone, "me"),
          content: recallContent,
          type: targetMessage.type,
          fileType: targetMessage.fileType,
        });
        Alert.alert("Thành công", "Tin nhắn đã được thu hồi");
      } else {
        Alert.alert("Lỗi", response.message || "Không thể thu hồi tin nhắn");
      }
    } catch (error) {
      console.error("Error recalling message:", error);
      Alert.alert("Lỗi", "Đã xảy ra lỗi khi thu hồi tin nhắn");
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      const targetMessage = messages.find((msg) => msg.messageId === messageId);
      if (!targetMessage) {
        Alert.alert("Lỗi", "Tin nhắn không tồn tại");
        return;
      }
      if (targetMessage.isTempId || targetMessage.status === "sending") {
        Alert.alert("Lỗi", "Không thể xóa tin nhắn đang gửi");
        return;
      }

      const response = await deleteMessage(messageId);
      if (response.status === "success") {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageId === messageId ? { ...msg, status: "deleted" } : msg
          )
        );

        socket?.emit("message-deleted", {
          messageId,
          conversationId: createParticipantId(otherParticipantPhone, "me"),
          type: targetMessage.type,
          fileType: targetMessage.fileType,
        });

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
        forwardMessage(
          selectedMessage.messageId,
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

    // Kiểm tra thời gian của tin nhắn
    const messageAge = Date.now() - new Date(message.timestamp).getTime();
    const twoMinutes = 24 * 60 * 60 * 1000; // 2 phút tính bằng milliseconds

    if (messageAge > twoMinutes) {
      // Nếu tin nhắn quá 2 phút, chỉ hiển thị các tùy chọn khác
      Alert.alert(
        "Thông báo",
        "Tin nhắn chỉ có thể được thu hồi trong vòng 24h sau khi gửi",
        [
          {
            text: "Chuyển tiếp",
            onPress: () => setForwardModalVisible(true),
          },
          {
            text: "Xóa",
            onPress: () => handleDeleteMessage(message.messageId),
            style: "destructive",
          },
          {
            text: "Đóng",
            style: "cancel",
          },
        ]
      );
    } else {
      // Nếu tin nhắn chưa quá 2 phút, hiển thị tất cả tùy chọn
      setShowOptionsModal(true);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 10,
      });

      if (!result.canceled) {
        const files = result.assets.map((asset) => ({
          uri: asset.uri,
          type: "image/jpeg",
          name: `image_${Date.now()}.jpg`,
        }));
        setSelectedFiles(files);
        setShowFilePreview(true);
      }
    } catch (error) {
      Alert.alert("Lỗi", "Không thể chọn ảnh");
    }
  };

  const pickVideo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsMultipleSelection: true,
        selectionLimit: 5,
      });

      if (!result.canceled) {
        const files = result.assets.map((asset) => ({
          uri: asset.uri,
          type: "video/mp4",
          name: `video_${Date.now()}.mp4`,
        }));
        setSelectedFiles(files);
        setShowFilePreview(true);
      }
    } catch (error) {
      Alert.alert("Lỗi", "Không thể chọn video");
    }
  };

  const pickDocument = async () => {
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
          "application/zip",
          "application/rar",
          "application/7z",
          "application/x-7z-compressed",
          "application/x-rar-compressed",
          "application/x-zip-compressed",
          "application/x-7z-compressed",
        ],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        const files = result.assets.map((asset) => ({
          uri: asset.uri,
          type: asset.mimeType,
          name: asset.name,
          size: asset.size,
        }));
        setSelectedFiles(files);
        setShowFilePreview(true);
      }
    } catch (error) {
      console.error("Document picker error:", error);
      Alert.alert("Lỗi", "Không thể chọn file");
    }
  };

  const renderMessage = ({ item }) => {
    const isMyMessage =
      item.senderPhone !== otherParticipantPhone || item.senderPhone === "me";
    if (isMyMessage && item.status === "deleted") return null;

    const handleFilePress = async () => {
      if (item.status === "recalled") return;
      if (item.fileType?.startsWith("image/")) {
        setPreviewImage(item.content);
        setShowImagePreview(true);
      } else if (item.fileType?.startsWith("video/")) {
        setPreviewVideo(item.content);
        setShowVideoPreview(true);
      } else {
        try {
          const supported = await Linking.canOpenURL(item.content);
          if (supported) await Linking.openURL(item.content);
          else Alert.alert("Không thể mở file", "URL: " + item.content);
        } catch (error) {
          Alert.alert("Lỗi", "Không thể mở file");
        }
      }
    };

    return (
      <TouchableOpacity
        onLongPress={() =>
          isMyMessage && item.status !== "recalled" && showMessageOptions(item)
        }
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessage : styles.otherMessage,
        ]}
        disabled={item.status === "recalled"}
      >
        {item.status === "recalled" ? (
          <Text
            style={[
              styles.messageText,
              isMyMessage ? styles.myMessageText : styles.otherMessageText,
              styles.recalledMessage,
            ]}
          >
            {item.content}
          </Text>
        ) : item.type === "text" ? (
          <Text
            style={[
              styles.messageText,
              isMyMessage ? styles.myMessageText : styles.otherMessageText,
            ]}
          >
            {item.content}
          </Text>
        ) : item.type === "file" ? (
          item.fileType?.startsWith("image/") ? (
            <TouchableOpacity onPress={handleFilePress}>
              <Image
                source={{ uri: item.content }}
                style={styles.imgPreview}
                resizeMode="contain"
              />
              <TouchableOpacity
                style={styles.downloadButtonFile}
                onPress={() => downloadFile(item.content)}
              >
                <Ionicons name="download" size={24} color="#1877f2" />
              </TouchableOpacity>
            </TouchableOpacity>
          ) : item.fileType?.startsWith("video/") ? (
            <TouchableOpacity onPress={handleFilePress}>
              <Video
                source={{ uri: item.content }}
                style={styles.videoPreview}
                resizeMode="contain"
                useNativeControls
              />
              <TouchableOpacity
                style={styles.downloadButtonFile}
                onPress={() => downloadFile(item.content)}
              >
                <Ionicons name="download" size={24} color="#1877f2" />
              </TouchableOpacity>
            </TouchableOpacity>
          ) : (
            <View style={styles.fileContainer}>
              {getFileIcon(item.fileType, item.content.split('/').pop(), 40)}
              <Text
                style={styles.fileName}
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {(() => {
                  try {
                    const url = new URL(item.content);
                    const pathname = url.pathname;
                    return pathname.split('/').pop();
                  } catch (e) {
                    return item.content.split("/").pop();
                  }
                })()}
              </Text>
            </View>
          )
        ) : null}
        <View style={styles.messageFooter}>
          <Text
            style={[styles.messageTime, isMyMessage && styles.myMessageTime]}
          >
            {formatTime(item.timestamp)}
          </Text>
          {isMyMessage && (
            <Text
              style={[
                styles.messageStatus,
                isMyMessage && styles.myMessageStatus,
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
      </TouchableOpacity>
    );
  };

  const handleTyping = () => {
    socket?.emit("typing", { receiverPhone: otherParticipantPhone });
  };

  const handleStopTyping = () => {
    socket?.emit("stop-typing", { receiverPhone: otherParticipantPhone });
  };

  const handleEmojiPress = () => {
    Alert.alert("Thông báo", "Chức năng emoji sẽ được thêm sau");
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

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getItemLayout = (data, index) => {
    const group = data[index];
    return {
      length: group.height,
      offset: data.slice(0, index).reduce((sum, item) => sum + item.height, 0),
      index,
    };
  };

  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    setViewableItems(viewableItems.map((item) => item.index));
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      const dates = Object.keys(groupMessagesByDate(messages)).sort(
        (a, b) => new Date(a) - new Date(b)
      );

      if (dates.length > 0) {
        const latestDate = dates[dates.length - 1];
        setCurrentDate(latestDate);
        setLoadedDates([latestDate]);
        setShowLoadMore(dates.length > 1);
      }
    }
  }, [messages]);

  const loadPreviousDay = () => {
    if (isLoadingPrevious) return;

    const dates = Object.keys(groupMessagesByDate(messages)).sort(
      (a, b) => new Date(a) - new Date(b)
    );

    const currentIndex = dates.indexOf(currentDate);
    if (currentIndex > 0) {
      setIsLoadingPrevious(true);
      const previousDate = dates[currentIndex - 1];
      setCurrentDate(previousDate);
      setLoadedDates((prev) => [previousDate, ...prev]); // Thêm ngày mới vào đầu mảng
      setShowLoadMore(currentIndex > 1);
      setTimeout(() => {
        setIsLoadingPrevious(false);
      }, 500);
    }
  };

  const renderDateGroup = () => {
    if (!loadedDates.length) return null;

    return loadedDates.map((date) => {
      const messagesForDate = groupMessagesByDate(messages)[date] || [];
      console.log(`Rendering messages for date: ${date}`);

      return (
        <View key={date} style={styles.dateGroup}>
          <View style={styles.dateHeaderContainer}>
            <View style={styles.dateHeaderLine} />
            <Text style={styles.dateHeader}>{date}</Text>
            <View style={styles.dateHeaderLine} />
          </View>
          {messagesForDate
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
            .map((msg) => (
              <View key={`${msg.messageId}-${msg.timestamp}`}>
                {renderMessage({ item: msg })}
              </View>
            ))}
        </View>
      );
    });
  };

  const handleScroll = (event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const currentPosition = contentOffset.y;
    setScrollPosition(currentPosition);

    // Kiểm tra nếu scroll gần đến nút load more (cách 100px)
    if (currentPosition > 100 && !isLoadingPrevious) {
      setIsNearTop(true);
    } else {
      setIsNearTop(false);
    }
  };

  useEffect(() => {
    if (isNearTop && !isLoadingPrevious) {
      loadPreviousDay();
    }
  }, [isNearTop]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1877f2" />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('VideoCall', {
              receiverPhone: otherParticipantPhone,
              receiverName: title
            })}
          >
            <Ionicons name="videocam" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="search" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="menu" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View style={styles.chatContainer}>
          <ScrollView
            ref={flatListRef}
            contentContainerStyle={styles.scrollContent}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {showLoadMore && (
              <TouchableOpacity
                style={styles.loadMoreButton}
                onPress={loadPreviousDay}
                disabled={isLoadingPrevious}
              >
                {isLoadingPrevious ? (
                  <ActivityIndicator size="small" color="#1877f2" />
                ) : (
                  <Text style={styles.loadMoreText}>Xem tin nhắn cũ hơn</Text>
                )}
              </TouchableOpacity>
            )}
            {renderDateGroup()}
          </ScrollView>
          {isTyping && (
            <Text style={styles.typingText}>Đang soạn tin nhắn...</Text>
          )}
        </View>
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={handleEmojiPress}
          >
            <Ionicons name="happy-outline" size={24} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={() => {
              Alert.alert("Chọn loại file", "Bạn muốn gửi loại file nào?", [
                { text: "Ảnh", onPress: pickImage },
                { text: "Video", onPress: pickVideo },
                { text: "Tài liệu", onPress: pickDocument },
                { text: "Hủy", style: "cancel" },
              ]);
            }}
          >
            <Ionicons name="image" size={24} color="#666" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={message}
            onChangeText={setMessage}
            placeholder="Nhập tin nhắn..."
            multiline
            onFocus={() => setIsTyping(true)}
            onBlur={() => setIsTyping(false)}
          />
          <TouchableOpacity
            style={styles.sendIconButton}
            onPress={handleSendMessage}
            disabled={!message.trim() && selectedFiles.length === 0}
          >
            <Ionicons
              name="send"
              size={24}
              color={
                message.trim() || selectedFiles.length > 0 ? "#1877f2" : "#666"
              }
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      <Modal visible={showFilePreview} transparent={true} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Đã chọn {selectedFiles.length} file
            </Text>
            <ScrollView style={styles.fileList}>
              {selectedFiles.map((file, index) => (
                <View key={index} style={styles.fileItem}>
                  <Ionicons
                    name={getFileIcon(file.type, file.name, 24)}
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
      <ForwardMessageModal
        visible={forwardModalVisible}
        onClose={() => {
          setForwardModalVisible(false);
          setSelectedMessage(null);
        }}
        onForward={handleForwardMessage}
      />
      {/* Options Modal */}
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
            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => {
                handleRecallMessage(selectedMessage.messageId);
                setShowOptionsModal(false);
              }}
            >
              <Ionicons name="arrow-undo" size={24} color="#1877f2" />
              <Text style={styles.optionText}>Thu hồi</Text>
            </TouchableOpacity>

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
                handleDeleteMessage(selectedMessage.messageId);
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F2F5",
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    backgroundColor: "#1877f2",
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 10,
  },
  headerButton: {
    padding: 8,
    marginLeft: 4,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  flatListContent: {
    padding: 10,
    flexGrow: 1,
  },
  messageContainer: {
    maxWidth: "80%",
    padding: 10,
    borderRadius: 20,
    marginVertical: 5,
  },
  myMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#1877f2",
  },
  otherMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#E4E6EB",
  },
  messageText: {
    fontSize: 16,
  },
  myMessageText: {
    color: "white",
  },
  otherMessageText: {
    color: "black",
  },
  recalledMessage: {
    fontStyle: "italic",
    color: "#999",
  },
  messageTime: {
    fontSize: 12,
    color: "#666",
    marginTop: 5,
  },
  myMessageTime: {
    color: "white",
  },
  messageStatus: {
    fontSize: 12,
    marginLeft: 5,
    color: "#666",
  },
  myMessageStatus: {
    color: "#fff",
  },
  typingText: {
    color: "#65676B",
    fontSize: 12,
    padding: 5,
    textAlign: "center",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E4E6EB",
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: "#F0F2F5",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginHorizontal: 10,
    fontSize: 16,
  },
  imgPreview: {
    width: SCREEN_WIDTH * 0.6,
    height: SCREEN_WIDTH * 0.4,
    borderRadius: 10,
  },
  videoPreview: {
    width: SCREEN_WIDTH * 0.6,
    height: SCREEN_WIDTH * 0.4,
    borderRadius: 10,
  },
  fileContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    marginBottom: 8,
    minWidth: 180,
    maxWidth: SCREEN_WIDTH * 0.7,
  },
  fileName: {
    marginLeft: 10,
    fontSize: 15,
    color: "#222",
    fontWeight: "bold",
    flex: 1,
    maxWidth: SCREEN_WIDTH * 0.35,
  },
  downloadButtonFile: {
    marginLeft: 10,
    padding: 4,
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
  attachButton: {
    padding: 8,
  },
  sendIconButton: {
    padding: 8,
  },
  messageFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateGroup: {
    marginVertical: 15,
  },
  dateHeaderContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
    paddingHorizontal: 15,
  },
  dateHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E4E6EB",
  },
  dateHeader: {
    backgroundColor: "#fff",
    color: "#65676B",
    fontSize: 12,
    fontWeight: "500",
    paddingHorizontal: 10,
    marginHorizontal: 5,
  },
  loadingMore: {
    padding: 10,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  loadingText: {
    marginLeft: 10,
    color: "#65676B",
    fontSize: 12,
  },
  loadMoreButton: {
    padding: 10,
    alignItems: "center",
    backgroundColor: "#f0f2f5",
    borderBottomWidth: 1,
    borderBottomColor: "#e4e6eb",
  },
  loadMoreText: {
    color: "#1877f2",
    fontSize: 14,
  },
  scrollContent: {
    padding: 10,
    flexGrow: 1,
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
});

export default ChatDirectlyScreen;
