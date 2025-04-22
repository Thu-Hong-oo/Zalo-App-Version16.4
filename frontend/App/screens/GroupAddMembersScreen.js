import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  TextInput,
  Image,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getFriendsList, getRecentContacts, addGroupMember, getGroupMembers, searchUserByPhone } from '../modules/group/controller';
import { socketService } from '../services/socketService';

const AddMembersScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { groupId } = route.params;

  const [activeTab, setActiveTab] = useState('recent');
  const [loading, setLoading] = useState(false);
  const [recentChats, setRecentChats] = useState([]);
  const [friends, setFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    loadContacts();
    loadGroupMembers();
    setupSocketListeners();

    return () => {
      cleanupSocketListeners();
    };
  }, [activeTab]);

  const setupSocketListeners = () => {
    socketService.addListener('group:memberAdded', handleMemberAdded);
    socketService.addListener('group:memberRemoved', handleMemberRemoved);
    socketService.joinGroup(groupId);
  };

  const cleanupSocketListeners = () => {
    socketService.removeListener('group:memberAdded', handleMemberAdded);
    socketService.removeListener('group:memberRemoved', handleMemberRemoved);
    socketService.leaveGroup(groupId);
  };

  const handleMemberAdded = (data) => {
    if (data.groupId === groupId) {
      setGroupMembers(prev => [...prev, data.userId]);
    }
  };

  const handleMemberRemoved = (data) => {
    if (data.groupId === groupId) {
      setGroupMembers(prev => prev.filter(id => id !== data.userId));
    }
  };

  const loadGroupMembers = async () => {
    try {
      const members = await getGroupMembers(groupId);
      setGroupMembers(members.map(member => member.userId));
    } catch (error) {
      console.error('Error loading group members:', error);
    }
  };

  const loadContacts = async () => {
    try {
      setLoading(true);
      if (activeTab === 'recent') {
        console.log('Loading recent contacts...');
        const response = await getRecentContacts();
        console.log('Recent contacts response:', response);
        
        const contacts = response?.contacts || response?.data?.contacts || [];
        console.log('Processed contacts:', contacts);
        
        setRecentChats(contacts.map(contact => ({
          userId: contact.userId || contact.id,
          name: contact.name || 'Không có tên',
          avatar: contact.avatar || 'https://via.placeholder.com/50',
          phone: contact.phone || contact.phoneNumber || 'Không có số điện thoại'
        })));
      } else {
        console.log('Loading friends list...');
        const response = await getFriendsList();
        console.log('Friends list response:', response);
        
        const friendsList = response?.data || response || [];
        console.log('Processed friends:', friendsList);
        
        setFriends(friendsList.map(friend => ({
          userId: friend.userId || friend.id,
          name: friend.name || 'Không có tên',
          avatar: friend.avatar || 'https://via.placeholder.com/50',
          phone: friend.phone || friend.phoneNumber || 'Không có số điện thoại'
        })));
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      Alert.alert(
        'Lỗi',
        'Không thể tải danh sách liên hệ. Vui lòng thử lại sau.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query) => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    try {
      const result = await searchUserByPhone(query);
      if (result) {
        setSearchResults([{
          userId: result.userId,
          name: result.name,
          avatar: result.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(result.name),
          phone: query
        }]);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching user by phone:', error);
      setSearchResults([]);
      Alert.alert('Lỗi', 'Không thể tìm thấy người dùng với số điện thoại này');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddMember = async (contact) => {
    if (groupMembers.includes(contact.userId)) {
      Alert.alert('Thông báo', 'Người dùng này đã là thành viên của nhóm');
      return;
    }

    try {
      setLoading(true);
      const response = await addGroupMember(groupId, contact.userId);

      if (response && response.success) {
        setGroupMembers(prev => [...prev, contact.userId]);
        
        socketService.emit('group:memberAdded', {
          groupId,
          userId: contact.userId,
          type: 'ADD_MEMBER'
        });

        Alert.alert('Thành công', 'Đã thêm thành viên vào nhóm');
        
        await loadGroupMembers();
      } else {
        throw new Error(response?.error || 'Không thể thêm thành viên');
      }
    } catch (error) {
      console.error('Error adding member:', error);
      Alert.alert(
        'Lỗi',
        'Không thể thêm thành viên vào nhóm. Vui lòng thử lại sau.'
      );
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = () => {
    if (searchQuery && searchResults.length > 0) {
      return searchResults;
    }
    return activeTab === 'recent' ? recentChats : friends;
  };

  const renderContactItem = ({ item }) => {
    const isExistingMember = groupMembers.includes(item.userId);

    return (
      <View style={styles.contactItem}>
        <Image 
          source={{ 
            uri: item.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(item.name || '?')
          }}
          style={styles.avatar}
          onError={(e) => {
            e.target.source = { uri: 'https://ui-avatars.com/api/?name=' + encodeURIComponent(item.name || '?') };
          }}
        />
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.name || 'Không có tên'}</Text>
          {/* {item.phone && <Text style={styles.contactPhone}>{item.phone}</Text>} */}
        </View>
        {isExistingMember ? (
          <View style={styles.memberBadge}>
            <Text style={styles.memberBadgeText}>Đã là thành viên</Text>
          </View>
        ) : (
          <TouchableOpacity 
            style={[styles.addButton, loading && styles.addButtonDisabled]}
            onPress={() => handleAddMember(item)}
            disabled={loading}
          >
            <Ionicons 
              name="add-circle-outline" 
              size={24} 
              color={loading ? '#ccc' : '#2196F3'} 
            />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.title}>Thêm thành viên</Text>
        </View>
      </View>
      
      <View style={styles.searchWrapper}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Nhập số điện thoại"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
            keyboardType="numeric"
          />
        </View>
        <TouchableOpacity 
          style={[styles.searchButton, isSearching && styles.searchButtonDisabled]}
          onPress={() => handleSearch(searchQuery)}
          disabled={isSearching || !searchQuery.trim()}
        >
          {isSearching ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.searchButtonText}>Tìm</Text>
          )}
        </TouchableOpacity>
      </View>
      
      {!searchQuery && (
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
        <ActivityIndicator style={styles.loader} size="large" color="#2196F3" />
      ) : (
        <FlatList
          data={filteredContacts()}
          renderItem={renderContactItem}
          keyExtractor={item => item.userId}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchQuery 
                  ? 'Không tìm thấy kết quả'
                  : 'Không có liên hệ'}
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#2196F3',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 8,
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 40,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#eee',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  searchButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonDisabled: {
    backgroundColor: '#ccc',
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
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
    borderBottomColor: '#000',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#999',
  },
  activeTabText: {
    color: '#000',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#eee',
  },
  contactInfo: {
    flex: 1,
    marginLeft: 12,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  contactPhone: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  addButton: {
    padding: 8,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  memberBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  memberBadgeText: {
    fontSize: 12,
    color: '#666',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});

export default AddMembersScreen; 