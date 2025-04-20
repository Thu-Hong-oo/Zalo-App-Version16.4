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
  }, [activeTab]);

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
    setSearchQuery(query);
    
    if (query.length >= 10 && /^\d+$/.test(query)) { // Kiểm tra nếu là số điện thoại
      setIsSearching(true);
      try {
        const result = await searchUserByPhone(query);
        if (result) {
          setSearchResults([{
            userId: result.userId,
            name: result.name,
            avatar: result.avatar || 'https://via.placeholder.com/50',
            phone: query
          }]);
        } else {
          setSearchResults([]);
        }
      } catch (error) {
        console.error('Error searching user:', error);
        setSearchResults([]);
      }
      setIsSearching(false);
    } else {
      setSearchResults([]);
    }
  };

  const handleAddMember = async (contact) => {
    if (groupMembers.includes(contact.userId)) {
      Alert.alert('Thông báo', 'Người dùng này đã là thành viên của nhóm');
      return;
    }

    try {
      setLoading(true);
      await addGroupMember(groupId, contact.userId);
      Alert.alert('Thành công', 'Đã thêm thành viên vào nhóm');
      await loadGroupMembers(); // Reload group members
    
    } catch (error) {
      console.error('Error adding member:', error);
      Alert.alert('Lỗi', 'Không thể thêm thành viên vào nhóm');
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = () => {
    if (searchQuery.length >= 10 && /^\d+$/.test(searchQuery)) {
      return searchResults;
    }

    const contacts = activeTab === 'recent' ? recentChats : friends;
    if (!searchQuery) return contacts;

    return contacts.filter(contact => 
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (contact.phone && contact.phone.includes(searchQuery))
    );
  };

  const renderContactItem = ({ item }) => {
    const isExistingMember = groupMembers.includes(item.userId);

    return (
      <View style={styles.contactItem}>
        <Image 
          source={{ uri: item.avatar || 'https://via.placeholder.com/50' }}
          style={styles.avatar}
        />
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.name || 'Không có tên'}</Text>

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
      
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm tên hoặc số điện thoại"
          value={searchQuery}
          onChangeText={handleSearch}
          placeholderTextColor="#999"
          keyboardType="default"
        />
        {isSearching && <ActivityIndicator size="small" color="#2196F3" />}
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
              BẠN BÈ
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
                  ? isSearching 
                    ? 'Đang tìm kiếm...'
                    : 'Không tìm thấy kết quả' 
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 8,
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