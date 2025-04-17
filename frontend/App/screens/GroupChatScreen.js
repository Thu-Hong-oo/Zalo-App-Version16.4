import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator
} from 'react-native';
import { Ionicons, FontAwesome, MaterialIcons, Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getGroupInfo } from '../modules/group/controller'; // Import hàm gọi API

const GroupChatScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { groupId, groupName: initialGroupName, memberCount: initialMemberCount } = route.params;

  const [message, setMessage] = useState('');
  const scrollViewRef = useRef();
  const [groupDetails, setGroupDetails] = useState(null); // State lưu chi tiết nhóm
  const [loading, setLoading] = useState(true); // State loading
  const [error, setError] = useState(null); // State lỗi
  
  useEffect(() => {
    const fetchGroupDetails = async () => {
      if (!groupId) {
        setError('Không tìm thấy ID nhóm.');
        setLoading(false);
        return;
      }
      
      console.log(`Fetching details for groupId: ${groupId}`);
      setLoading(true);
      setError(null);
      try {
        const response = await getGroupInfo(groupId);
        console.log('Fetched group details:', response);
        if (response && response.groupId) { 
          setGroupDetails(response); // Lấy trực tiếp từ response
        } else {
          throw new Error('Dữ liệu nhóm không hợp lệ từ API');
        }
      } catch (err) {
        console.error('Error fetching group details:', err);
        setError(err.message || 'Không thể tải thông tin nhóm.');
      } finally {
        setLoading(false);
      }
    };

    fetchGroupDetails();
  }, [groupId]); // Chạy lại khi groupId thay đổi

  // Tạo tin nhắn hệ thống dựa trên dữ liệu nhóm
  const createSystemMessage = (details) => {
    if (!details || !details.members || details.members.length === 0) return null;
    
    const creator = details.members.find(m => m.userId === details.createdBy);
    const creatorName = creator?.name || 'Người tạo';
    
    // Lấy tên của tối đa 2 thành viên khác (không phải người tạo)
    const otherMemberNames = details.members
      .filter(m => m.userId !== details.createdBy)
      .slice(0, 2)
      .map(m => m.name || 'Thành viên');
      
    let displayText = creatorName;
    if (otherMemberNames.length > 0) {
      displayText += `, ${otherMemberNames.join(', ')}`;
    }
    
    // Lấy avatar của những người được hiển thị tên
    const displayUserIds = [creator?.userId, ...details.members.filter(m => m.userId !== details.createdBy).slice(0, 2).map(m => m.userId)].filter(Boolean);
    const memberAvatars = details.members
                          .filter(m => displayUserIds.includes(m.userId))
                          .map(m => m.avatar || 'https://via.placeholder.com/50');

    return {
      id: 'system-' + details.groupId,
      type: 'system',
      // Hiển thị tên người tạo và các thành viên khác
      text: `${displayText} đã tham gia nhóm`,
      memberNames: displayText, // Lưu lại để tham khảo nếu cần
      memberAvatars: memberAvatars,
      timestamp: new Date(details.createdAt),
    };
  };

  const systemMessage = createSystemMessage(groupDetails);
  const messages = systemMessage ? [systemMessage] : []; // Chỉ hiển thị tin nhắn hệ thống nếu có

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return `${date.getHours()}:${date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes()} Hôm nay`;
  };

  const sendMessage = () => {
    if (message.trim() === '') return;
    console.log('Sending message:', message);
    // Logic gửi tin nhắn sẽ thêm sau
    setMessage('');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.containerCentered}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text>Đang tải thông tin nhóm...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.containerCentered}>
        <Text style={{ color: 'red' }}>Lỗi: {error}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: 'blue', marginTop: 10 }}>Quay lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  
  if (!groupDetails) {
     return (
      <SafeAreaView style={styles.containerCentered}>
        <Text>Không tìm thấy thông tin nhóm.</Text>
         <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: 'blue', marginTop: 10 }}>Quay lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // --- Render UI với groupDetails --- 

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.headerTitle}>
          <Text style={styles.title} numberOfLines={1}>
            {groupDetails.name} {/* Sử dụng tên từ API */}
          </Text>
          <Text style={styles.subtitle}>
            {groupDetails.members ? groupDetails.members.length : initialMemberCount} thành viên {/* Sử dụng số lượng từ API nếu có */}
          </Text>
        </View>
        
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="videocam" size={24} color="#fff" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="search" size={24} color="#fff" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="menu" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      
      {/* Chat Messages */}
      <ScrollView 
        style={styles.messagesContainer}
        ref={scrollViewRef}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {/* Group Info Card */}
        <View style={styles.groupInfoCard}>
          <View style={styles.groupAvatars}>
            {/* Hiển thị avatar thành viên 1 (nếu có) */}
            {groupDetails.members && groupDetails.members.length > 0 && (
              <Image 
                key={`info-avatar-${groupDetails.members[0].userId}-main`}
                source={{ uri: groupDetails.members[0].avatar || 'https://via.placeholder.com/50' }} 
                style={styles.groupMainAvatar} 
              />
            )}
            {/* Hiển thị avatar thành viên 2 (nếu có) */}
            {groupDetails.members && groupDetails.members.length > 1 && (
              <Image 
                key={`info-avatar-${groupDetails.members[1].userId}-secondary`}
                source={{ uri: groupDetails.members[1].avatar || 'https://via.placeholder.com/50' }} 
                style={styles.groupSecondaryAvatar} 
              />
            )}
            {/* Avatar nhỏ của nhóm (nếu có), nếu không dùng icon mặc định */}
            <Image 
              key={`info-avatar-group-${groupDetails.groupId}`}
              source={{ uri: groupDetails.avatar || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }} 
              style={styles.groupSmallAvatar} 
            />
          </View>
          
          <Text style={styles.groupCardTitle}>
            {groupDetails.name}
          </Text>
          
          <Text style={styles.groupCardSubtitle}>
            Bắt đầu chia sẻ những câu chuyện thú vị cùng nhau
          </Text>
        </View>
        
        {/* Time Indicator */}
        <View style={styles.timeIndicator}>
          <Text style={styles.timeText}>
            {formatTime(groupDetails.createdAt)}
          </Text>
        </View>
        
        {/* System Message */}
        {messages.map(msg => (
           <View key={msg.id} style={styles.systemMessageContainer}>
             <View style={styles.systemMessageAvatars}>
               {/* Hiển thị avatar của các thành viên trong tin nhắn hệ thống */}
               {msg.memberAvatars.map((avatarUri, index) => (
                 <Image 
                   key={`sys-avatar-${index}`}
                   source={{ uri: avatarUri }}
                   style={styles.systemMessageAvatar}
                 />
               ))}
             </View>
             <Text style={styles.systemMessageText}>
                {/* Hiển thị tên các thành viên trong tin nhắn */}
               <Text style={{fontWeight: 'bold'}}>{msg.memberNames}</Text> 
               {` đã tham gia nhóm`}
             </Text>
           </View>
        ))}
        
        {/* Group Setup Card */}
        <View style={styles.setupCard}>
           <TouchableOpacity style={styles.setupAvatarContainer}>
            <View style={styles.setupAvatar}>
               {/* Có thể thay icon camera bằng avatar nhóm nếu có */}
              <Ionicons name="camera-outline" size={28} color="#aaa" /> 
            </View>
            <Text style={styles.setupTitle}>{groupDetails.name}</Text>
            <Ionicons name="chevron-forward" size={20} color="#aaa" />
          </TouchableOpacity>
          
          <Text style={styles.setupSubtitle}>
            Bạn vừa tạo nhóm
          </Text>
          <View style={styles.memberAvatars}>
            {groupDetails.members && groupDetails.members.map((member, index) => (
              <Image 
                key={`setup-avatar-${member.userId}`}
                source={{ uri: member.avatar || 'https://via.placeholder.com/50' }} 
                style={[
                  styles.memberAvatar,
                  { zIndex: groupDetails.members.length - index }
                ]} 
              />
            ))}
            <TouchableOpacity style={styles.addMemberButton}>
              <Ionicons name="person-add" size={20} color="#2196F3" />
            </TouchableOpacity>
          </View>
           <TouchableOpacity style={styles.waveButton}>
            <Text style={styles.waveButtonText}>
              👋 Vẫy tay chào
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.qrButton}>
            <Text style={styles.qrButtonText}>
              Xem mã QR tham gia nhóm
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      {/* Message Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={styles.inputContainer}
      >
        <TouchableOpacity style={styles.emojiButton}>
          <Ionicons name="happy-outline" size={24} color="#666" />
        </TouchableOpacity>
        
        <TextInput
          style={styles.input}
          placeholder="Tin nhắn"
          placeholderTextColor="#999"
          value={message}
          onChangeText={setMessage}
          multiline
        />
        
        <TouchableOpacity style={styles.attachButton}>
          <Ionicons name="mic-outline" size={24} color="#666" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.attachButton}>
          <Ionicons name="image-outline" size={24} color="#666" />
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8EEF7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: '#2196F3',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    marginLeft: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  headerButton: {
    padding: 8,
  },
  messagesContainer: {
    flex: 1,
    padding: 10,
  },
  groupInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 10,
    alignItems: 'center',
  },
  groupAvatars: {
    flexDirection: 'row',
    position: 'relative',
    height: 60,
    width: 100,
    marginBottom: 10,
  },
  groupMainAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    position: 'absolute',
    left: 0,
    zIndex: 2,
  },
  groupSecondaryAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    position: 'absolute',
    left: 30,
    zIndex: 1,
  },
  groupSmallAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    position: 'absolute',
    right: 0,
    bottom: 0,
    zIndex: 3,
    backgroundColor: '#fff',
  },
  groupCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
  },
  groupCardSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  timeIndicator: {
    alignItems: 'center',
    marginVertical: 10,
  },
  timeText: {
    fontSize: 12,
    color: '#666',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  systemMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 10,
    marginVertical: 5,
  },
  systemMessageAvatars: {
    flexDirection: 'row',
    marginRight: 8,
  },
  systemMessageAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: -8,
    borderWidth: 1,
    borderColor: '#fff',
  },
  systemMessageText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  setupCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 10,
  },
  setupAvatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  setupAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  setupTitle: {
    fontSize: 16,
    color: '#666',
    flex: 1,
  },
  setupSubtitle: {
    fontSize: 14,
    color: '#999',
    marginBottom: 10,
  },
  memberAvatars: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: -10,
    borderWidth: 2,
    borderColor: '#fff',
  },
  addMemberButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 5,
  },
  waveButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 15,
  },
  waveButtonText: {
    fontSize: 16,
    color: '#333',
  },
  qrButton: {
    alignItems: 'center',
  },
  qrButtonText: {
    fontSize: 14,
    color: '#666',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  emojiButton: {
    padding: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 16,
  },
  attachButton: {
    padding: 8,
  },
  bottomNav: {
    flexDirection: 'row',
    height: 56,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  navButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  squareIcon: {
    width: 16,
    height: 16,
    backgroundColor: '#999',
  },
  circleIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#999',
  },
  triangleIcon: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#999',
  },
  heartButton: {
    position: 'absolute',
    bottom: 70,
    right: 16,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FF4081',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  containerCentered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#E8EEF7',
  },
});

export default GroupChatScreen;