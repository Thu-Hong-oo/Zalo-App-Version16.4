import React, { useEffect, useState, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { ActivityIndicator, View, Text, Image, StyleSheet } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import api from '../config/api';

const VideoCallScreen = (props) => {
  const route = props.route || useRoute();
  const navigation = useNavigation();
  const webviewRef = useRef();
  const {
    identity,
    roomName: roomNameParam,
    localName = 'Bạn',
    remoteName = 'Đối phương',
    localAvatar = '',
    remoteAvatar = '',
    callId,
    receiverPhone,
    roomId // hoặc chatId, nếu có
  } = route.params;
  const [token, setToken] = useState(null);
  const [roomName, setRoomName] = useState(roomNameParam || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        let room = roomNameParam;
        // Nếu chưa có roomName, tạo mới
        if (!room) {
          const resRoom = await api.post('/video-call/room', { roomName: `room_${Date.now()}` });
          room = resRoom.data.data.room.name;
          setRoomName(room);
        }
        // Lấy token
        const resToken = await api.post('/video-call/token', { identity });
        setToken(resToken.data.data.token);
        setLoading(false);
      } catch (err) {
        setError('Không thể lấy token hoặc tạo phòng!');
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Đường dẫn file local cho Android
  const localHtml = 'file:///android_asset/twilio-video.html';

  // Hàm gửi trạng thái cuộc gọi về backend
  const sendCallStatus = async (status = 'cancelled', duration = 0) => {
    try {
      await api.post('/video-call/status', {
        callId,
        roomName,
        status,
        duration,
        receiverPhone,
        senderPhone: identity,
      });
    } catch (e) {}
  };

  // Lắng nghe sự kiện từ WebView
  const handleWebViewMessage = (event) => {
    if (event.nativeEvent.data === 'call-ended') {
      sendCallStatus('cancelled', 0);
      navigation.goBack();
    }
  };

  if (loading || !token || !roomName) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <Image 
              source={{ uri: remoteAvatar || 'https://via.placeholder.com/50' }} 
              style={styles.avatar}
            />
            <Text style={styles.name}>{remoteName}</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1877f2" />
          <Text style={styles.loadingText}>Đang kết nối...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <Image 
              source={{ uri: remoteAvatar || 'https://via.placeholder.com/50' }} 
              style={styles.avatar}
            />
            <Text style={styles.name}>{remoteName}</Text>
          </View>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }
  console.log('VideoCallScreen token:', token);
  console.log('VideoCallScreen roomName:', roomName);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Image
            source={{ uri: remoteAvatar || 'https://via.placeholder.com/50' }} 
            style={styles.avatar}
          />
          <Text style={styles.name}>{remoteName}</Text>
        </View>
      </View>
      <WebView
        ref={webviewRef}
        source={{ uri: localHtml }}
        style={{ flex: 1 }}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        onLoadEnd={() => {
          webviewRef.current.postMessage(JSON.stringify({
            token,
            roomName,
            localName,
            remoteName,
            localAvatar,
            remoteAvatar,
          }));
        }}
        onMessage={handleWebViewMessage}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    padding: 15,
    backgroundColor: 'rgba(0,0,0,0.5)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  name: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: 'red',
    fontSize: 16,
  },
});

export default VideoCallScreen;