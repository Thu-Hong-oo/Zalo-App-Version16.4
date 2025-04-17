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
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRecentContacts, createGroup } from '../modules/group/controller';

const NewGroupScreen = () => {
  const navigation = useNavigation();
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [activeTab, setActiveTab] = useState('recent');
  const [loading, setLoading] = useState(false);
  const [recentChats, setRecentChats] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupName, setGroupName] = useState('');
  


  useEffect(() => {
    loadRecentChats();
  }, []);
  useEffect(() => {
    navigation.setOptions({
      tabBarVisible: false,
    });
  }, [navigation]);

  const loadRecentChats = async () => {
    try {
      setLoading(true);
      const response = await getRecentContacts();
      
      if (response.status === 'success' && response.data?.contacts) {
        setRecentChats(response.data.contacts);
      }
    } catch (error) {
      console.error('Error loading recent contacts:', error);
      Alert.alert(
        'Lỗi',
        error.message === 'Không tìm thấy token xác thực'
          ? 'Vui lòng đăng nhập lại'
          : 'Không thể tải danh sách liên hệ gần đây'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    console.log('Button pressed - Starting group creation...');
    console.log('Current state:', {
      selectedContacts: selectedContacts.length,
      groupName: groupName.trim(),
      loading
    });

    if (selectedContacts.length < 2) {
      Alert.alert('Thông báo', 'Vui lòng chọn ít nhất 2 thành viên');
      return;
    }

    try {
      setLoading(true);
      const userInfoStr = await AsyncStorage.getItem('userInfo');
      console.log('Retrieved userInfo string:', userInfoStr);
      
      if (!userInfoStr) {
        throw new Error('Vui lòng đăng nhập lại');
      }

      const userData = JSON.parse(userInfoStr);
      console.log('Parsed user data:', userData);

      if (!userData || !userData.userId) {
        throw new Error('Vui lòng đăng nhập lại');
      }

      let finalGroupName = groupName.trim();
      if (!finalGroupName) {
        const memberNames = [userData.name, ...selectedContacts.slice(0, 2).map(c => c.name.split(' ')[0])];
        finalGroupName = memberNames.join(', ');
        console.log('Auto-generated group name:', finalGroupName);
      }

      const groupData = {
        name: finalGroupName,
        members: [...selectedContacts.map(c => c.userId), userData.userId],
        createdBy: userData.userId
      };

      console.log('Sending group creation request with data:', {
        name: groupData.name,
        memberCount: groupData.members.length,
        createdBy: groupData.createdBy,
        members: groupData.members
      });

      const response = await createGroup(groupData);

      console.log('Group creation response:', response);

      if (response.status === 'success' && response.data) {
        console.log('Group created successfully, navigating to GroupChat...');
        navigation.replace('GroupChat', {
          groupId: response.data.groupId,
          groupName: response.data.name || finalGroupName,
          memberCount: response.data.memberCount
        });
      }
    } catch (error) {
      console.error('Error creating group:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      Alert.alert(
        'Lỗi',
        error.message === 'Vui lòng đăng nhập lại'
          ? error.message
          : 'Không thể tạo nhóm. Vui lòng thử lại sau.'
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

  const renderAvatar = (contact) => {
    if (contact.avatar) {
      return (
        <Image 
          source={{ uri: contact.avatar }} 
          style={styles.avatar} 
        />
      );
    } else if (contact.initials) {
      return (
        <View style={[styles.avatar, { backgroundColor: contact.color }]}>
          <Text style={styles.initials}>{contact.initials}</Text>
        </View>
      );
    }
    return <View style={styles.avatar} />;
  };

  const filteredContacts = activeTab === 'recent' 
    ? recentChats.filter(chat => 
        chat.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : []; // TODO: Implement contacts tab

  const renderContactItem = ({ item }) => {
    const isSelected = selectedContacts.some(contact => contact.userId === item.userId);
    
    return (
      <TouchableOpacity 
        style={styles.contactItem}
        onPress={() => toggleContactSelection(item)}
        activeOpacity={0.7}
      >
        <Image 
          source={{ uri: item.avatar || 'https://via.placeholder.com/50' }} 
          style={[styles.avatar, { resizeMode: 'cover' }]}
        />
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.name}</Text>
          <Text style={styles.contactTime}>{item.lastActive}</Text>
        </View>
        <TouchableOpacity 
          style={[styles.checkbox, isSelected && styles.checkboxBorderSelected]}
          onPress={() => toggleContactSelection(item)}
        >
          {isSelected && (
            <View style={styles.checkboxSelected}>
              <Ionicons name="checkmark" size={16} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderSelectedContactsBar = () => {
    if (selectedContacts.length === 0) return null;
    
    return (
      <View style={styles.selectedContactsBar}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.selectedContactsScrollContent}
        >
          {selectedContacts.map(contact => (
            <View key={contact.userId} style={styles.selectedContactItem}>
              <Image 
                source={{ uri: contact.avatar || 'https://via.placeholder.com/50' }}
                style={styles.avatar}
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
            (selectedContacts.length < 2) && styles.nextButtonDisabled,
            pressed && styles.nextButtonPressed
          ]}
          onPress={() => {
            console.log('Create group button pressed');
            if (selectedContacts.length < 2) {
              Alert.alert('Thông báo', 'Vui lòng chọn ít nhất 2 thành viên');
              return;
            }
            handleCreateGroup();
          }}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <View style={styles.nextButtonContent}>
              <Ionicons name="arrow-forward" size={24} color="#fff" />
            </View>
          )}
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
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
      
      {/* Group Name */}
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
      
      {/* Search Bar */}
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
      
      {/* Tabs */}
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
        <ActivityIndicator style={{ flex: 1 }} size="large" color="#2196F3" />
      ) : (
        <FlatList
          data={filteredContacts}
          renderItem={renderContactItem}
          keyExtractor={item => item.userId}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: selectedContacts.length > 0 ? 70 : 0 }}
        />
      )}
      
      {/* Selected Contacts Bar */}
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
                  source={{ uri: contact.avatar || 'https://via.placeholder.com/50' }}
                  style={styles.avatar}
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
              (selectedContacts.length < 2) && styles.nextButtonDisabled,
              pressed && styles.nextButtonPressed
            ]}
            onPress={() => {
              console.log('Create group button pressed');
              if (selectedContacts.length < 2) {
                Alert.alert('Thông báo', 'Vui lòng chọn ít nhất 2 thành viên');
                return;
              }
              handleCreateGroup();
            }}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <View style={styles.nextButtonContent}>
                <Ionicons name="arrow-forward" size={24} color="#fff" />
              </View>
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
  },
  cameraIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eee',
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
    backgroundColor: '#f2f2f2',
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
    paddingVertical: 8,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  initials: {
    fontSize: 20,
    color: 'white',
    fontWeight: 'bold',
  },
  contactInfo: {
    flex: 1,
    marginLeft: 12,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '500',
  },
  contactTime: {
    fontSize: 14,
    color: '#999',
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
  checkboxBorderSelected: {
    borderColor: '#2196F3',
  },
  checkboxSelected: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedContactsBar: {
    position: 'absolute',
    bottom: 56, // Height of bottom nav
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  selectedContactsScrollContent: {
    paddingVertical: 10,
    paddingRight: 60, // Space for the next button
  },
  selectedContactItem: {
    marginHorizontal: 5,
    position: 'relative',
  },
  removeContactButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#fff',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
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
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 1000,
  },
  nextButtonDisabled: {
    backgroundColor: '#B0BEC5',
  },
  nextButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  nextButtonContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default NewGroupScreen;