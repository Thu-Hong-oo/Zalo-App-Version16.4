import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '../App';
import COLORS from '../components/colors';
import { getUserProfile, changePassword, updateStatus } from '../modules/user/controller';
import { useNavigation,useFocusEffect } from '@react-navigation/native';
import { formatPhone } from '../utils/formatPhone';

const PersonalScreen = () => {
  const navigation = useNavigation();
  const { user, setUser, setIsLoggedIn, setToken, setRefreshToken } = useContext(AuthContext);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [loading, setLoading] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  const loadUserData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getUserProfile();
      console.log("User profile in Screen:", data);
      if (data) {
        setUser(data);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Lỗi', 'Không thể tải thông tin người dùng. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  }, [setUser]);

  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [loadUserData])
  );

  const handleLogout = async () => {
    try {
      setLoading(true);
      
      // Try to update status but don't block if it fails
      try {
        await updateStatus('offline');
      } catch (error) {
        console.log('Failed to update status, continuing with logout:', error);
      }
      
      // Clear all stored data
      await AsyncStorage.multiRemove(['userData', 'token', 'refreshToken', 'isLoggedIn']);
      
      // Clear context
      setUser(null);
      setToken(null);
      setRefreshToken(null);
      setIsLoggedIn(false);
      
      // Close modal and navigate
      setLogoutModalVisible(false);
      navigation.reset({
        index: 0,
        routes: [{ name: 'Welcome' }],
      });
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Lỗi', 'Không thể đăng xuất. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    // Validate all fields are filled
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ thông tin');
      return;
    }

    // Validate new password length
    if (newPassword.length < 6) {
      Alert.alert('Lỗi', 'Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }

    // Validate new password match
    if (newPassword !== confirmPassword) {
      Alert.alert('Lỗi', 'Mật khẩu mới không khớp');
      return;
    }

    try {
      setLoading(true);
      const result = await changePassword(currentPassword, newPassword);
      
      // Clear password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Close modal and show success message
      setShowChangePasswordModal(false);
      Alert.alert('Thành công', result.message || 'Mật khẩu đã được thay đổi');
    } catch (error) {
      console.error('Change password error:', error);
      Alert.alert('Lỗi', error.message || 'Không thể đổi mật khẩu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const renderMenuItem = (icon, title, onPress) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuItemContent}>
        <Ionicons name={icon} size={24} color={COLORS.primary} />
        <Text style={styles.menuItemText}>{title}</Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#666" />
    </TouchableOpacity>
  );

  const LogoutModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={logoutModalVisible}
      onRequestClose={() => setLogoutModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Đăng xuất</Text>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.modalText}>Bạn có chắc chắn muốn đăng xuất?</Text>
          </View>
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setLogoutModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.logoutButton]}
              onPress={handleLogout}
            >
              <Text style={[styles.modalButtonText, styles.logoutButtonText]}>Đăng xuất</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderChangePasswordModal = () => (
    <Modal
      visible={showChangePasswordModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => {
        setShowChangePasswordModal(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }}
    >
      <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Đổi mật khẩu</Text>
              
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Mật khẩu hiện tại"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showPassword.current}
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(prev => ({
                    ...prev,
                    current: !prev.current
                  }))}
                >
                  <Ionicons
                    name={showPassword.current ? "eye-outline" : "eye-off-outline"}
                    size={24}
                    color="#666"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Mật khẩu mới"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPassword.new}
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(prev => ({
                    ...prev,
                    new: !prev.new
                  }))}
                >
                  <Ionicons
                    name={showPassword.new ? "eye-outline" : "eye-off-outline"}
                    size={24}
                    color="#666"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Nhập lại mật khẩu mới"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword.confirm}
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(prev => ({
                    ...prev,
                    confirm: !prev.confirm
                  }))}
                >
                  <Ionicons
                    name={showPassword.confirm ? "eye-outline" : "eye-off-outline"}
                    size={24}
                    color="#666"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setShowChangePasswordModal(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.submitButton]}
                  onPress={handleChangePassword}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.submitButtonText}>Xác nhận</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.profileSection}>
          <Image
            source={{ uri: user?.avatar || 'https://via.placeholder.com/150' }}
            style={styles.avatar}
          />
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name || 'Người dùng'}</Text>
            <Text style={styles.userPhone}>{formatPhone(user?.phone) || 'Chưa cập nhật'}</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Menu Items */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Tài khoản</Text>
          {renderMenuItem('person-outline', 'Thông tin cá nhân', () => navigation.navigate('PersonalDetail'))}
          {renderMenuItem('key-outline', 'Đổi mật khẩu', () => setShowChangePasswordModal(true))}
          {renderMenuItem('shield-outline', 'Bảo mật và quyền riêng tư', () => {})}
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Cài đặt</Text>
          {renderMenuItem('notifications-outline', 'Thông báo', () => {})}
          {renderMenuItem('moon-outline', 'Giao diện', () => {})}
          {renderMenuItem('language-outline', 'Ngôn ngữ', () => {})}
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Khác</Text>
          {renderMenuItem('help-circle-outline', 'Trợ giúp & phản hồi', () => {})}
          {renderMenuItem('information-circle-outline', 'Về ứng dụng', () => {})}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setLogoutModalVisible(true)}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
              <Text style={[styles.menuItemText, styles.logoutText]}>Đăng xuất</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {renderChangePasswordModal()}
      <LogoutModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 15,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  userPhone: {
    fontSize: 14,
    color: '#666',
  },
  content: {
    padding: 20,
  },
  menuSection: {
    backgroundColor: '#fff',
    marginBottom: 10,
    paddingVertical: 10,
  },
  menuSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 16,
    marginLeft: 15,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutText: {
    color: '#FF3B30',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    width: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalBody: {
    padding: 20,
  },
  modalText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#8E8E93',
  },
  modalFooter: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  modalButton: {
    flex: 1,
    padding: 15,
    alignItems: 'center',
  },
  cancelButton: {
    borderRightWidth: 1,
    borderRightColor: '#E5E5EA',
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButtonText: {
    color: 'white',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    position: 'relative',
    zIndex: 1000,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButtonText: {
    color: '#666',
    textAlign: 'center',
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: '#1877f2',
  },
  submitButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
  },
  inputContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    paddingRight: 45,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    height: 48,
  },
  eyeIcon: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -12 }],
    padding: 4,
  },
});

export default PersonalScreen;
