import React, { useState } from 'react';
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
  Alert
} from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const GroupSettingsScreen = () => {
  const navigation = useNavigation();
  const [showLeaveGroupModal, setShowLeaveGroupModal] = useState(false);
  const [showDissolveGroupModal, setShowDissolveGroupModal] = useState(false);

  const handleLeaveGroup = () => {
    setShowLeaveGroupModal(false);
    // TODO: Implement leave group API call
    navigation.goBack();
  };

  const handleDissolveGroup = () => {
    setShowDissolveGroupModal(false);
    // TODO: Implement dissolve group API call
    navigation.goBack();
  };

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
            >
              <Text style={styles.cancelButtonText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalButton, styles.confirmButton]}
              onPress={onConfirm}
            >
              <Text style={styles.confirmButtonText}>{confirmText}</Text>
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

          <TouchableOpacity style={styles.actionButton}>
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

          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="people-outline" size={24} color="#666" style={styles.menuIcon} />
            <Text style={styles.menuText}>Xem thành viên</Text>
          </TouchableOpacity>


          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="person-outline" size={24} color="#666" style={styles.menuIcon} />
            <Text style={styles.menuText}>Chuyển quyền trưởng nhóm</Text>
          </TouchableOpacity>

    

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
          >
            <Ionicons name="exit-outline" size={24} color="#ff3b30" style={styles.menuIcon} />
            <Text style={[styles.menuText, styles.dangerText]}>Rời nhóm</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, styles.dangerItem]}
            onPress={() => setShowDissolveGroupModal(true)}
          >
            <Ionicons name="close-circle-outline" size={24} color="#ff3b30" style={styles.menuIcon} />
            <Text style={[styles.menuText, styles.dangerText]}>Giải tán nhóm</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Leave Group Modal */}
      {renderConfirmationModal(
        showLeaveGroupModal,
        'Rời nhóm',
        'Bạn có chắc chắn muốn rời khỏi nhóm này không?',
        () => setShowLeaveGroupModal(false),
        handleLeaveGroup,
        'Rời nhóm'
      )}

      {/* Dissolve Group Modal */}
      {renderConfirmationModal(
        showDissolveGroupModal,
        'Giải tán nhóm',
        'Bạn có chắc chắn muốn giải tán nhóm này không? Hành động này không thể phục hồi.',
        () => setShowDissolveGroupModal(false),
        handleDissolveGroup,
        'Giải tán',
        'danger'
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
});

export default GroupSettingsScreen;