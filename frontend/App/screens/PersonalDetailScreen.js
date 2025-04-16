import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Modal,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { updateUserProfile, updateAvatar, getUserProfile } from '../modules/user/controller';
import { AuthContext } from '../App';
import COLORS from '../components/colors';
import { formatPhone, formatPhoneForStorage } from '../utils/formatPhone';

const PersonalDetailScreen = ({ navigation }) => {
  const { user, setUser } = useContext(AuthContext);
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAvatarOptions, setShowAvatarOptions] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');

  console.log("PersonalDetailScreen mounted");
  console.log("Initial user data:", user);

  useEffect(() => {
    console.log("useEffect triggered");
    loadUserData();
  }, []);

  const loadUserData = async () => {
    console.log("loadUserData called");
    try {
      setIsLoading(true);
      const data = await getUserProfile();
      console.log("User profile in DetailScreen:", data);
      console.log("Avatar URL:", data.avatar);
      
      setUserData(data);
      setUser(data);
      
      if (data.dateOfBirth) {
        setSelectedDate(new Date(data.dateOfBirth));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Lỗi', 'Không thể tải thông tin người dùng. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCameraCapture = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Cần quyền truy cập', 'Vui lòng cho phép ứng dụng truy cập camera');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        handleUploadAvatar(result.assets[0]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Lỗi', 'Không thể chụp ảnh');
    }
  };

  const handleGalleryPick = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        const selectedImage = result.assets[0];
        console.log('Selected image:', selectedImage);
        handleUploadAvatar(selectedImage);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleUploadAvatar = async (imageAsset) => {
    try {
      setIsLoading(true);
      
      // Format file object for multer
      const file = {
        uri: imageAsset.uri,
        type: imageAsset.mimeType || 'image/jpeg',
        name: imageAsset.fileName || 'avatar.jpg',
        width: imageAsset.width,
        height: imageAsset.height
      };

      console.log('Selected image:', imageAsset);
      console.log('Formatted file:', file);

      const avatarUrl = await updateAvatar(file);
      console.log('Avatar URL:', avatarUrl);
      
      // Update user in context and local state
      const updatedUser = {
        ...userData,
        avatar: avatarUrl
      };
      setUserData(updatedUser);
      setUser(updatedUser);
      
      await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
      Alert.alert('Thành công', 'Cập nhật ảnh đại diện thành công');
    } catch (error) {
      console.error('Update avatar error:', error);
      Alert.alert('Lỗi', error.message || 'Cập nhật ảnh đại diện thất bại');
    } finally {
      setIsLoading(false);
      setShowAvatarOptions(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      setIsLoading(true);
      const dataToUpdate = {
        ...userData,
        phone: formatPhoneForStorage(userData.phone)
      };
      const updatedData = await updateUserProfile(dataToUpdate);
      await AsyncStorage.setItem('userData', JSON.stringify(updatedData));
      setIsEditing(false);
      Alert.alert('Thành công', 'Cập nhật thông tin thành công');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Lỗi', 'Không thể cập nhật thông tin');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateChange = (event, date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
      setUserData(prev => ({
        ...prev,
        dateOfBirth: date.toISOString().split('T')[0]
      }));
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  };

  const getDefaultAvatar = (name) => {
    const defaultName = name || 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(defaultName)}&background=random&color=fff&size=256`;
  };

  const handleNameEdit = () => {
    if (!isEditingName) {
      setTempName(userData.name || '');
      setIsEditingName(true);
    } else {
      setUserData(prev => ({
        ...prev,
        name: tempName.trim()
      }));
      setIsEditingName(false);
    }
  };

  const renderAvatarSection = () => (
    <TouchableOpacity 
      style={styles.avatarContainer}
      onPress={() => isEditing && setShowAvatarOptions(true)}
      disabled={!isEditing}
    >
      {isLoading ? (
        <View style={[styles.avatar, styles.loadingContainer]}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : userData?.avatar ? (
        <Image 
          source={{ uri: userData.avatar }} 
          style={styles.avatar}
        />
      ) : (
        <View style={styles.placeholderAvatar}>
          <Ionicons name="person" size={80} color="#CCCCCC" />
        </View>
      )}
      {isEditing && (
        <View style={styles.editAvatarButton}>
          <Ionicons name="camera" size={20} color="#FFF" />
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thông tin cá nhân</Text>
        <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
          <Text style={styles.editButton}>{isEditing ? 'Hủy' : 'Chỉnh sửa'}</Text>
        </TouchableOpacity>
      </View>

      {userData && (
        <View style={styles.content}>
          {renderAvatarSection()}

          <View style={styles.infoContainer}>
            <TouchableOpacity 
              style={styles.infoRow}
              onPress={() => isEditing && handleNameEdit()}
            >
              <Text style={styles.label}>Tên</Text>
              {isEditing && isEditingName ? (
                <TextInput
                  style={[styles.input, styles.editableValue]}
                  value={tempName}
                  onChangeText={setTempName}
                  onBlur={handleNameEdit}
                  autoFocus
                  placeholder="Nhập tên của bạn"
                />
              ) : (
                <Text style={[styles.value, isEditing && styles.editableValue]}>
                  {userData.name || 'Chưa cập nhật'}
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Số điện thoại</Text>
              <Text style={styles.value}>{formatPhone(userData.phone)}</Text>
            </View>

            <TouchableOpacity 
              style={styles.infoRow}
              onPress={() => isEditing && setShowGenderPicker(true)}
            >
              <Text style={styles.label}>Giới tính</Text>
              <Text style={[styles.value, isEditing && styles.editableValue]}>
                {userData.gender || 'Chưa cập nhật'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.infoRow}
              onPress={() => isEditing && setShowDatePicker(true)}
            >
              <Text style={styles.label}>Ngày sinh</Text>
              <Text style={[styles.value, isEditing && styles.editableValue]}>
                {userData.dateOfBirth ? formatDate(userData.dateOfBirth) : 'Chưa cập nhật'}
              </Text>
            </TouchableOpacity>
          </View>

          {isEditing && (
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={handleUpdateProfile}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.saveButtonText}>Lưu thay đổi</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Avatar Options Modal */}
      <Modal
        visible={showAvatarOptions}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAvatarOptions(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowAvatarOptions(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <TouchableOpacity
                style={styles.modalOption}
                onPress={handleCameraCapture}
              >
                <Ionicons name="camera-outline" size={24} color={COLORS.primary} />
                <Text style={styles.modalOptionText}>Chụp ảnh</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalOption}
                onPress={handleGalleryPick}
              >
                <Ionicons name="images-outline" size={24} color={COLORS.primary} />
                <Text style={styles.modalOptionText}>Chọn từ thư viện</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalOption, styles.cancelOption]}
                onPress={() => setShowAvatarOptions(false)}
              >
                <Text style={styles.cancelText}>Hủy</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Gender Picker Modal */}
      <Modal
        visible={showGenderPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGenderPicker(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowGenderPicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <TouchableOpacity
                style={styles.genderOption}
                onPress={() => {
                  setUserData(prev => ({ ...prev, gender: 'Nam' }));
                  setShowGenderPicker(false);
                }}
              >
                <Text style={styles.genderOptionText}>Nam</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.genderOption}
                onPress={() => {
                  setUserData(prev => ({ ...prev, gender: 'Nữ' }));
                  setShowGenderPicker(false);
                }}
              >
                <Text style={styles.genderOptionText}>Nữ</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
          maximumDate={new Date()}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  editButton: {
    color: COLORS.primary,
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  loadingContainer: {
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderAvatar: {
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
    color: '#FFFFFF',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: '35%',
    backgroundColor: COLORS.primary,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 15,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  label: {
    fontSize: 16,
    color: '#666666',
  },
  value: {
    fontSize: 16,
    color: '#333333',
  },
  editableValue: {
    color: COLORS.primary,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 30,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalOptionText: {
    fontSize: 16,
    marginLeft: 15,
    color: '#333333',
  },
  cancelOption: {
    justifyContent: 'center',
    borderBottomWidth: 0,
    marginTop: 10,
  },
  cancelText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '500',
  },
  genderOption: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  genderOptionText: {
    fontSize: 16,
    color: '#333333',
    textAlign: 'center',
  },
  input: {
    fontSize: 16,
    color: '#333333',
    minWidth: 120,
    textAlign: 'right',
    padding: 0,
  },
});

export default PersonalDetailScreen; 