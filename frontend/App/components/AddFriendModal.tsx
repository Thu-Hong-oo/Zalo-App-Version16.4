import React, { useEffect, useState } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  Image, StyleSheet, ActivityIndicator, Alert
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../config/api";

export default function AddFriendModal({ visible, onClose, onSent }) {
  const [phone,  setPhone]   = useState("");
  const [result, setResult]  = useState(null);
  const [busy,   setBusy]    = useState(false);
  const [myId,   setMyId]    = useState("");
  const [status, setStatus]  = useState("none"); // none | pending | accepted

  /* ───── lấy current userId ───── */
  useEffect(() => {
    if (!visible) return;
    (async () => {
      const raw = await AsyncStorage.getItem("user");
      setMyId(raw ? JSON.parse(raw).userId : "");
      setPhone("");
      setResult(null);
      setStatus("none");
    })();
  }, [visible]);

  const normalize = (p) => p.startsWith("0") ? "84" + p.slice(1) : p;

  const checkStatus = async (targetId) => {
    try {
      const { data } = await api.get("/friends/request/status", {
        params: { from: myId, to: targetId }
      });
      setStatus(data.status); // none | pending | accepted
    } catch {
      setStatus("none");
    }
  };

  const search = async () => {
    const target = normalize(phone.trim());
    if (!target) return;

    if (target === myId) {
      Alert.alert("Lỗi", "Không thể tìm chính bạn");
      return;
    }

    setBusy(true);
    try {
      const { data } = await api.get(`/users/${target}`);
      setResult(data);
      await checkStatus(data.userId);
    } catch {
      Alert.alert("Không tìm thấy", "Số ĐT chưa đăng ký");
      setResult(null);
      setStatus("none");
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    try {
      await api.post("/friends/request", { from: myId, to: result.userId });
      Alert.alert("Thành công", "Đã gửi lời mời kết bạn");
      onSent?.();
      onClose();
    } catch (err) {
      if (err.response?.data?.code === "ALREADY_SENT") {
        Alert.alert("Thông báo", "Bạn đã gửi lời mời này rồi");
        onSent?.(); onClose(); return;
      }
      Alert.alert("Lỗi", err.response?.data?.message || "Không gửi được");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Thêm bạn qua số điện thoại</Text>

          <View style={styles.row}>
            <TextInput
              style={styles.input}
              placeholder="Nhập số điện thoại"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                setStatus("none");
              }}
            />
            <TouchableOpacity style={styles.search} onPress={search}>
              <Ionicons name="search" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {busy && <ActivityIndicator style={{ marginTop: 8 }} />}

          {result && (
            <View style={styles.center}>
              <Image
                source={{ uri: result.avatar || `https://ui-avatars.com/api/?name=${result.name}` }}
                style={styles.avatar}
              />
              <Text style={styles.name}>{result.name}</Text>

              <TouchableOpacity
                style={[
                  styles.btn,
                  status !== "none" && { backgroundColor: "#999" }
                ]}
                disabled={status !== "none"}
                onPress={send}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>
                  {
                    status === "pending" ? "Đã gửi" :
                    status === "accepted" ? "Đã là bạn" :
                    "Gửi lời mời"
                  }
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.close} onPress={onClose}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#0006", justifyContent: "center", alignItems: "center" },
  modal: { backgroundColor: "#fff", borderRadius: 12, padding: 20, width: "90%" },
  title: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  row: { flexDirection: "row", gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: "#ccc", borderRadius: 8, height: 40, paddingHorizontal: 10 },
  search: { backgroundColor: "#1877f2", borderRadius: 8, padding: 10 },
  center: { alignItems: "center", marginTop: 20 },
  avatar: { width: 70, height: 70, borderRadius: 35, marginBottom: 8 },
  name: { fontSize: 16, fontWeight: "500", marginBottom: 8 },
  btn: { backgroundColor: "#1877f2", paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  close: { position: "absolute", top: 8, right: 8 }
});
