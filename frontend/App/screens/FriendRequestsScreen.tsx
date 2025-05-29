import React, { useCallback, useContext, useEffect, useState } from "react";
import {
  View, Text, FlatList, Image, StyleSheet, TouchableOpacity, ActivityIndicator
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { AuthContext } from "../App";
import { getUserInfo } from "../services/storage";
import api from "../config/api";

export default function FriendRequestsScreen() {
  const [received, setReceived] = useState<any[]>([]);
  const [sent,     setSent]     = useState<any[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [tab,      setTab]      = useState<"received"|"sent">("received");
  const [userId,   setUserId]   = useState("");

  const navigation = useNavigation<any>();
  const { user }   = useContext(AuthContext);

  /* Lấy userId */
  useEffect(() => {
    (async () => {
      const id = user?.userId || (await getUserInfo())?.userId || "";
      setUserId(id);
    })();
  }, [user]);

  const loadRequests = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [rec, sen] = await Promise.all([
        api.get(`/friends/request/received/${userId}`),
        api.get(`/friends/request/sent/${userId}`),
      ]);
      setReceived(rec.data.received ?? []);
      setSent(sen.data.sent ?? []);
    } catch (err) {
      console.error("loadRequests:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { loadRequests(); }, [loadRequests, tab]));

  /* Sau khi accept/reject/cancel thì cập nhật và thông báo ContactsScreen */
  const post = (url:string, body:any) =>
    api.post(url, body).then(async () => {
      await loadRequests();
      navigation.navigate("Contacts", { refresh: Date.now() });
    });

  const render = ({ item }: any) => {
    const u = tab === "received" ? item.fromUser : item.toUser;
    return (
      <View style={styles.card}>
        <Image source={{ uri: u?.avatar }} style={styles.avatar} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{u?.name}</Text>
          <Text style={{ color: "#555" }}>Muốn kết bạn</Text>
        </View>
        {tab === "received" ? (
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.btn, styles.gray]}
              onPress={() => post("/friends/request/reject", { requestId: item.requestId })}
            >
              <Text>Từ chối</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.blue]}
              onPress={() => post("/friends/request/accept", { requestId: item.requestId })}
            >
              <Text style={{ color: "#fff" }}>Đồng ý</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.btn, styles.gray]}
            onPress={() => post("/friends/request/cancel", { requestId: item.requestId })}
          >
            <Text>Thu hồi</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const data = tab === "received" ? received : sent;

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={styles.tabs}>
        {["received", "sent"].map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.active]}
            onPress={() => setTab(t as any)}
          >
            <Text style={tab === t ? styles.activeTxt : styles.txt}>
              {t === "received" ? "Đã nhận" : "Đã gửi"} (
              {t === "received" ? received.length : sent.length})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 20 }} /> : (
        <FlatList
          data={data}
          keyExtractor={i => i.requestId}
          renderItem={render}
          contentContainerStyle={{ padding: 12 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#ddd" },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  active: { borderBottomWidth: 2, borderBottomColor: "#1877f2" },
  txt: { color: "#666" },
  activeTxt: { color: "#1877f2", fontWeight: "600" },
  card: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10
  },
  avatar: { width: 52, height: 52, borderRadius: 26, marginRight: 12 },
  name: { fontWeight: "bold", fontSize: 16 },
  row: { flexDirection: "row", gap: 8 },
  btn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  gray: { backgroundColor: "#e0e0e0" },
  blue: { backgroundColor: "#1877f2" }
});
