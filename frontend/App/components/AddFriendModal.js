import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../config/api";

const AddFriendModal = ({ visible, onClose, onSent }) => {
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      const stored = await AsyncStorage.getItem("user");
      console.log("✅ USER IN ASYNC‑STORAGE:", stored);   // kiểm tra
      if (!stored) return;
    
      const parsed   = JSON.parse(stored);
      const userId   = parsed.userId;          // luôn có sau bước 1
      const fallback = parsed.phone;           // dự phòng
      setCurrentUserId(userId || fallback);
    };    

    if (visible) {
      (async () => {
        await fetchUser();
        setResult(null);
        setPhone("");
      })();
    }
  }, [visible]);

  const normalizePhone = (phone) => {
    const formatted = phone.startsWith("0") ? "84" + phone.slice(1) : phone;
    console.log("📞 Số điện thoại đã chuẩn hóa:", formatted);
    return formatted;
  };

  const handleSearch = async () => {
    const formatted = normalizePhone(phone);
    setLoading(true);
    setResult(null);

    if (formatted === currentUserId) {
      Alert.alert("Lỗi", "Không thể tìm chính bạn.");
      setLoading(false);
      return;
    }

    try {
      console.log("🔎 Gọi API tìm kiếm người dùng với:", formatted);
      const res = await api.get(`/users/${formatted}`);
      console.log("📥 Kết quả trả về từ API:", res.data);
      if (res.data) {
        setResult(res.data);
      } else {
        Alert.alert("Không tìm thấy", "Người dùng không tồn tại.");
      }
    } catch (err) {
      console.error("❌ Lỗi tìm kiếm:", err);
      Alert.alert("Lỗi", "Không tìm thấy người dùng.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async () => {
    console.log("👉 Bắt đầu gửi lời mời...");
    console.log("🔑 currentUserId:", currentUserId);
    console.log("📨 result:", result);

    if (!currentUserId || !result?.userId) {
      console.warn("⚠️ Thiếu userId hoặc result không đúng định dạng");
      Alert.alert("Lỗi", "Không đủ thông tin để gửi lời mời.");
      return;
    }

    const payload = {
      from: currentUserId,
      to: result.userId,
    };

    console.log("📤 Payload gửi đi:", payload);

    try {
      const res = await api.post("/friends/request", payload);
      console.log("✅ Gửi lời mời thành công:", res.data);
      Alert.alert("✅ Thành công", "Đã gửi lời mời kết bạn.");
      onSent?.();
      onClose();
    } catch (err) {
      console.error("❌ Lỗi gửi lời mời:", err);
      console.log("📛 Response data:", err?.response?.data);
      console.log("📛 Status:", err?.response?.status);
      Alert.alert("❌ Lỗi", err?.response?.data?.message || "Gửi lời mời thất bại.");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Thêm bạn qua số điện thoại</Text>
          <View style={styles.searchRow}>
            <TextInput
              placeholder="Nhập số điện thoại"
              value={phone}
              onChangeText={setPhone}
              style={styles.input}
              keyboardType="phone-pad"
            />
            <TouchableOpacity onPress={handleSearch} style={styles.searchBtn}>
              <Ionicons name="search" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          {loading && <ActivityIndicator size="small" color="#1877f2" />}

          {result && (
            <View style={styles.result}>
              <Image
                source={{
                  uri: result.avatar || `https://ui-avatars.com/api/?name=${result.name}`,
                }}
                style={styles.avatar}
              />
              <Text style={styles.name}>{result.name}</Text>
              <TouchableOpacity
                onPress={handleSendRequest}
                style={[
                  styles.addBtn,
                  !currentUserId && { backgroundColor: "#ccc" },
                ]}
                disabled={!currentUserId}
              >
                <Text style={styles.addText}>Gửi lời mời</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default AddFriendModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#00000088",
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    width: "90%",
    elevation: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
  },
  searchBtn: {
    backgroundColor: "#1877f2",
    padding: 10,
    borderRadius: 8,
  },
  result: {
    alignItems: "center",
    marginTop: 16,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginBottom: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 8,
  },
  addBtn: {
    backgroundColor: "#1877f2",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  addText: {
    color: "#fff",
    fontWeight: "500",
  },
  closeBtn: {
    position: "absolute",
    top: 8,
    right: 8,
  },
});
