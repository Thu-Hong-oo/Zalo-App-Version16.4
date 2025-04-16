import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import COLORS from '../colors';

const MessageInput = ({ onSend }) => {
  const [content, setContent] = useState('');
  const [files, setFiles] = useState([]);

  const handleSubmit = () => {
    if (content.trim() || files.length > 0) {
      onSend(content, files);
      setContent('');
      setFiles([]);
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled) {
        setFiles([...files, { type: 'image', uri: result.assets[0].uri }]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({});

      if (result.type === 'success') {
        setFiles([...files, { type: 'file', uri: result.uri, name: result.name }]);
      }
    } catch (error) {
      console.error('Error picking document:', error);
    }
  };

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.container}>
      {files.length > 0 && (
        <View style={styles.filePreview}>
          {files.map((file, index) => (
            <View key={index} style={styles.fileItem}>
              <Text style={styles.fileName}>
                {file.type === 'file' ? file.name : 'Image'}
              </Text>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeFile(index)}
              >
                <Text style={styles.removeText}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
      <View style={styles.inputArea}>
        <TouchableOpacity style={styles.attachmentButton} onPress={handlePickDocument}>
          <MaterialIcons name="attach-file" size={24} color={COLORS.gray} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.attachmentButton} onPress={handlePickImage}>
          <MaterialIcons name="image" size={24} color={COLORS.gray} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={content}
          onChangeText={setContent}
          placeholder="Nhập tin nhắn..."
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!content.trim() && files.length === 0) && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={!content.trim() && files.length === 0}
        >
          <Text style={styles.sendButtonText}>Gửi</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
  },
  filePreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    padding: 8,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  fileName: {
    fontSize: 14,
    color: COLORS.black,
    marginRight: 8,
  },
  removeButton: {
    padding: 4,
  },
  removeText: {
    fontSize: 16,
    color: COLORS.gray,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attachmentButton: {
    padding: 8,
    marginRight: 8,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    ...Platform.select({
      ios: {
        paddingTop: 8,
      },
    }),
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginLeft: 8,
  },
  disabledButton: {
    backgroundColor: COLORS.gray,
  },
  sendButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default MessageInput; 