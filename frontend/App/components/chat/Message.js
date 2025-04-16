import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { format } from 'date-fns';
import COLORS from '../colors';

const Message = ({ message, isOwn, onRecall }) => {
  const handleRecall = () => {
    if (isOwn && onRecall) {
      onRecall(message._id);
    }
  };

  const renderContent = () => {
    switch (message.type) {
      case 'text':
        return <Text style={styles.text}>{message.content}</Text>;
      case 'file':
        return (
          <TouchableOpacity style={styles.fileContainer}>
            <Text style={styles.fileName}>{message.content}</Text>
          </TouchableOpacity>
        );
      case 'image':
        return (
          <Image
            source={{ uri: message.content }}
            style={styles.image}
            resizeMode="cover"
          />
        );
      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, isOwn ? styles.ownMessage : styles.otherMessage]}>
      <View style={[styles.messageContent, isOwn ? styles.ownContent : styles.otherContent]}>
        {renderContent()}
        <View style={styles.messageInfo}>
          <Text style={styles.time}>
            {format(new Date(message.createdAt), 'HH:mm')}
          </Text>
          {isOwn && (
            <Text style={styles.status}>
              {message.isRead ? '✓✓' : '✓'}
            </Text>
          )}
        </View>
      </View>
      {isOwn && (
        <TouchableOpacity style={styles.recallButton} onPress={handleRecall}>
          <Text style={styles.recallText}>Thu hồi</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    maxWidth: '80%',
  },
  ownMessage: {
    alignSelf: 'flex-end',
  },
  otherMessage: {
    alignSelf: 'flex-start',
  },
  messageContent: {
    padding: 12,
    borderRadius: 16,
    elevation: 2,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  ownContent: {
    backgroundColor: COLORS.primary,
  },
  otherContent: {
    backgroundColor: COLORS.white,
  },
  text: {
    fontSize: 16,
    color: COLORS.black,
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: COLORS.lightGray,
    borderRadius: 8,
  },
  fileName: {
    fontSize: 14,
    color: COLORS.black,
    marginLeft: 8,
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: 8,
  },
  messageInfo: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  time: {
    fontSize: 12,
    color: COLORS.gray,
    marginRight: 4,
  },
  status: {
    fontSize: 12,
    color: COLORS.gray,
  },
  recallButton: {
    marginTop: 4,
    padding: 4,
  },
  recallText: {
    fontSize: 12,
    color: COLORS.gray,
    textDecorationLine: 'underline',
  },
});

export default Message; 