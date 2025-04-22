import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../config/api";
import { useFocusEffect } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';

const FriendRequestsScreen = () => {
  const [tab, setTab] = useState("received");
  const [received, setReceived] = useState([]);
  const [sent, setSent] = useState([]);
  const [userId, setUserId] = useState("");
  const route = useRoute();
  const shouldRefresh = route.params?.refresh;
  
  useEffect(() => {
    const fetchUserId = async () => {
      const stored = await AsyncStorage.getItem("user");
      if (stored) {
        const parsed = JSON.parse(stored);
        setUserId(parsed.userId); // ✅ UUID
      }
    };
    fetchUserId();
  }, []);  

  useFocusEffect(
    useCallback(() => {
      if (userId) {
        console.log("🔁 useFocusEffect đang gọi fetchRequests do userId:", userId);
        fetchRequests();
        
      }
    }, [tab, userId])
  );
  useEffect(() => {
    if (shouldRefresh && userId) {
      console.log("🔄 Đã nhận refresh từ params → fetchRequests()");
      fetchRequests();
      if (route.params?.refresh) {
        route.params.refresh = false; // clear params sau khi dùng
      }
      
    }
  }, [shouldRefresh, userId]);
  

  const fetchRequests = async () => {
    try {
      if (tab === "received") {
        const res = await api.get(`/friends/request/received/${userId}`);
        setReceived(res.data.received || []);
      } else {
        const res = await api.get(`/friends/request/sent/${userId}`);
        setSent(res.data.sent || []);
      }
    } catch (err) {
      console.error("Lỗi fetchRequests:", err);
    }
  };
  

  const handleAccept = async (requestId, fromUserId) => {
    try {
      await api.post("/friends/request/accept", { requestId });
      await api.post("/conversations", { from: userId, to: fromUserId });
      fetchRequests();
    } catch (err) {
      console.error("Lỗi đồng ý:", err);
    }
  };

  const handleReject = async (requestId) => {
    try {
      await api.post("/friends/request/reject", { requestId });
      fetchRequests();
    } catch (err) {
      console.error("Lỗi từ chối:", err);
    }
  };

  const handleCancel = async (requestId) => {
    try {
      await api.post("/friends/request/cancel", { requestId });
      fetchRequests();
    } catch (err) {
      console.error("Lỗi thu hồi:", err);
    }
  };

  const renderItem = ({ item }) => {
    const user = tab === "received" ? item.fromUser : item.toUser;
    return (
      <View style={styles.card}>
        <Image
          source={{ uri: user?.avatar || `https://ui-avatars.com/api/?name=${user?.name}` }}
          style={styles.avatar}
        />
        <View style={styles.info}>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.message}>Muốn kết bạn</Text>
        </View>
        {tab === "received" ? (
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => handleReject(item.requestId)}
              style={[styles.btn, styles.rejectBtn]}
            >
              <Text style={styles.rejectText}>Từ chối</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleAccept(item.requestId, item.from)}
              style={[styles.btn, styles.acceptBtn]}
            >
              <Text style={styles.acceptText}>Đồng ý</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => handleCancel(item.requestId)}
            style={styles.cancelBtn}
          >
            <Text style={styles.cancelText}>Thu hồi</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const data = tab === "received" ? received : sent;

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity onPress={() => setTab("received")} style={[styles.tab, tab === "received" && styles.activeTab]}>
          <Text style={tab === "received" ? styles.activeText : styles.tabText}>Đã nhận ({received.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab("sent")} style={[styles.tab, tab === "sent" && styles.activeTab]}>
          <Text style={tab === "sent" ? styles.activeText : styles.tabText}>Đã gửi ({sent.length})</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.requestId}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />
    </View>
  );
};

export default FriendRequestsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#ddd",
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
  tabText: { color: "#777" },
  activeText: { color: "#1877f2", fontWeight: "bold" },
  list: {
    padding: 10,
  },
  card: {
    flexDirection: "row",
    backgroundColor: "#f9f9f9",
    padding: 10,
    marginBottom: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    marginRight: 12,
  },
  info: { flex: 1 },
  name: { fontWeight: "bold", fontSize: 16 },
  message: { color: "#555" },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  rejectBtn: {
    backgroundColor: "#e0e0e0",
  },
  rejectText: {
    color: "#333",
  },
  acceptBtn: {
    backgroundColor: "#1877f2",
  },
  acceptText: {
    color: "#fff",
  },
  cancelBtn: {
    backgroundColor: "#eee",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  cancelText: {
    color: "#444",
  },
});
