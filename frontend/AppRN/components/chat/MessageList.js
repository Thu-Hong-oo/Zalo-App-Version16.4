import React, { useEffect, useRef } from 'react';
import { FlatList, View, StyleSheet } from 'react-native';
import Message from './Message';
import COLORS from '../colors';

const MessageList = ({ messages, currentUser, onRecall, onRead }) => {
  const flatListRef = useRef(null);

  useEffect(() => {
    // Mark messages as read when component mounts
    const unreadMessages = messages.filter(
      msg => !msg.isRead && msg.senderId !== currentUser
    );
    if (unreadMessages.length > 0) {
      onRead(unreadMessages.map(msg => msg._id));
    }
  }, [messages, currentUser, onRead]);

  return (
    <FlatList
      ref={flatListRef}
      data={messages}
      keyExtractor={(item) => item._id}
      renderItem={({ item }) => (
        <Message
          message={item}
          isOwn={item.senderId === currentUser}
          onRecall={onRecall}
        />
      )}
      onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      onLayout={() => flatListRef.current?.scrollToEnd()}
      style={styles.container}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: COLORS.background,
  },
});

export default MessageList; 