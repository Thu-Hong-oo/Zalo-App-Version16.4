import React, { useState, useEffect, useContext } from 'react';
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
  FlatList
} from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { 
  leaveGroup, 
  dissolveGroup, 
  getGroupInfo, 
  getGroupMembers,
  updateMemberRole,
  addGroupMember,
  removeGroupMember
} from '../modules/group/controller';
import { AuthContext } from '../App';
import COLORS from '../components/colors';

const GroupSettingsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { groupId } = route.params;
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

  // Fetch group info and members
  useEffect(() => {
    fetchGroupInfo();
  }, [groupId]);

  const fetchGroupInfo = async () => {
    try {
      const info = await getGroupInfo(groupId);
      setGroupInfo(info);
      // Update members list from group info
      setMembers(info.members);
      // Check if current user is admin
      const currentMember = info.members.find(m => m.userId === user.userId);
      setIsAdmin(currentMember?.role === 'ADMIN');
    } catch (error) {
      console.error('Error fetching group info:', error);
      Alert.alert('Lỗi', 'Không thể tải thông tin nhóm');
    }
  };

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
      
      // Sau khi chuyển quyền thành công, rời nhóm
      await leaveGroup(groupId, user.userId);
      
      setShowTransferAdminModal(false);
      
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
    } catch (error) {
      console.error('Transfer admin error:', error);
      Alert.alert('Lỗi', 'Không thể chuyển quyền trưởng nhóm');
    } finally {
      setLoading(false);
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

      await leaveGroup(groupId, user.userId);
      setShowLeaveGroupModal(false);
      
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
      const response = await dissolveGroup(groupId);
      if (response) {
        setShowDissolveGroupModal(false);
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
      }
    } catch (error) {
      console.error('Error dissolving group:', error);
      setShowDissolveGroupModal(false);
      Alert.alert('Lỗi', 'Không thể giải tán nhóm');
    } finally {
      setLoading(false);
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
              <Ionicons name="people" size={40} color="#ccc" />
            </View>
            <TouchableOpacity style={styles.cameraButton}>
              <Ionicons name="camera" size={20} color="#666" />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity style={styles.groupNameContainer}>
            <Text style={styles.groupNameText}>Đặt tên nhóm</Text>
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

          {isAdmin && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('GroupAddMembers', { groupId })}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="person-add" size={24} color="#666" />
              </View>
              <Text style={styles.actionText}>Thêm{'\n'}thành viên</Text>
            </TouchableOpacity>
          )}

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
          {groupInfo && groupInfo.createdBy === user.userId && (
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => setShowTransferAdminModal(true)}
          >
            <Ionicons name="person-outline" size={24} color="#666" style={styles.menuIcon} />
            <Text style={styles.menuText}>Chuyển quyền trưởng nhóm</Text>
          </TouchableOpacity>
  )}
          <TouchableOpacity style={[styles.menuItem, styles.dangerItem]}>
            <Ionicons name="trash-outline" size={24} color="#ff3b30" style={styles.menuIcon} />
            <Text style={[styles.menuText, styles.dangerText]}>Xóa lịch sử trò chuyện</Text>
          </TouchableOpacity>
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

          {groupInfo && groupInfo.createdBy === user.userId && (
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
});

export default GroupSettingsScreen;