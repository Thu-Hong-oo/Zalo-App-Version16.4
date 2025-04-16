import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserProfile, updateUserProfile } from '../modules/user/controller';
import { useNavigation } from '@react-navigation/native';
import COLORS from '../components/colors';
import { useContext } from 'react';
import { AuthContext } from '../App';

const ProfileDetailScreen = () => {
  const navigation = useNavigation();
  const { user, setUser } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [userData, setUserData] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    gender: '',
    dateOfBirth: '',
  });

  console.log("ProfileDetailScreen mounted");
  console.log("Initial user data:", user);

  useEffect(() => {
    console.log("useEffect triggered");
    loadUserData();
  }, []);

  const loadUserData = async () => {
    console.log("loadUserData called");
    try {
      setLoading(true);
      const data = await getUserProfile();
      console.log("User profile in DetailScreen:", data);
      console.log("Avatar URL:", data.avatar);
      
      // Cập nhật cả userData local và user trong context
      setUserData(data);
      setUser(data);
      
      // Cập nhật formData với dữ liệu mới
      setFormData({
        name: data.name || '',
        gender: data.gender || '',
        dateOfBirth: data.dateOfBirth || '',
      });
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Lỗi', 'Không thể tải thông tin người dùng. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await updateUserProfile(formData);
      await loadUserData(); // Tải lại dữ liệu sau khi cập nhật
      setEditing(false);
      Alert.alert('Thành công', 'Thông tin đã được cập nhật');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Lỗi', error.message || 'Không thể cập nhật thông tin. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  const getDefaultAvatar = (name) => {
    const defaultName = name || 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(defaultName)}&background=random&color=fff&size=256`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1877f2" />
      
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thông tin cá nhân</Text>
          <TouchableOpacity 
            style={styles.editButton} 
            onPress={() => setEditing(!editing)}
          >
            <Text style={styles.editButtonText}>
              {editing ? 'Hủy' : 'Chỉnh sửa'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.avatarContainer}>
          <Image
            source={{ 
              uri: userData?.avatar || 'https://via.placeholder.com/150'
            }}
            style={styles.avatar}
          />
          <TouchableOpacity 
            style={styles.changeAvatarButton}
            onPress={() => navigation.navigate('UpdateAvatar')}
          >
            <Text style={styles.changeAvatarText}>Đổi ảnh đại diện</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông tin cơ bản</Text>
          
          <View style={styles.field}>
            <Text style={styles.label}>Họ và tên</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData({...formData, name: text})}
                placeholder="Nhập họ và tên"
              />
            ) : (
              <Text style={styles.value}>{userData?.name || 'Chưa cập nhật'}</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Giới tính</Text>
            {editing ? (
              <View style={styles.genderButtons}>
                <TouchableOpacity
                  style={[
                    styles.genderButton,
                    formData.gender === 'male' && styles.genderButtonActive
                  ]}
                  onPress={() => setFormData({...formData, gender: 'male'})}
                >
                  <Text style={[
                    styles.genderButtonText,
                    formData.gender === 'male' && styles.genderButtonTextActive
                  ]}>Nam</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.genderButton,
                    formData.gender === 'female' && styles.genderButtonActive
                  ]}
                  onPress={() => setFormData({...formData, gender: 'female'})}
                >
                  <Text style={[
                    styles.genderButtonText,
                    formData.gender === 'female' && styles.genderButtonTextActive
                  ]}>Nữ</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.value}>
                {userData?.gender === 'male' ? 'Nam' : userData?.gender === 'female' ? 'Nữ' : 'Chưa cập nhật'}
              </Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Ngày sinh</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={formData.dateOfBirth}
                onChangeText={(text) => setFormData({...formData, dateOfBirth: text})}
                placeholder="DD/MM/YYYY"
              />
            ) : (
              <Text style={styles.value}>{userData?.dateOfBirth || 'Chưa cập nhật'}</Text>
            )}
          </View>
        </View>
      </ScrollView>

      {editing && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.saveButtonText}>Lưu thay đổi</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    justifyContent: 'space-between',
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
  },
  avatarContainer: {
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
  },
  changeAvatarButton: {
    padding: 10,
  },
  changeAvatarText: {
    color: '#1877f2',
    fontSize: 16,
  },
  section: {
    backgroundColor: 'white',
    marginTop: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  value: {
    fontSize: 16,
    color: '#333',
  },
  input: {
    fontSize: 16,
    color: '#333',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 8,
  },
  genderButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  genderButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  genderButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  genderButtonText: {
    fontSize: 16,
    color: '#666',
  },
  genderButtonTextActive: {
    color: 'white',
  },
  footer: {
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  editButton: {
    padding: 8,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});

export default ProfileDetailScreen; 