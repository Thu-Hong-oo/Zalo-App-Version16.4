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
  ScrollView,
  Alert,
  ActivityIndicator,
  Pressable
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRecentContacts, createGroup } from '../modules/group/controller';

const NewGroupScreen = () => {
  const navigation = useNavigation();
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [activeTab, setActiveTab] = useState('recent');
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupName, setGroupName] = useState('');

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const response = await getRecentContacts();
      console.log('Recent contacts response:', response);
      
      if (response?.contacts) {
        const formattedContacts = response.contacts.map(contact => ({
          userId: contact.userId,
          name: contact.name,
          avatar: contact.avatar || 'https://via.placeholder.com/50',
          lastActive: contact.lastActive || 'Hoạt động gần đây'
        }));
        setContacts(formattedContacts);
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
      Alert.alert('Lỗi', 'Không thể tải danh sách liên hệ');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (selectedContacts.length < 2) {
      Alert.alert('Thông báo', 'Vui lòng chọn ít nhất 2 thành viên');
      return;
    }

    try {
      setLoading(true);
      const userInfoStr = await AsyncStorage.getItem('userInfo');
      
      if (!userInfoStr) {
        throw new Error('Vui lòng đăng nhập lại');
      }

      const userData = JSON.parse(userInfoStr);
      
      if (!userData || !userData.userId) {
        throw new Error('Vui lòng đăng nhập lại');
      }

      let finalGroupName = groupName.trim();
      if (!finalGroupName) {
        const memberNames = selectedContacts.map(c => c.name.split(' ')[0]).slice(0, 3);
        finalGroupName = memberNames.join(', ');
      }

      const groupData = {
        name: finalGroupName,
        members: selectedContacts.map(c => c.userId),
        createdBy: userData.userId
      };

      console.log('Creating group with data:', groupData);
      const response = await createGroup(groupData);

      if (response && response.groupId) {
        navigation.goBack();
      } else {
        throw new Error('Không nhận được thông tin nhóm từ server');
      }
    } catch (error) {
      console.error('Error creating group:', error);
      Alert.alert(
        'Lỗi',
        error.message || 'Không thể tạo nhóm. Vui lòng thử lại sau.'
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleContactSelection = (contact) => {
    if (selectedContacts.some(c => c.userId === contact.userId)) {
      setSelectedContacts(selectedContacts.filter(c => c.userId !== contact.userId));
    } else {
      setSelectedContacts([...selectedContacts, contact]);
    }
  };

  const removeSelectedContact = (contactId) => {
    setSelectedContacts(selectedContacts.filter(contact => contact.userId !== contactId));
  };

  const filteredContacts = contacts.filter(contact => 
    !searchQuery || 
    contact.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderContactItem = ({ item }) => {
    const isSelected = selectedContacts.some(contact => contact.userId === item.userId);
    
    return (
      <TouchableOpacity 
        style={styles.contactItem}
        onPress={() => toggleContactSelection(item)}
        activeOpacity={0.7}
      >
        <Image 
          source={{ uri: item.avatar }} 
          style={styles.avatar}
        />
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.name}</Text>
          <Text style={styles.contactTime}>{item.lastActive}</Text>
        </View>
        <TouchableOpacity 
          style={[styles.checkbox, isSelected && styles.checkboxSelected]}
          onPress={() => toggleContactSelection(item)}
        >
          {isSelected && (
            <Ionicons name="checkmark" size={16} color="#fff" />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
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
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.title}>Nhóm mới</Text>
          <Text style={styles.subtitle}>Đã chọn: {selectedContacts.length}</Text>
        </View>
      </View>

      <View style={styles.groupNameContainer}>
        <View style={styles.cameraIcon}>
          <Ionicons name="camera-outline" size={24} color="#666" />
        </View>
        <TextInput
          style={styles.groupNameInput}
          placeholder="Đặt tên nhóm"
          value={groupName}
          onChangeText={setGroupName}
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm tên hoặc số điện thoại"
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
      </View>

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

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#2196F3" />
      ) : (
        <FlatList
          data={filteredContacts}
          renderItem={renderContactItem}
          keyExtractor={item => item.userId}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchQuery ? 'Không tìm thấy kết quả' : 'Không có liên hệ'}
              </Text>
            </View>
          )}
        />
      )}

      {selectedContacts.length > 0 && (
        <View style={styles.selectedContactsBar}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.selectedContactsScrollContent}
          >
            {selectedContacts.map(contact => (
              <View key={contact.userId} style={styles.selectedContactItem}>
                <Image 
                  source={{ uri: contact.avatar }} 
                  style={styles.selectedAvatar}
                />
                <TouchableOpacity 
                  style={styles.removeContactButton}
                  onPress={() => removeSelectedContact(contact.userId)}
                >
                  <Ionicons name="close" size={14} color="#000" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          
          <Pressable 
            style={({ pressed }) => [
              styles.nextButton,
              selectedContacts.length < 2 && styles.nextButtonDisabled,
              pressed && styles.nextButtonPressed
            ]}
            onPress={handleCreateGroup}
            disabled={loading || selectedContacts.length < 2}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="arrow-forward" size={24} color="#fff" />
            )}
          </Pressable>
        </View>
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
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  groupNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  cameraIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupNameInput: {
    flex: 1,
    marginLeft: 16,
    fontSize: 16,
    color: '#333',
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
  selectedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  contactTime: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  selectedContactsBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  selectedContactsScrollContent: {
    paddingVertical: 10,
    paddingRight: 60,
  },
  selectedContactItem: {
    marginRight: 12,
    position: 'relative',
  },
  removeContactButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButton: {
    position: 'absolute',
    right: 16,
    bottom: 13,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#ccc',
  },
  nextButtonPressed: {
    opacity: 0.8,
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

export default NewGroupScreen;