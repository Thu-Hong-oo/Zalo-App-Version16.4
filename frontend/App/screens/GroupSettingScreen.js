import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Image,
  Switch,
  Modal,
  Alert,

  ActivityIndicator,
  FlatList,
  TextInput
} from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { 
  leaveGroup, 
  dissolveGroup, 
  getGroupInfo, 
  getGroupMembers,
  updateMemberRole,
  addGroupMember,
  removeGroupMember,
  updateGroupAvatar,
  updateGroupName
} from '../modules/group/controller';
import { AuthContext } from '../App';
import COLORS from '../components/colors';
import io from 'socket.io-client';
import { getApiUrlAsync } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';


const GroupSettingsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { groupId } = route.params;
  const [socket, setSocket] = useState(null);

  const { user } = useContext(AuthContext);
  console.log('Thông tin user để biet ai tạo nhóm, ', user);
  const [showLeaveGroupModal, setShowLeaveGroupModal] = useState(false);
  const [showDissolveGroupModal, setShowDissolveGroupModal] = useState(false);
  const [showTransferAdminModal, setShowTransferAdminModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [groupInfo, setGroupInfo] = useState(null);
  const [members, setMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [showTransferSuccess, setShowTransferSuccess] = useState(false);
  const [showLeaveSuccess, setShowLeaveSuccess] = useState(false);
  const [showDissolveSuccess, setShowDissolveSuccess] = useState(false);

  // Initialize socket connection
  useEffect(() => {
    const initSocket = async () => {
      try {
        const token = await AsyncStorage.getItem('accessToken');
        const apiUrl = await getApiUrlAsync();
        
        if (!token || !apiUrl) {
          console.error('No token or API URL found for socket connection');
          return;
        }

        const newSocket = io(apiUrl, {
          auth: { token },
          transports: ['websocket'],
          reconnection: true
        });

        newSocket.on('connect', () => {
          console.log('Socket connected successfully');
        });

        newSocket.on('error', (error) => {
          console.error('Socket error:', error);
        });

        setSocket(newSocket);

        return () => {
          if (newSocket) {
            newSocket.disconnect();
          }
        };
      } catch (error) {
        console.error('Socket initialization error:', error);
      }
    };

    initSocket();
  }, []);

  // Fetch group info and members
  const fetchGroupInfo = useCallback(async () => {
    setLoading(true);
    try {
      console.log(`Fetching group info for groupId: ${groupId}`);
      const info = await getGroupInfo(groupId);
      console.log('Fetched group info:', info);
      if (info && info.groupId) {
        setGroupInfo(info);
        setMembers(info.members || []);
        const currentMember = info.members?.find(m => m.userId === user?.userId);
        console.log('Current member:', currentMember);
        console.log('Current member role:', currentMember?.role);
        setIsAdmin(currentMember?.role === 'ADMIN');
      } else {
        // Handle group not found or invalid data
        setGroupInfo(null);
        setMembers([]);
        setIsAdmin(false);
        Alert.alert('Lỗi', 'Không thể tải thông tin nhóm hoặc nhóm không tồn tại.');
      }
    } catch (error) {
      console.error('Error fetching group info:', error);
      Alert.alert('Lỗi', 'Không thể tải thông tin nhóm');
    } finally {
      setLoading(false);
    }
  }, [groupId, user?.userId]);

  // Fetch data when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchGroupInfo();
    }, [fetchGroupInfo])
  );

  useEffect(() => {
    // Setup socket listeners
    const handleMemberAdded = (data) => {
      if (data.groupId === groupId) {
        console.log('Socket event (Settings): Member added', data);
        fetchGroupInfo(); // Re-fetch group info
      }
    };

    const handleMemberRemoved = (data) => {
      if (data.groupId === groupId) {
        console.log('Socket event (Settings): Member removed', data);
        fetchGroupInfo(); // Re-fetch group info
      }
    };

    const handleGroupUpdated = (data) => {
      if (data.groupId === groupId) {
        console.log('Socket event (Settings): Group updated', data);
        fetchGroupInfo(); // Re-fetch group info
      }
    };

    socket?.addListener('group:memberAdded', handleMemberAdded);
    socket?.addListener('group:memberRemoved', handleMemberRemoved);
    socket?.addListener('group:updated', handleGroupUpdated);
    socket?.joinGroup(groupId); // Join the group room

    // Cleanup listeners on unmount
    return () => {
      socket?.removeListener('group:memberAdded', handleMemberAdded);
      socket?.removeListener('group:memberRemoved', handleMemberRemoved);
      socket?.removeListener('group:updated', handleGroupUpdated);
      socket?.leaveGroup(groupId); // Leave the group room
    };
  }, [groupId, fetchGroupInfo]);

  const handleTransferAdmin = async () => {
    if (!selectedMember) {
      Alert.alert('Lỗi', 'Vui lòng chọn thành viên để chuyển quyền');
      return;
    }

    try {
      setLoading(true);
      // First make the selected member an admin
      await updateMemberRole(groupId, selectedMember.userId, 'ADMIN');
      // Then demote current admin to member
      await updateMemberRole(groupId, user.userId, 'MEMBER');
      
      setShowTransferAdminModal(false);
      setShowTransferSuccess(true);
      
      // Cập nhật lại thông tin nhóm sau 2 giây và đóng modal thành công
      setTimeout(() => {
        setShowTransferSuccess(false);
        fetchGroupInfo(); // Refresh group info to update UI
      }, 2000);

      // Emit socket event để thông báo cho các thành viên khác
      socket?.emit('group:updated', {
        groupId,
        type: 'TRANSFER_ADMIN',
        newAdminId: selectedMember.userId,
        previousAdminId: user.userId
      });

    } catch (error) {
      console.error('Transfer admin error:', error);
      Alert.alert('Lỗi', 'Không thể chuyển quyền trưởng nhóm');
    } finally {
      setLoading(false);
      setSelectedMember(null); // Reset selected member
    }
  };


  const handleLeaveGroup = async () => {
    try {
      setLoading(true);
      
      // Check if user is admin and there are other members
      if (isAdmin && members.length > 1) {
        setShowLeaveGroupModal(false);
        setShowTransferAdminModal(true);
        return;
      }

      // Leave the group through API
      await leaveGroup(groupId, user.userId);
      
      setShowLeaveGroupModal(false);
      setShowLeaveSuccess(true);

      // Emit socket events if socket is connected
      if (socket?.connected) {
        console.log('Emitting leave group events...');
        
        socket.emit('group:member_leave', {
          groupId,
          userId: user.userId,
          action: 'leave'
        });

        socket.emit('chat:update', {
          type: 'group',
          action: 'leave',
          groupId: groupId,
          userId: user.userId
        });
      } else {
        console.log('Socket not connected, skipping events');
      }
      
      // After 2 seconds, close modal and navigate
      setTimeout(() => {
        setShowLeaveSuccess(false);
        navigation.reset({
          index: 0,
          routes: [
            {
              name: 'ChatTab',
              state: {
                routes: [
                  { name: 'Chat' }
                ]
              }
            }
          ]
        });
      }, 2000);

    } catch (error) {
      console.error('Leave group error:', error);
      Alert.alert('Lỗi', error.message || 'Không thể rời nhóm. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleDissolveGroup = async () => {
    try {
      setLoading(true);
      await dissolveGroup(groupId);
      
      // Emit socket event for realtime update
      try {
        if (socket?.connected) {
          socket.emit('group:dissolved', {
            groupId,
            userId: user.userId
          });

          // Emit event to update chat list
          socket.emit('chat:update', {
            type: 'group',
            action: 'dissolve',
            groupId: groupId,
            userId: user.userId
          });
        }
      } catch (socketError) {
        console.warn('Socket emit error:', socketError);
        // Continue with navigation even if socket events fail
      }

      setShowDissolveGroupModal(false);
      setShowDissolveSuccess(true);
      
      // After 2 seconds, close modal and navigate
      setTimeout(() => {
        setShowDissolveSuccess(false);
        // Reset navigation stack và chuyển về màn hình Chat
        navigation.reset({
          index: 0,
          routes: [
            {
              name: 'ChatTab',
              state: {
                routes: [
                  { name: 'Chat' }
                ]
              }
            }
          ]
        });
      }, 2000);
    } catch (error) {
      console.error('Error dissolving group:', error);
      setShowDissolveGroupModal(false);
      Alert.alert('Lỗi', error.message || 'Không thể giải tán nhóm. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Lỗi', 'Cần cấp quyền truy cập thư viện ảnh');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setLoading(true);
        try {
          const selectedImage = result.assets[0];
          
          // Format file object for multer
          const file = {
            uri: selectedImage.uri,
            type: selectedImage.type || 'image/jpeg',
            fileName: selectedImage.uri.split('/').pop() || 'avatar.jpg',
            width: selectedImage.width,
            height: selectedImage.height
          };

          console.log('Selected image:', selectedImage);
          console.log('Formatted file:', file);
          
          const uploadResponse = await updateGroupAvatar(groupId, file);
          console.log('Upload avatar response:', uploadResponse);
          
          // Refresh group info to get new avatar
          await fetchGroupInfo();
          Alert.alert('Thành công', 'Đã cập nhật ảnh nhóm');
        } catch (error) {
          console.error('Upload avatar error:', error);
          if (error.response) {
            console.error('Error response:', error.response.data);
          }
          Alert.alert('Lỗi', error.message || 'Không thể cập nhật ảnh nhóm');
        } finally {
          setLoading(false);
        }
      }
    } catch (error) {
      console.error('Pick image error:', error);
      Alert.alert('Lỗi', 'Không thể chọn ảnh');
    }
  };

  const handleUpdateGroupName = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('Lỗi', 'Tên nhóm không được để trống');
      return;
    }

    setIsEditingName(true);
    try {
      await updateGroupName(groupId, newGroupName.trim());
      await fetchGroupInfo(); // Refresh group info
      setShowEditNameModal(false);
      Alert.alert('Thành công', 'Đã cập nhật tên nhóm');
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể cập nhật tên nhóm');
    } finally {
      setIsEditingName(false);
    }
  };

  const renderMemberItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.memberItem}
      onPress={() => setSelectedMember(item)}
    >
      <Image 
        source={{ 
          uri: item.avatar || 'https://users-zalolite.s3.ap-southeast-1.amazonaws.com/avatars/default-avatar.jpg'
        }}
        style={styles.memberAvatar}
      />
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.name || 'Thành viên'}</Text>
        <Text style={styles.memberRole}>{item.role === 'ADMIN' ? 'Trưởng nhóm' : 'Thành viên'}</Text>
      </View>
      {showTransferAdminModal && item.userId !== user.userId && (
        <View style={styles.radioButton}>
          <View style={[
            styles.radioCircle,
            selectedMember?.userId === item.userId && styles.radioCircleSelected
          ]} />
        </View>
      )}
    </TouchableOpacity>
  );

  const renderMembersModal = () => (
    <Modal
      visible={showMembersModal}
      animationType="slide"
      onRequestClose={() => setShowMembersModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowMembersModal(false)}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Thành viên nhóm</Text>
          <View style={{ width: 24 }} />
        </View>
        <FlatList
          data={members}
          renderItem={renderMemberItem}
          keyExtractor={item => item.userId}
          contentContainerStyle={styles.membersList}
        />
      </SafeAreaView>
    </Modal>
  );

  const renderTransferAdminModal = () => (
    <Modal
      visible={showTransferAdminModal}
      animationType="slide"
      onRequestClose={() => setShowTransferAdminModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowTransferAdminModal(false)}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Chọn trưởng nhóm mới</Text>
          <TouchableOpacity 
            onPress={handleTransferAdmin}
            disabled={!selectedMember || loading}
          >
            <Text style={[
              styles.confirmText,
              (!selectedMember || loading) && styles.confirmTextDisabled
            ]}>
              {loading ? 'Đang xử lý...' : 'Xong'}
    </Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={members.filter(m => m.userId !== user.userId)}
          renderItem={renderMemberItem}
          keyExtractor={item => item.userId}
          contentContainerStyle={styles.membersList}
        />
      </SafeAreaView>
    </Modal>
  );

  const renderConfirmationModal = (visible, title, message, onCancel, onConfirm, confirmText, type = 'normal') => (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalMessage}>{message}</Text>
          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.cancelButton]}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalButton, styles.confirmButton]}
              onPress={onConfirm}
              disabled={loading}

            >
              {loading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.confirmButtonText}>{confirmText}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderSuccessModal = () => (
    <Modal
      visible={showSuccessModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {
        setShowSuccessModal(false);
        navigation.navigate('ChatTab', {
          screen: 'Chat'
        });
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Thành công</Text>
          <Text style={styles.modalMessage}>Nhóm đã được giải tán thành công</Text>
          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.confirmButton]}
              onPress={() => {
                setShowSuccessModal(false);
                navigation.navigate('ChatTab', {
                  screen: 'Chat'
                });
              }}
            >
              <Text style={styles.confirmButtonText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderEditNameModal = () => (
    <Modal
      visible={showEditNameModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowEditNameModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Đổi tên nhóm</Text>
          <TextInput
            style={styles.input}
            value={newGroupName}
            onChangeText={setNewGroupName}
            placeholder="Nhập tên nhóm mới"
            maxLength={50}
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowEditNameModal(false)}
              disabled={isEditingName}
            >
              <Text style={styles.cancelButtonText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalButton, styles.confirmButton]}
              onPress={handleUpdateGroupName}
              disabled={isEditingName}
            >
              {isEditingName ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.confirmButtonText}>Lưu</Text>

              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0091FF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tùy chọn</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Group Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              {groupInfo?.avatar ? (
                <Image 
                  source={{ uri: groupInfo.avatar }}
                  style={styles.avatarImage}
                />
              ) : (
                <Ionicons name="people" size={40} color="#ccc" />
              )}
            </View>
            <TouchableOpacity 
              style={styles.cameraButton}
              onPress={handlePickImage}
              disabled={loading}
            >
              <Ionicons name="camera" size={20} color="#666" />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            style={styles.groupNameContainer}
            onPress={() => {
              setNewGroupName(groupInfo?.name || '');
              setShowEditNameModal(true);
            }}
          >
            <Text style={styles.groupNameText}>
              {groupInfo?.name || 'Đặt tên nhóm'}
            </Text>
            <Ionicons name="pencil" size={16} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity style={styles.actionButton}>
            <View style={styles.actionIconContainer}>
              <Ionicons name="search" size={24} color="#666" />
            </View>
            <Text style={styles.actionText}>Tìm{'\n'}tin nhắn</Text>
          </TouchableOpacity>

         
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('GroupAddMembers', { groupId })}
            >
            <View style={styles.actionIconContainer}>
                <Ionicons name="person-add" size={24} color="#666" />
            </View>
            <Text style={styles.actionText}>Thêm{'\n'}thành viên</Text>
          </TouchableOpacity>


          <TouchableOpacity style={styles.actionButton}>
            <View style={styles.actionIconContainer}>
              <Ionicons name="notifications" size={24} color="#666" />
            </View>
            <Text style={styles.actionText}>Tắt{'\n'}thông báo</Text>
          </TouchableOpacity>
        </View>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="link" size={24} color="#666" style={styles.menuIcon} />
            <View style={styles.menuContent}>
              <Text style={styles.menuText}>Link nhóm</Text>
              <Text style={styles.menuSubText}>https://zalo.me/g/dcjntb992</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="images-outline" size={24} color="#666" style={styles.menuIcon} />
            <View style={styles.menuContent}>
            <Text style={styles.menuText}>Ảnh, file, link</Text>
              <View style={styles.mediaPreview}>
                <Text style={styles.mediaPreviewText}>
                Hình mới nhất của trò chuyện sẽ xuất hiện tại đây
              </Text>
            </View>
          </View>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="calendar-outline" size={24} color="#666" style={styles.menuIcon} />
            <Text style={styles.menuText}>Lịch nhóm</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="bookmark-outline" size={24} color="#666" style={styles.menuIcon} />
            <Text style={styles.menuText}>Tin nhắn đã ghim</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="bar-chart-outline" size={24} color="#666" style={styles.menuIcon} />
            <Text style={styles.menuText}>Bình chọn</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="settings-outline" size={24} color="#666" style={styles.menuIcon} />
            <View style={styles.menuContent}>
            <Text style={styles.menuText}>Cài đặt nhóm</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => setShowMembersModal(true)}
          >
            <Ionicons name="people-outline" size={24} color="#666" style={styles.menuIcon} />
            <Text style={styles.menuText}>Xem thành viên</Text>
          </TouchableOpacity>

          {isAdmin && (
            <>
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => setShowTransferAdminModal(true)}
              >
                <Ionicons name="person-outline" size={24} color="#666" style={styles.menuIcon} />
                <Text style={styles.menuText}>Chuyển quyền trưởng nhóm</Text>
              </TouchableOpacity>
            </>
          )}

        </View>

        {/* Danger Zone */}
        <View style={styles.dangerZone}>
          <TouchableOpacity 
            style={[styles.menuItem, styles.dangerItem]}
            onPress={() => setShowLeaveGroupModal(true)}
            disabled={loading}
          >
            <Ionicons name="exit-outline" size={24} color="#ff3b30" style={styles.menuIcon} />
            <Text style={[styles.menuText, styles.dangerText]}>
              {loading ? 'Đang xử lý...' : 'Rời nhóm'}
            </Text>
          </TouchableOpacity>

          {isAdmin && (
            <TouchableOpacity 
              style={[styles.menuItem, styles.dangerItem]}
              onPress={() => setShowDissolveGroupModal(true)}
              disabled={loading}
            >
              <Ionicons name="trash-outline" size={24} color="#ff3b30" style={styles.menuIcon} />
              <Text style={[styles.menuText, styles.dangerText]}>
                {loading ? 'Đang xử lý...' : 'Giải tán nhóm'}
              </Text>
            </TouchableOpacity>
          )}

        </View>
      </ScrollView>

      {/* Modals */}
      {renderMembersModal()}
      {renderTransferAdminModal()}
      {renderConfirmationModal(
        showLeaveGroupModal,
        'Rời nhóm',
        'Bạn có chắc chắn muốn rời khỏi nhóm này không?',
        () => setShowLeaveGroupModal(false),
        handleLeaveGroup,
        'Rời nhóm'
      )}
      {renderConfirmationModal(
        showDissolveGroupModal,
        'Giải tán nhóm',
        'Bạn có chắc chắn muốn giải tán nhóm này không? Hành động này không thể phục hồi.',
        () => setShowDissolveGroupModal(false),
        handleDissolveGroup,
        'Giải tán',
        'danger'
      )}
      {renderSuccessModal()}
      {renderEditNameModal()}
      {/* Transfer Success Modal */}
      {showTransferSuccess && (
        <Modal
          visible={showTransferSuccess}
          transparent={true}
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={50} color="#00C851" />
              </View>
              <Text style={styles.modalTitle}>Đã chuyển quyền trưởng nhóm thành công</Text>
              <Text style={styles.modalMessage}>Bạn sẽ trở thành thành viên thông thường</Text>
            </View>
          </View>
        </Modal>
      )}
      {/* Leave Success Modal */}
      {showLeaveSuccess && (
        <Modal
          visible={showLeaveSuccess}
          transparent={true}
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={50} color="#00C851" />
              </View>
              <Text style={styles.modalTitle}>Đã rời khỏi nhóm thành công</Text>
              <Text style={styles.modalMessage}>Bạn sẽ được chuyển về trang chủ...</Text>
            </View>
      </View>
        </Modal>
      )}
      {/* Dissolve Success Modal */}
      {showDissolveSuccess && (
        <Modal
          visible={showDissolveSuccess}
          transparent={true}
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={50} color="#00C851" />
              </View>
              <Text style={styles.modalTitle}>Đã giải tán nhóm thành công</Text>
              <Text style={styles.modalMessage}>Bạn sẽ được chuyển về trang chủ...</Text>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0091FF',
    paddingVertical: 15,
    paddingHorizontal: 15,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
    marginLeft: 10,
  },
  scrollView: {
    flex: 1,
  },
  profileSection: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 10,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#fff',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  groupNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupNameText: {
    fontSize: 18,
    color: '#666',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 15,
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  actionButton: {
    alignItems: 'center',
    width: '25%',
  },
  actionIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  actionText: {
    fontSize: 12,
    textAlign: 'center',
    color: '#666',
  },
  menuContainer: {
    backgroundColor: '#fff',
    marginTop: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  menuIcon: {
    marginRight: 15,
    width: 24,
  },
  menuContent: {
    flex: 1,
  },
  menuText: {
    fontSize: 16,
    color: '#333',
  },
  menuSubText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  mediaPreview: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  mediaPreviewText: {
    color: '#999',
    textAlign: 'center',
    fontSize: 14,
  },
  dangerItem: {
    borderBottomWidth: 0,
  },
  dangerText: {
    color: '#ff3b30',
  },
  bottomNavBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    height: 50,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonIcon: {
    width: 20,
    height: 20,
    backgroundColor: '#ddd',
  },
  dangerZone: {
    marginTop: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    marginTop: 10,
    paddingTop: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    marginHorizontal: 5,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: '#f2f2f2',
  },
  confirmButton: {
    backgroundColor: '#ff3b30',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  confirmText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  confirmTextDisabled: {
    opacity: 0.5,
  },
  membersList: {
    padding: 15,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  memberAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  memberRole: {
    fontSize: 14,
    color: '#666',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  radioCircleSelected: {
    backgroundColor: COLORS.primary,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
  },
  successIcon: {
    alignItems: 'center',
    marginBottom: 15,
  },
});

export default GroupSettingsScreen;