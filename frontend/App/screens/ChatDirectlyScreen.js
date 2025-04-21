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
import { getApiUrl, getBaseUrl,api } from "../config/api";
import {
  getFriendsList,
  sendFriendRequest,
  getSentFriendRequests,
  getReceivedFriendRequests,
  getUserInfoByPhone,
  acceptFriendRequest,
  rejectFriendRequest,
} from "../modules/friend/controller";
import { useFocusEffect } from '@react-navigation/native';

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Hàm tạo conversationId
const createParticipantId = (phone1, phone2) => {
  return [phone1, phone2].sort().join("_");
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
  const flatListRef = useRef(null);
  const { title: initialTitle = 'Chat', otherParticipantPhone, avatar: initialAvatar } = route.params || {};

  // State mới cho chức năng bạn bè
  const [otherParticipantInfo, setOtherParticipantInfo] = useState(null);
  const [friendshipStatus, setFriendshipStatus] = useState('loading'); // 'loading', 'not_friend', 'request_sent', 'request_received', 'friend'
  const [headerTitle, setHeaderTitle] = useState(initialTitle);
  const [headerAvatar, setHeaderAvatar] = useState(initialAvatar);
  const [receivedRequestId, setReceivedRequestId] = useState(null);
  const [isProcessingRequest, setIsProcessingRequest] = useState(false);

  // Hàm kiểm tra trạng thái bạn bè
  const checkFriendship = useCallback(async () => {
    if (!otherParticipantPhone) return;
    setFriendshipStatus('loading');
    setReceivedRequestId(null);
    try {
      const userInfo = await getUserInfoByPhone(otherParticipantPhone);
      if (!userInfo) {
        console.warn('Could not get other participant info by phone');
        setFriendshipStatus('not_friend');
        setHeaderTitle(initialTitle);
        setHeaderAvatar(initialAvatar);
        setOtherParticipantInfo(null);
        return;
      }
      setOtherParticipantInfo(userInfo);
      setHeaderTitle(userInfo.name || initialTitle);
      setHeaderAvatar(userInfo.avatar || initialAvatar);

      const friends = await getFriendsList();
      const isFriend = friends.some(friend => friend.userId === userInfo.userId);

      if (isFriend) {
        setFriendshipStatus('friend');
        return;
      }

      const [sentRequests, receivedRequests] = await Promise.all([
        getSentFriendRequests(),
        getReceivedFriendRequests(),
      ]);

      const receivedRequestFromThisUser = receivedRequests.find(req => req.from === userInfo.userId);
      const hasSentRequest = sentRequests.some(req => req.to === userInfo.userId);

      if (receivedRequestFromThisUser) {
        setFriendshipStatus('request_received');
        setReceivedRequestId(receivedRequestFromThisUser.requestId);
      } else if (hasSentRequest) {
        setFriendshipStatus('request_sent');
      } else {
        setFriendshipStatus('not_friend');
      }

    } catch (error) {
      console.error("Error checking friendship status:", error);
      setFriendshipStatus('not_friend');
    }
  }, [otherParticipantPhone, initialTitle, initialAvatar]);

  // Sử dụng useFocusEffect để load lại khi màn hình được focus
  useFocusEffect(
    useCallback(() => {
      checkFriendship();
      initializeSocket();
      loadChatHistory();
      return () => {
        if (socket) socket.disconnect();
      };
    }, [checkFriendship])
  );

  useEffect(() => {
    navigation.setOptions({
      tabBarVisible: false,
    });
  }, [navigation]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      navigation.getParent()?.setOptions({
        tabBarStyle: { display: 'none' },
        tabBarVisible: false
      });
    });

    const unsubscribeBlur = navigation.addListener('blur', () => {
      navigation.getParent()?.setOptions({
        tabBarStyle: undefined,
        tabBarVisible: true
      });
    });

    return () => {
      unsubscribe();
      unsubscribeBlur();
      navigation.getParent()?.setOptions({
        tabBarStyle: undefined,
        tabBarVisible: true
      });
    };
  }, [navigation]);

  const initializeSocket = async () => {
    try {
      const token = await getAccessToken();

      const newSocket = io(getBaseUrl(), {

        auth: { token },
        transports: ["websocket", "polling"],
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 5,
      });

      newSocket.on("connect", () => console.log("Connected to socket server"));
      newSocket.on("connect_error", (error) => console.error("Socket connection error:", error));
      newSocket.on("new-message", (message) => {
        setMessages((prev) => [...prev, message]);
        scrollToBottom();
      });
      newSocket.on("typing", ({ senderPhone }) => {
        if (senderPhone === otherParticipantPhone) setIsTyping(true);
      });
      newSocket.on("stop-typing", ({ senderPhone }) => {
        if (senderPhone === otherParticipantPhone) setIsTyping(false);
      });
      newSocket.on("message-recalled", ({ messageId, conversationId, content, type, fileType }) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageId === messageId
              ? { ...msg, content, status: "recalled", type, fileType }
              : msg
          )
        );
      });
      newSocket.on("message-deleted", ({ messageId, conversationId, type, fileType }) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageId === messageId
              ? { ...msg, status: "deleted", type, fileType }
              : msg
          )
        );
      });
      setSocket(newSocket);
    } catch (error) {
      console.error("Socket initialization error:", error);
      Alert.alert("Lỗi", "Không thể kết nối tới server");
    }
  };

  const loadChatHistory = async () => {
    try {
      const response = await getChatHistory(otherParticipantPhone);
      if (response.status === "success" && response.data.messages) {
        setMessages(response.data.messages);
        scrollToBottom();
      } else {
        Alert.alert("Lỗi", "Không thể tải lịch sử trò chuyện");
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
      Alert.alert("Lỗi", "Đã xảy ra lỗi khi tải lịch sử trò chuyện");
    }
  };

  const scrollToBottom = () => {
    if (flatListRef.current) {
      setTimeout(() => flatListRef.current.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() && !selectedFiles.length) return;

    try {
      if (message.trim()) {
        const tempId = `temp-${Date.now()}`;
        const newMessage = {
          messageId: tempId,
          senderPhone: "me",
          content: message.trim(),
          type: "text",
          timestamp: Date.now(),
          status: "sending",
          isTempId: true,
        };

        setMessages((prev) => [...prev, newMessage]);
        setMessage("");
        scrollToBottom();

        socket.emit("send-message", {
          tempId,
          receiverPhone: otherParticipantPhone,
          content: message.trim(),
        });

        socket.once("message-sent", (response) => {
          if (response && response.messageId) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.messageId === tempId
                  ? { ...msg, messageId: response.messageId, status: "sent", isTempId: false }
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
          Alert.alert("Lỗi", "Không thể gửi tin nhắn");
        });
      }

      if (selectedFiles.length > 0) {
        await handleUpload(selectedFiles);
      }
    } catch (error) {
      console.error("Error sending message:", error);
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
        const tempId = `temp-${Date.now()}-${index}`;
        const newMessage = {
          messageId: tempId,
          senderPhone: "me",
          content: url,
          type: "file",
          fileType: file.type,
          timestamp: Date.now(),
          status: "sending",
          isTempId: true,
        };

        setMessages((prev) => [...prev, newMessage]);

        socket.emit("send-message", {
          tempId,
          receiverPhone: otherParticipantPhone,
          fileUrl: url,
          fileType: file.type,
        });

        socket.once("message-sent", (response) => {
          if (response && response.messageId) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.messageId === tempId
                  ? { ...msg, messageId: response.messageId, status: "sent", isTempId: false }
                  : msg
              )
            );
          }
        });

        socket.once("error", (error) => {
          console.error("Error sending file message:", error);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.messageId === tempId ? { ...msg, status: "error" } : msg
            )
          );
          Alert.alert("Lỗi", "Không thể gửi file");
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

      const response = await recallMessage(messageId, otherParticipantPhone);
      if (response.status === "success") {
        const recallContent = targetMessage.type === "file"
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
          prev.filter((msg) => msg.messageId !== messageId)
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
          selectedMessage.type === "file" ? selectedMessage.content : selectedMessage.content
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
    const options = [
      {
        text: "Thu hồi",
        onPress: () => handleRecallMessage(message.messageId),
      },
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
        text: "Thoát",
        style: "cancel",
      },
    ];
    Alert.alert("Tùy chọn", "", options);
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
    const isMyMessage = item.senderPhone !== otherParticipantPhone || item.senderPhone === "me";
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
        onLongPress={() => isMyMessage && item.status !== "recalled" && showMessageOptions(item)}
        style={[styles.messageContainer, isMyMessage ? styles.myMessage : styles.otherMessage]}
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
          <TouchableOpacity onPress={handleFilePress}>
            {item.fileType?.startsWith("image/") ? (
              <Image source={{ uri: item.content }} style={styles.imgPreview} resizeMode="contain" />
            ) : item.fileType?.startsWith("video/") ? (
              <Video
                source={{ uri: item.content }}
                style={styles.videoPreview}
                resizeMode="contain"
                useNativeControls
              />
            ) : (
              <View style={styles.fileContainer}>
                <Ionicons name="document" size={24} color={isMyMessage ? "white" : "black"} />
                <Text style={[styles.fileName, isMyMessage && styles.myMessageText]}>
                  {item.content.split("/").pop()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ) : null}
        <View style={styles.messageFooter}>
          <Text style={[styles.messageTime, isMyMessage && styles.myMessageTime]}>
            {new Date(item.timestamp).toLocaleTimeString()}
          </Text>
          {isMyMessage && (
            <Text style={styles.messageStatus}>
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

  const getFileIcon = (mimeType) => {
    if (mimeType?.includes("pdf")) return "document-text";
    if (mimeType?.includes("word")) return "document-text";
    if (mimeType?.includes("powerpoint")) return "document-text";
    return "document";
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Hàm xử lý gửi lời mời kết bạn
  const handleAddFriend = async () => {
    if (!otherParticipantInfo || !otherParticipantInfo.userId) {
      Alert.alert("Lỗi", "Không thể lấy thông tin người dùng này.");
      return;
    }
    try {
      setFriendshipStatus('loading');
      await sendFriendRequest(otherParticipantInfo.userId);
      setFriendshipStatus('request_sent');
      Alert.alert("Thành công", "Đã gửi lời mời kết bạn.");
    } catch (error) {
      console.error("Error sending friend request:", error);
      Alert.alert("Lỗi", error.message || "Không thể gửi lời mời kết bạn.");
      setFriendshipStatus('not_friend');
    }
  };

  // Hàm xử lý chấp nhận lời mời
  const handleAcceptRequest = async () => {
    if (!receivedRequestId) return;
    setIsProcessingRequest(true);
    try {
      await acceptFriendRequest(receivedRequestId);
      setFriendshipStatus('friend');
      setReceivedRequestId(null);
      Alert.alert("Thành công", "Đã đồng ý kết bạn.");
    } catch (error) {
      console.error("Error accepting friend request:", error);
      Alert.alert("Lỗi", error.message || "Không thể đồng ý kết bạn.");
    } finally {
      setIsProcessingRequest(false);
    }
  };

  // Hàm xử lý từ chối lời mời
  const handleRejectRequest = async () => {
    if (!receivedRequestId) return;
    setIsProcessingRequest(true);
    try {
      await rejectFriendRequest(receivedRequestId);
      setFriendshipStatus('not_friend');
      setReceivedRequestId(null);
      Alert.alert("Thông báo", "Đã từ chối lời mời kết bạn.");
    } catch (error) {
      console.error("Error rejecting friend request:", error);
      Alert.alert("Lỗi", error.message || "Không thể từ chối lời mời kết bạn.");
    } finally {
      setIsProcessingRequest(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1877f2" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Image source={{ uri: headerAvatar || 'https://via.placeholder.com/40' }} style={styles.headerAvatar} />
        <View style={styles.headerUserInfo}>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          {friendshipStatus === 'not_friend' && (
            <Text style={styles.strangerLabel}>Người lạ</Text>
          )}
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerActionButton}>
            <Ionicons name="call-outline" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerActionButton}>
            <Ionicons name="videocam-outline" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerActionButton}>
            <Ionicons name="ellipsis-vertical" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {friendshipStatus === 'not_friend' && (
        <View style={styles.friendRequestBanner}>
          <Text style={styles.friendRequestText}>Bạn và người này chưa phải là bạn bè.</Text>
          <TouchableOpacity style={styles.addFriendButton} onPress={handleAddFriend}>
            <Ionicons name="person-add-outline" size={18} color="#fff" />
            <Text style={styles.addFriendButtonText}>Kết bạn</Text>
          </TouchableOpacity>
        </View>
      )}
      {friendshipStatus === 'request_sent' && (
        <View style={[styles.friendRequestBanner, styles.requestSentBanner]}>
          <Ionicons name="checkmark-circle-outline" size={20} color="#666" style={{ marginRight: 5 }}/>
          <Text style={styles.requestSentText}>Đã gửi lời mời kết bạn</Text>
        </View>
      )}
      {friendshipStatus === 'request_received' && receivedRequestId && (
        <View style={styles.friendRequestBanner}> 
          <Text style={styles.friendRequestText}>
            {otherParticipantInfo?.name || 'Người này'} muốn kết bạn.
          </Text>
          <View style={styles.requestReceivedActions}>
            <TouchableOpacity 
              style={[styles.requestActionButton, styles.rejectButton]}
              onPress={handleRejectRequest}
              disabled={isProcessingRequest}
            >
              <Text style={styles.requestActionButtonText}>Từ chối</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.requestActionButton, styles.acceptButton]}
              onPress={handleAcceptRequest}
              disabled={isProcessingRequest}
            >
              {isProcessingRequest 
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={[styles.requestActionButtonText, styles.acceptButtonText]}>Đồng ý</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View style={styles.chatContainer}>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.messageId}
            onContentSizeChange={scrollToBottom}
            contentContainerStyle={{ flexGrow: 1 }}
          />
          {isTyping && <Text style={styles.typingText}>Đang soạn tin nhắn...</Text>}
        </View>
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachButton} onPress={handleEmojiPress}>
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
            placeholder="Tin nhắn"
            value={message}
            onChangeText={setMessage}
            onFocus={handleTyping}
            onBlur={handleStopTyping}
            multiline
          />
          <TouchableOpacity
            style={styles.sendIconButton}
            onPress={handleSendMessage}
            disabled={!message.trim() && selectedFiles.length === 0}
          >
            <Ionicons
              name="send"
              size={24}
              color={message.trim() || selectedFiles.length > 0 ? "#1877f2" : "#666"}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      <Modal visible={showFilePreview} transparent={true} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Đã chọn {selectedFiles.length} file</Text>
            <ScrollView style={styles.fileList}>
              {selectedFiles.map((file, index) => (
                <View key={index} style={styles.fileItem}>
                  <Ionicons name={getFileIcon(file.type)} size={24} color="#1877f2" />
                  <View style={styles.fileInfo}>
                    <Text style={styles.fileName} numberOfLines={1}>
                      {file.name}
                    </Text>
                    <Text style={styles.fileSize}>{formatFileSize(file.size)}</Text>
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
          <Image source={{ uri: previewImage }} style={styles.fullscreenImage} resizeMode="contain" />
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F2F5",
  },
  header: {
    backgroundColor: "#1877f2",
    paddingVertical: 10,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginHorizontal: 10,
  },
  headerUserInfo: {
    flex: 1,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "bold",
  },
  strangerLabel: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 2,
    overflow: 'hidden',
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerActionButton: {
    marginLeft: 15,
  },
  friendRequestBanner: {
    backgroundColor: '#fff',
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  friendRequestText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  addFriendButton: {
    backgroundColor: '#1877f2',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  addFriendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 5,
  },
  requestSentBanner: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
  },
  requestSentText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  chatContainer: {
    flex: 1,
    paddingHorizontal: 10,
  },
  messageContainer: {
    maxWidth: "80%",
    padding: 10,
    borderRadius: 10,
    marginVertical: 5,
  },
  myMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#1877f2",
  },
  otherMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
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
    color: "#666",
    fontSize: 12,
  },
  typingText: {
    color: "#666",
    fontStyle: "italic",
    marginLeft: 10,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
  },
  input: {
    flex: 1,
    minHeight: 40,
    backgroundColor: "#F0F2F5",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
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
    padding: 5,
  },
  fileName: {
    marginLeft: 5,
    fontSize: 14,
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
    padding: 10,
    marginRight: 5,
  },
  sendIconButton: {
    padding: 10,
  },
  messageFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  requestReceivedActions: {
    flexDirection: 'row',
  },
  requestActionButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  rejectButton: {
    backgroundColor: '#e0e0e0',
  },
  acceptButton: {
    backgroundColor: '#1877f2',
  },
  requestActionButtonText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  acceptButtonText: {
    color: '#fff',
  },
});

export default ChatDirectlyScreen;