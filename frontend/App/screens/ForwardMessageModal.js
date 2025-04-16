import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  TextInput,
  FlatList,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api from "../config/api";

const ForwardMessageModal = ({
  visible,
  onClose,
  onForward,
  messageContent,
}) => {
  const [conversations, setConversations] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userCache, setUserCache] = useState({});

  useEffect(() => {
    if (visible) {
      loadConversations();
    }
  }, [visible]);

  const fetchUserInfo = async (phone) => {
    try {
      if (userCache[phone]) {
        return userCache[phone];
      }

      const response = await api.get(`/users/${phone}`);
      if (response.data) {
        setUserCache((prev) => ({
          ...prev,
          [phone]: response.data,
        }));
        return response.data;
      }
    } catch (error) {
      console.error("Get user info error:", error);
      return null;
    }
  };

  const loadConversations = async () => {
    try {
      const response = await api.get("/chat/conversations");

      if (
        response.data.status === "success" &&
        response.data.data?.conversations
      ) {
        const newConversations = await Promise.all(
          response.data.data.conversations.map(async (conv) => {
            const otherParticipant = conv.participant.isCurrentUser
              ? conv.otherParticipant
              : conv.participant;

            const userInfo = await fetchUserInfo(otherParticipant.phone);

            return {
              id: conv.conversationId,
              title: userInfo?.name || otherParticipant.phone,
              avatar: userInfo?.avatar,
              phone: otherParticipant.phone,
              displayName: userInfo?.name || otherParticipant.phone,
            };
          })
        );

        setConversations(newConversations);
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
    }
  };

  const handleUserSelect = (phone) => {
    if (selectedUsers.includes(phone)) {
      setSelectedUsers((prev) => prev.filter((p) => p !== phone));
    } else {
      setSelectedUsers((prev) => [...prev, phone]);
    }
  };

  const handleForward = () => {
    onForward(selectedUsers);
    setSelectedUsers([]);
    onClose();
  };

  const filteredConversations = conversations.filter(
    (conv) =>
      conv.phone.includes(searchTerm) ||
      (conv.title &&
        conv.title.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Chuyển tiếp tin nhắn</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.messagePreview}>
            <Text style={styles.previewLabel}>Nội dung tin nhắn:</Text>
            <Text style={styles.previewContent}>{messageContent}</Text>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons
              name="search"
              size={20}
              color="#666"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm người nhận..."
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
          </View>

          <FlatList
            data={filteredConversations}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.userItem,
                  selectedUsers.includes(item.phone) && styles.selectedUserItem,
                ]}
                onPress={() => handleUserSelect(item.phone)}
              >
                <View style={styles.userAvatarContainer}>
                  {item.avatar ? (
                    <Image
                      source={{ uri: item.avatar }}
                      style={styles.userAvatar}
                    />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarText}>
                        {item.displayName?.slice(0, 2).toUpperCase() || "??"}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.title}</Text>
                  <Text style={styles.userPhone}>{item.phone}</Text>
                </View>
                {selectedUsers.includes(item.phone) && (
                  <Ionicons name="checkmark-circle" size={24} color="#0084ff" />
                )}
              </TouchableOpacity>
            )}
          />

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.forwardButton,
                selectedUsers.length === 0 && styles.forwardButtonDisabled,
              ]}
              onPress={handleForward}
              disabled={selectedUsers.length === 0}
            >
              <Text style={styles.forwardButtonText}>
                Chuyển tiếp ({selectedUsers.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E6E8EB",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#081C36",
  },
  closeButton: {
    padding: 8,
  },
  messagePreview: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E6E8EB",
  },
  previewLabel: {
    fontSize: 14,
    color: "#7589A3",
    marginBottom: 8,
  },
  previewContent: {
    fontSize: 16,
    color: "#081C36",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E6E8EB",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#081C36",
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E6E8EB",
  },
  selectedUserItem: {
    backgroundColor: "#E7F3FF",
  },
  userAvatarContainer: {
    marginRight: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E4E6EB",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#65676B",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#081C36",
    marginBottom: 4,
  },
  userPhone: {
    fontSize: 14,
    color: "#7589A3",
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#E6E8EB",
  },
  cancelButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#F0F2F5",
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#081C36",
  },
  forwardButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#0084FF",
  },
  forwardButtonDisabled: {
    backgroundColor: "#E4E6EB",
  },
  forwardButtonText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "600",
  },
});

export default ForwardMessageModal;
