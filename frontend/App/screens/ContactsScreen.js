import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,                 // ✅ thêm Alert
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AddFriendModal from "../components/AddFriendModal";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../config/api";
import { Pressable } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";

export default function ContactsScreen({ navigation }) {
  /* ✅ quickAccess thành state để có setQuickAccess  */
  const [quickAccess, setQuickAccess] = useState([
    { id: 1, icon: "people", title: "Lời mời kết bạn", count: 0, color: "#1877f2" },
    { id: 2, icon: "phone-portrait", title: "Danh bạ máy", subtitle: "Các liên hệ có dùng Zalo", color: "#1877f2" },
    { id: 3, icon: "gift", title: "Sinh nhật", color: "#1877f2" },
  ]);

  const [showModal,   setShowModal]   = useState(false);
  const [contacts,    setContacts]    = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDeleteFriendPress = (friend) => {
    setSelectedFriend(friend);
    setShowDeleteDialog(true);
  };
    
  const handleConfirmDelete = async () => {
    try {
      const user = JSON.parse(await AsyncStorage.getItem("user"));
      await api.post("/friends/delete", {
        userId: user.userId,
        friendId: selectedFriend.userId,
      });
  
      setContacts((prev) =>
        prev.filter((f) => f.userId !== selectedFriend.userId)
      );
  
      Alert.alert("Thành công", `Đã xóa ${selectedFriend.name} khỏi danh sách bạn bè.`);
    } catch (error) {
      console.error("Lỗi khi xóa bạn bè:", error);
      Alert.alert("Lỗi", "Không thể xóa bạn.");
    } finally {
      setShowDeleteDialog(false);
      setSelectedFriend(null);
    }
  };
  
  /* 🔸 đọc userId từ AsyncStorage */
  const getCurrentUserId = async () => {
    const stored = await AsyncStorage.getItem("user");
    if (!stored) return null;
    const { userId, phone } = JSON.parse(stored);
    return userId || phone || null;
  };

  /* ===== Lấy danh sách bạn bè ===== */
  useFocusEffect(
    useCallback(() => {
      const fetchFriends = async () => {
        const uid = await getCurrentUserId();
        if (!uid) return;
        try {
          const res = await api.get(`/friends/${uid}`);
          if (res.data.success) setContacts(res.data.friends);
        } catch (err) {
          console.error("Lỗi lấy danh sách bạn (focus):", err);
        }
      };
  
      fetchFriends();
    }, [])
  );
  
  
  /* ===== Đếm lời mời kết bạn ===== */
  useFocusEffect(
    useCallback(() => {
      const fetchRequestCount = async () => {
        const uid = await getCurrentUserId();
        if (!uid) return;
        try {
          const res = await api.get(`/friends/request/received/${uid}`);
          const newCount = res.data?.received?.length || 0;
          setQuickAccess((prev) =>
            prev.map((item) =>
              item.title === "Lời mời kết bạn"
                ? { ...item, count: newCount }
                : item
            )
          );
        } catch (err) {
          console.error("Lỗi đếm lời mời:", err);
        }
      };
  
      fetchRequestCount();
    }, [])
  );
  useEffect(() => {
    if (showDeleteDialog && selectedFriend) {
      Alert.alert(
        "Xác nhận",
        `Bạn có chắc muốn xóa ${selectedFriend.name} khỏi danh sách bạn bè?`,
        [
          {
            text: "Hủy",
            style: "cancel",
            onPress: () => setShowDeleteDialog(false),
          },
          {
            text: "Xóa",
            style: "destructive",
            onPress: handleConfirmDelete,
          },
        ]
      );
    }
  }, [showDeleteDialog, selectedFriend]);
  
  /* ===== CALLBACK sau khi gửi lời mời từ modal ===== */
  const handleAfterSend = () => {
    if (Platform.OS === "web") {
      window.alert("Đã gửi lời mời kết bạn");
    } else {
      Alert.alert("Thành công", "Đã gửi lời mời kết bạn");
    }
    navigation.navigate("FriendRequests", { refresh: true });

  };

  /* ====== RENDER ====== */
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#fff" />
          <TextInput placeholder="Tìm kiếm" placeholderTextColor="#fff" style={styles.searchInput} />
        </View>
        <TouchableOpacity onPress={() => setShowModal(true)}>
          <Ionicons name="person-add" size={24} color="#fff" />
        </TouchableOpacity>

        {/* Modal thêm bạn */}
        <AddFriendModal
          visible={showModal}
          onClose={() => setShowModal(false)}
          onSent={handleAfterSend}
          
        />
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, styles.activeTab]}>
          <Text style={[styles.tabText, styles.activeTabText]}>Bạn bè</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab}>
          <Text style={styles.tabText}>Nhóm</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab}>
          <Text style={styles.tabText}>OA</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {/* Quick Access */}
        {quickAccess.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.quickAccessItem}
            onPress={() => item.title === "Lời mời kết bạn" && navigation.navigate("FriendRequests")}
          >
            <View style={[styles.quickAccessIcon, { backgroundColor: `${item.color}20` }]}>
              <Ionicons name={item.icon} size={24} color={item.color} />
            </View>
            <View style={styles.quickAccessInfo}>
              <Text style={styles.quickAccessTitle}>
                {item.title}
                {item.count ? <Text style={styles.count}> ({item.count})</Text> : null}
              </Text>
              {item.subtitle && <Text style={styles.quickAccessSubtitle}>{item.subtitle}</Text>}
            </View>
          </TouchableOpacity>
        ))}

        {/* Filters */}
        <View style={styles.filters}>
          <TouchableOpacity style={styles.filterButton}>
            <Text style={styles.filterText}>Tất cả {contacts.length}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterButton, styles.filterButtonOutline]}>
            <Text style={styles.filterTextOutline}>Mới truy cập</Text>
          </TouchableOpacity>
        </View>

        {/* Danh sách bạn */}
        {contacts.map((c, i) => (
  <React.Fragment key={c.userId}>
  {(i === 0 || contacts[i - 1].name[0] !== c.name[0]) && (
    <Text style={styles.section}>{c.name[0]}</Text>
  )}
 <Pressable
  key={c.userId}
  onPress={async () => {
    try {
      const stored = await AsyncStorage.getItem("user");
      const currentUserPhone = JSON.parse(stored)?.phone;

      const res = await api.post("/conversations", {
        from: currentUserPhone,
        to: c.phone,
      });

      const conversationId = res.data?.conversationId;
      if (conversationId) {
        navigation.navigate("ChatDirectly", {
          conversationId,
          friend: c,
          title: c.name,
          otherParticipantPhone: c.phone,
          avatar: c.avatar,
        });
      }
    } catch (err) {
      console.error("❌ Lỗi khi tạo cuộc trò chuyện:", err);
    }
  }}
  onLongPress={() => {
    setSelectedFriend(c);
    setShowDeleteDialog(true);
  }}
>
  <View style={styles.contactItem}>
    <Image source={{ uri: c.avatar }} style={styles.avatar} />
    <View style={styles.contactInfo}>
      <Text style={styles.contactName}>{c.name}</Text>
    </View>
    <TouchableOpacity style={styles.actionButton}>
      <Ionicons name="call-outline" size={24} color="#666" />
    </TouchableOpacity>
    <TouchableOpacity style={styles.actionButton}>
      <Ionicons name="videocam-outline" size={24} color="#666" />
    </TouchableOpacity>
  </View>
</Pressable>

</React.Fragment>
))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    backgroundColor: "#0068FF",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: "#fff",
    fontSize: 16,
  },
  tabContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: "#1877f2",
  },
  tabText: {
    color: "#666",
    fontSize: 16,
  },
  activeTabText: {
    color: "#1877f2",
    fontWeight: "500",
  },
  content: {
    flex: 1,
  },
  quickAccessItem: {
    flexDirection: "row",
    padding: 16,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  quickAccessIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  quickAccessInfo: {
    flex: 1,
  },
  quickAccessTitle: {
    fontSize: 16,
    fontWeight: "500",
  },
  quickAccessSubtitle: {
    color: "#666",
    marginTop: 4,
  },
  count: {
    color: "#666",
  },
  filters: {
    flexDirection: "row",
    padding: 16,
    gap: 8,
  },
  filterButton: {
    backgroundColor: "#f0f2f5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  filterButtonOutline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  filterText: {
    color: "#000",
  },
  filterTextOutline: {
    color: "#666",
  },
  section: {
    backgroundColor: "#f0f2f5",
    padding: 8,
    paddingLeft: 16,
    color: "#666",
  },
  contactItem: {
    flexDirection: "row",
    padding: 12,
    alignItems: "center",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: "500",
  },
  businessTag: {
    backgroundColor: "#e7f3ff",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  businessText: {
    color: "#1877f2",
    fontSize: 12,
  },
  actionButton: {
    padding: 8,
  },
  bottomNav: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    paddingVertical: 8,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  activeNavItem: {
    color: "#1877f2",
  },
  activeNavText: {
    color: "#1877f2",
    fontSize: 12,
    marginTop: 4,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: 20,
    backgroundColor: "#1877f2",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
    paddingHorizontal: 6,
  },
});
