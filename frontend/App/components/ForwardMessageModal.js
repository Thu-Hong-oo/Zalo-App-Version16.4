import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getApiUrl } from '../config/api';
import axios from 'axios';
import { getAccessToken } from '../services/storage';
import { AuthContext } from '../App';
import { getRecentContacts, getFriendsList } from '../modules/group/controller';

const ForwardMessageModal = ({ visible, onClose, onForward }) => {
  const { user } = useContext(AuthContext);
  const [searchText, setSearchText] = useState("");
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('recent');

  useEffect(() => {
    const fetchContactsAndGroups = async () => {
      if (!visible || !user?.userId) return;
      
      setLoading(true);
      setError(null);
      try {
        // Fetch contacts based on active tab
        if (activeTab === 'recent') {
          const response = await getRecentContacts();
          console.log('Recent contacts response:', response);
          
          const contacts = response?.contacts || response?.data?.contacts || [];
          console.log('Processed contacts:', contacts);
          
          setContacts(contacts.map(contact => ({
            userId: contact.userId || contact.id,
            name: contact.name || 'Không có tên',
            avatar: contact.avatar || 'https://via.placeholder.com/50',
            phone: contact.phone || contact.phoneNumber || 'Không có số điện thoại'
          })));
        } else {
          const response = await getFriendsList();
          console.log('Friends list response:', response);
          
          const friendsList = response?.data || response || [];
          console.log('Processed friends:', friendsList);
          
          setContacts(friendsList.map(friend => ({
            userId: friend.userId || friend.id,
            name: friend.name || 'Không có tên',
            avatar: friend.avatar || 'https://via.placeholder.com/50',
            phone: friend.phone || friend.phoneNumber || 'Không có số điện thoại'
          })));
        }

        // Fetch groups
        const groupsResponse = await axios.get(`${getApiUrl()}/users/${user.userId}/groups`, {
          headers: {
            Authorization: `Bearer ${await getAccessToken()}`
          }
        });

        if (groupsResponse.data && groupsResponse.data.groups) {
          const transformedGroups = groupsResponse.data.groups.map(group => ({
            groupId: group.groupId,
            name: group.name,
            avatar: group.avatar,
            memberCount: group.memberCount,
            members: group.members || []
          }));
          setGroups(transformedGroups);
        } else {
          console.warn('Groups response format unexpected:', groupsResponse.data);
          setGroups([]);
        }
      } catch (error) {
        console.error("Error fetching contacts and groups:", error);
        setError(error);
        Alert.alert(
          "Lỗi",
          error.response?.data?.message || "Không thể tải danh sách liên hệ và nhóm. Vui lòng thử lại sau."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchContactsAndGroups();
  }, [visible, user?.userId, activeTab]);

  const filteredContacts = contacts.filter(contact => 
    contact.name?.toLowerCase().includes(searchText.toLowerCase()) ||
    contact.phone?.includes(searchText)
  );

  const filteredGroups = groups.filter(group => 
    group.name?.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleSelect = (item) => {
    setSelectedContacts(prev => {
      const exists = prev.some(contact => 
        contact.userId === item.userId || contact.groupId === item.groupId
      );
      if (exists) {
        return prev.filter(contact => 
          contact.userId !== item.userId && contact.groupId !== item.groupId
        );
      }
      return [...prev, item];
    });
  };

  const handleForward = () => {
    const receivers = selectedContacts.map(contact => ({
      id: contact.userId ? contact.phone : contact.groupId,
      type: contact.userId ? 'conversation' : 'group'
    }));
    onForward(receivers);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Chuyển tiếp tin nhắn</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm liên hệ hoặc nhóm..."
            value={searchText}
            onChangeText={setSearchText}
          />

          {!searchText && (
            <View style={styles.tabContainer}>
              <TouchableOpacity 
                style={[styles.tab, activeTab === 'recent' && styles.activeTab]}
                onPress={() => setActiveTab('recent')}
              >
                <Text style={[styles.tabText, activeTab === 'recent' && styles.activeTabText]}>
                  GẦN ĐÂY
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tab, activeTab === 'contacts' && styles.activeTab]}
                onPress={() => setActiveTab('contacts')}
              >
                <Text style={[styles.tabText, activeTab === 'contacts' && styles.activeTabText]}>
                  DANH BẠ
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {loading ? (
            <ActivityIndicator size="large" color="#2196F3" />
          ) : (
            <ScrollView style={styles.listContainer}>
              {filteredContacts.length > 0 && (
                <View>
                  <Text style={styles.sectionTitle}>Liên hệ</Text>
                  {filteredContacts.map(contact => (
                    <TouchableOpacity
                      key={contact.userId}
                      style={styles.itemContainer}
                      onPress={() => handleSelect(contact)}
                    >
                      <Image
                        source={{ uri: contact.avatar || "https://via.placeholder.com/50" }}
                        style={styles.avatar}
                      />
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{contact.name}</Text>
                        <Text style={styles.itemSubtitle}>{contact.phone}</Text>
                      </View>
                      {selectedContacts.some(c => c.userId === contact.userId) && (
                        <Ionicons name="checkmark-circle" size={24} color="#2196F3" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {filteredGroups.length > 0 && (
                <View>
                  <Text style={styles.sectionTitle}>Nhóm</Text>
                  {filteredGroups.map(group => (
                    <TouchableOpacity
                      key={group.groupId}
                      style={styles.itemContainer}
                      onPress={() => handleSelect(group)}
                    >
                      <Image
                        source={{ uri: group.avatar || "https://via.placeholder.com/50" }}
                        style={styles.avatar}
                      />
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{group.name}</Text>
                        <Text style={styles.itemSubtitle}>{group.memberCount} thành viên</Text>
                      </View>
                      {selectedContacts.some(g => g.groupId === group.groupId) && (
                        <Ionicons name="checkmark-circle" size={24} color="#2196F3" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {filteredContacts.length === 0 && filteredGroups.length === 0 && (
                <View style={styles.centerContent}>
                  <Text style={styles.emptyText}>Không tìm thấy kết quả phù hợp</Text>
                </View>
              )}
            </ScrollView>
          )}

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
            >
              <Text style={styles.buttonText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.forwardButton, selectedContacts.length === 0 && styles.disabledButton]}
              onPress={handleForward}
              disabled={selectedContacts.length === 0}
            >
              <Text style={styles.buttonText}>
                Chuyển tiếp ({selectedContacts.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  searchInput: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#999',
  },
  activeTabText: {
    color: '#2196F3',
  },
  listContainer: {
    maxHeight: 400,
  },
  sectionTitle: {
    padding: 10,
    backgroundColor: '#f5f5f5',
    fontWeight: 'bold',
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  itemInfo: {
    flex: 1,
    marginLeft: 10,
  },
  itemName: {
    fontSize: 16,
  },
  itemSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  button: {
    padding: 10,
    borderRadius: 5,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#ccc',
  },
  forwardButton: {
    backgroundColor: '#2196F3',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
  },
});

export default ForwardMessageModal; 