import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import messageService from '../../modules/message/controller';
import COLORS from '../colors';

const ChatHeader = ({ chatId }) => {
  const navigation = useNavigation();
  const [showMenu, setShowMenu] = useState(false);

  const handleDeleteChat = async () => {
    try {
      await messageService.deleteChat(chatId);
      navigation.goBack();
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  const handleBlockUser = async () => {
    try {
      await messageService.blockUser(chatId);
      navigation.goBack();
    } catch (error) {
      console.error('Error blocking user:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{chatId}</Text>
      <TouchableOpacity 
        style={styles.menuButton}
        onPress={() => setShowMenu(!showMenu)}
      >
        <Text style={styles.menuButtonText}>⋮</Text>
      </TouchableOpacity>
      
      {showMenu && (
        <View style={styles.menu}>
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={handleDeleteChat}
          >
            <Text style={styles.menuItemText}>Xóa đoạn chat</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={handleBlockUser}
          >
            <Text style={styles.menuItemText}>Chặn người dùng</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: COLORS.primary,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  menuButton: {
    padding: 8,
  },
  menuButtonText: {
    fontSize: 24,
    color: COLORS.white,
  },
  menu: {
    position: 'absolute',
    top: 50,
    right: 16,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    elevation: 4,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  menuItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  menuItemText: {
    fontSize: 16,
    color: COLORS.black,
  },
});

export default ChatHeader; 