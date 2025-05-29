// src/screens/LoginScreen.tsx
import React, { useState, useContext } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Modal,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../App";
import { login } from "../modules/auth/controller";
import {
  saveAccessToken,
  saveRefreshToken,
  saveUserInfo,
} from "../services/storage";


export default function LoginScreen({ navigation }) {
  /* ───── CONTEXT ───── */
  const { setIsLoggedIn, setToken, setRefreshToken, setUser } =
    useContext(AuthContext);

  /* ───── LOCAL STATE (REMOVE default in production) ───── */
  const [phoneNumber, setPhoneNumber] = useState("0376963653");
  const [password, setPassword]       = useState("123456");
  const [loading, setLoading]         = useState(false);

  /* ───── NOTIFICATION MODAL ───── */
  const [notificationModal, setNotificationModal] = useState({
    visible : false,
    title   : "",
    message : "",
    actions : [],
  });
  const showNotification  = (title, message, actions = []) =>
    setNotificationModal({ visible: true, title, message, actions });
  const closeNotification = () => setNotificationModal((p) => ({ ...p, visible: false }));

  /* ───── LOGIN ───── */
  const handleLogin = async () => {
    if (!phoneNumber || !password) {
      Alert.alert("Lỗi", "Vui lòng nhập đủ số điện thoại & mật khẩu");
      return;
    }

    try {
      setLoading(true);
      const res = await login(phoneNumber, password);          // ← gọi API

      // API trả về { accessToken, refreshToken, user:{ userId, phone, name, ... } }
      const { accessToken, refreshToken, user } = res;

      if (!accessToken || !refreshToken || !user?.userId) {
        throw new Error("Thiếu thông tin từ server");
      }

      /* Lưu vĩnh viễn */
      await Promise.all([
        saveAccessToken(accessToken),
        saveRefreshToken(refreshToken),
        saveUserInfo(user),                                    // ⭐ LƯU userId
      ]);

      /* Cập nhật Context → App re-render */
      setToken(accessToken);
      setRefreshToken(refreshToken);
      setUser(user);
      setIsLoggedIn(true);
    } catch (err) {
      console.error("Login failed:", err);
      Alert.alert("Đăng nhập thất bại", err.message);
    } finally {
      setLoading(false);
    }
  };

  /* ───── UI ───── */
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1877f2" />
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Đăng nhập</Text>
        </View>
      </View>

      {/* Body */}
      <View style={styles.content}>
        <Text style={styles.instruction}>
          Vui lòng nhập số điện thoại và mật khẩu để đăng nhập
        </Text>

        {/* Phone input */}
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder="Số điện thoại"
            value={phoneNumber}
            keyboardType="phone-pad"
            maxLength={10}
            onChangeText={(txt) =>
              setPhoneNumber(txt.replace(/[^0-9]/g, "").slice(0, 10))
            }
          />
          {!!phoneNumber && (
            <TouchableOpacity onPress={() => setPhoneNumber("")} style={styles.clear}>
              <Text style={styles.clearTxt}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Password input */}
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder="Mật khẩu"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          {!!password && (
            <TouchableOpacity onPress={() => setPassword("")} style={styles.clear}>
              <Text style={styles.clearTxt}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : (
            <Ionicons name="arrow-forward" size={28} color="#fff" />
          )}
        </TouchableOpacity>

        {/* Quên mật khẩu & Đăng ký */}
        <TouchableOpacity
          style={styles.forgot}
          onPress={() => navigation.navigate("ForgotPassword")}
        >
          <Text style={styles.forgotTxt}>Lấy lại mật khẩu</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("SignUp")} style={styles.signUp}>
          <Text style={styles.signUpTxt}>Chưa có tài khoản? Đăng ký</Text>
        </TouchableOpacity>
      </View>

      {/* Notification modal (rút gọn) */}
      <Modal visible={notificationModal.visible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeNotification}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{notificationModal.title}</Text>
            <Text style={styles.modalMsg}>{notificationModal.message}</Text>
            <TouchableOpacity style={styles.modalBtn} onPress={closeNotification}>
              <Text style={styles.modalBtnTxt}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

/* ───── STYLES (tối giản) ───── */
const styles = StyleSheet.create({
  container  : { flex: 1, backgroundColor: "#fff" },
  header     : { backgroundColor: "#1877f2", paddingBottom: 12, paddingTop: 8 },
  headerContent:{ flexDirection:"row", alignItems:"center", paddingHorizontal:15 },
  backButton : { padding: 5 },
  headerTitle: { color:"#fff", fontSize:20, fontWeight:"bold", marginLeft:12 },
  content    : { flex: 1, padding: 20 },
  instruction: { color:"#424242", fontSize:16, marginBottom:25 },
  inputWrap  : { flexDirection:"row", alignItems:"center", marginBottom:18 },
  input      : { flex:1, fontSize:16, borderBottomWidth:1, borderColor:"#e0e0e0", paddingVertical:8 },
  clear      : { padding:8, position:"absolute", right:0 },
  clearTxt   : { fontSize:18, color:"#aaa" },
  submitBtn  : { backgroundColor:"#1877f2", width:60, height:60, borderRadius:30,
                 alignSelf:"flex-end", alignItems:"center", justifyContent:"center",
                 shadowColor:"#1877f2", shadowOpacity:.3, shadowRadius:8, elevation:6 },
  forgot     : { marginTop:20 },
  forgotTxt  : { color:"#1877f2", fontSize:16 },
  signUp     : { alignItems:"center", marginTop:40 },
  signUpTxt  : { color:"#1877f2", fontSize:16 },
  modalOverlay:{ flex:1, backgroundColor:"rgba(0,0,0,.4)", alignItems:"center", justifyContent:"center" },
  modalBox   : { backgroundColor:"#fff", borderRadius:8, padding:24, width:"80%" },
  modalTitle : { fontSize:18, fontWeight:"bold", textAlign:"center", marginBottom:12 },
  modalMsg   : { fontSize:16, textAlign:"center", marginBottom:20 },
  modalBtn   : { backgroundColor:"#1877f2", borderRadius:6, paddingVertical:10 },
  modalBtnTxt: { color:"#fff", fontSize:16, textAlign:"center" }
});
