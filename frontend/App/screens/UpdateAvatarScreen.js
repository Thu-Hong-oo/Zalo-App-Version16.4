import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Image,
  Modal,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '../App';
import { updateAvatar, generateInitialsAvatar, skipAvatarUpdate, updateProfile } from '../modules/user/controller';
import api from '../config/api';

const UpdateAvatarScreen = () => {
  const navigation = useNavigation();
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { setIsLoggedIn, setUser } = useContext(AuthContext);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const data = await AsyncStorage.getItem('userData');
      if (data) {
        const parsedData = JSON.parse(data);
        setUserData(parsedData);
        console.log('User data loaded:', parsedData);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const pickImage = async () => {
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
        setImage(selectedImage);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const takePhoto = async () => {
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
        setImage(result);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Lỗi', 'Không thể chụp ảnh');
    }
  };

  const showError = (message) => {
    setErrorMessage(message);
    setErrorModalVisible(true);
  };

  const handleUpdateAvatar = async () => {
    try {
      if (!image) {
        Alert.alert('Lỗi', 'Vui lòng chọn ảnh');
        return;
      }

      // Format file object for multer
      const file = {
        uri: image.uri,
        type: image.mimeType || 'image/jpeg',
        name: image.fileName || 'avatar.jpg',
        width: image.width,
        height: image.height
      };

      console.log('Selected image:', image);
      console.log('Formatted file:', file);

      setLoading(true);
      const avatarUrl = await updateAvatar(file);
      console.log('Avatar URL:', avatarUrl);
      
      // Update user in context and set login status
      const updatedUser = {
        ...userData,
        avatar: avatarUrl
      };
      setUser(updatedUser);
      setIsLoggedIn(true);
      
      Alert.alert('Thành công', 'Cập nhật ảnh đại diện thành công');
      navigation.navigate('ChatTab');
    } catch (error) {
      console.error('Update avatar error:', error);
      Alert.alert('Lỗi', error.message || 'Cập nhật ảnh đại diện thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    try {
      setLoading(true);
      
      const response = await skipAvatarUpdate(userData);
      
      // Update local storage
      const updatedUserData = {
        ...userData,
        ...response
      };
      await AsyncStorage.setItem('userData', JSON.stringify(updatedUserData));
      
     
    } catch (error) {
      console.error('Profile update error:', error);
      showError('Không thể cập nhật thông tin. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1877f2" />
      
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cập nhật ảnh đại diện</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.avatarContainer}>
          {image ? (
            <Image source={{ uri: image.uri }} style={styles.avatar} />
          ) : (
            <View style={styles.placeholderAvatar}>
              <Ionicons name="person" size={80} color="#CCCCCC" />
            </View>
          )}
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={styles.optionButton}
            onPress={pickImage}
          >
            <Ionicons name="images-outline" size={24} color="#0068FF" />
            <Text style={styles.optionButtonText}>Thư viện</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.optionButton}
            onPress={takePhoto}
          >
            <Ionicons name="camera-outline" size={24} color="#0068FF" />
            <Text style={styles.optionButtonText}>Chụp ảnh</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.updateButton, loading && styles.disabledButton]}
          onPress={handleUpdateAvatar}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.updateButtonText}>Cập nhật</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.skipButton}
          onPress={handleSkip}
          disabled={loading}
        >
          <Text style={styles.skipButtonText}>Bỏ qua</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={errorModalVisible}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Lỗi</Text>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalMessage}>{errorMessage}</Text>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setErrorModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingTop: 10,
    paddingBottom: 15,
    backgroundColor: '#1877f2',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 15,
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  avatarContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#F5F5F5',
    marginVertical: 30,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  placeholderAvatar: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 30,
  },
  optionButton: {
    flexDirection: 'column',
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    width: '45%',
  },
  optionButtonText: {
    color: '#0068FF',
    marginTop: 8,
    fontWeight: '500',
  },
  updateButton: {
    backgroundColor: '#0068FF',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 40,
    marginBottom: 15,
    width: '80%',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#AAAAAA',
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  skipButton: {
    padding: 10,
  },
  skipButtonText: {
    color: '#666666',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    width: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalBody: {
    padding: 20,
  },
  modalMessage: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333333',
  },
  modalFooter: {
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  modalButton: {
    padding: 15,
    alignItems: 'center',
    backgroundColor: '#0068FF',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default UpdateAvatarScreen;