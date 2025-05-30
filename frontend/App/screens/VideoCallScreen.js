import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import { io } from 'socket.io-client';
import { getBaseUrl } from '../config/api';
import { getAccessToken } from '../services/storage';

const VideoCallScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const webViewRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const {
    token,
    roomName,
    callId,
    receiverPhone,
    isCreator,
    identity,
    localName,
    localAvatar,
    remoteName,
    remoteAvatar
  } = route.params;

  // Khởi tạo socket connection
  useEffect(() => {
    const initSocket = async () => {
      try {
        const token = await getAccessToken();
        const newSocket = io(getBaseUrl(), {
          auth: { token },
          transports: ['websocket', 'polling'],
          forceNew: true,
          reconnection: true,
          reconnectionAttempts: 5,
        });

        newSocket.on('connect', () => {
          console.log('Connected to socket server');
        });

        newSocket.on('connect_error', (error) => {
          console.error('Socket connection error:', error);
        });

        // Xử lý các sự kiện cuộc gọi
        newSocket.on('call-accepted', (data) => {
          if (data.callId === callId) {
            console.log('Call accepted:', data);
          }
        });

        newSocket.on('call-declined', (data) => {
          if (data.callId === callId) {
            Alert.alert('Cuộc gọi bị từ chối');
            navigation.goBack();
          }
        });

        newSocket.on('call-ended', (data) => {
          if (data.callId === callId) {
            Alert.alert('Cuộc gọi đã kết thúc');
            navigation.goBack();
          }
        });

        newSocket.on('call-timeout', (data) => {
          if (data.callId === callId) {
            Alert.alert('Cuộc gọi nhỡ');
            navigation.goBack();
          }
        });

        setSocket(newSocket);

        return () => {
          newSocket.disconnect();
        };
      } catch (error) {
        console.error('Socket initialization error:', error);
      }
    };

    initSocket();
  }, [callId]);

  // HTML content with Twilio video implementation
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Twilio Video Call</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://media.twiliocdn.com/sdk/js/video/releases/2.31.0/twilio-video.min.js"></script>
        <style>
          body { margin: 0; background: #000; color: #fff; font-family: sans-serif; }
          #remote-media-div, #local-media-div { width: 100vw; height: 45vh; }
          #remote-media-div video, #local-media-div video { width: 100%; height: 100%; object-fit: contain; }
          #controls {
            position: fixed;
            bottom: 30px;
            left: 0; right: 0;
            display: flex;
            justify-content: center;
            gap: 30px;
            z-index: 10;
          }
          .btn {
            width: 60px; height: 60px;
            border-radius: 30px;
            border: none;
            background: #222;
            color: #fff;
            font-size: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px #0008;
            cursor: pointer;
            transition: background 0.2s;
          }
          .btn.end { background: #e74c3c; }
          .btn.active { background: #1877f2; }
          #error { color: #e74c3c; font-size: 20px; margin: 20px; }
          .placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 45vh; }
          .avatar { width: 80px; height: 80px; border-radius: 40px; background: #444; margin-bottom: 10px; }
          .name { font-size: 18px; margin-bottom: 5px; }
        </style>
      </head>
      <body>
        <div id="remote-media-div"></div>
        <div id="local-media-div"></div>
        <div id="controls">
          <button id="btn-mic" class="btn">🎤</button>
          <button id="btn-cam" class="btn">📷</button>
          <button id="btn-end" class="btn end">⏹️</button>
        </div>
        <div id="error"></div>
        <script>
          // Set variables from React Native
          window.token = "${token}";
          window.roomName = "${roomName}";
          window.localName = "${localName}";
          window.remoteName = "${remoteName}";
          window.localAvatar = "${localAvatar}";
          window.remoteAvatar = "${remoteAvatar}";
          window.isCreator = ${isCreator};
          window.identity = "${identity}";
          window.callId = "${callId}";
          window.receiverPhone = "${receiverPhone}";

          function getVar(name, defaultValue) {
            return window[name] !== undefined ? window[name] : defaultValue;
          }

          function showError(msg) {
            document.getElementById('error').innerText = msg;
          }

          function showRemotePlaceholder() {
            const div = document.getElementById('remote-media-div');
            div.innerHTML = \`<div class='placeholder'>
              \${window.remoteAvatar ? \`<img src='\${window.remoteAvatar}' class='avatar'/>\` : \`<div class='avatar'></div>\`}
              <div class='name'>\${window.remoteName}</div>
            </div>\`;
          }

          function showLocalPlaceholder() {
            const div = document.getElementById('local-media-div');
            div.innerHTML = \`<div class='placeholder'>
              \${window.localAvatar ? \`<img src='\${window.localAvatar}' class='avatar'/>\` : \`<div class='avatar'></div>\`}
              <div class='name'>\${window.localName}</div>
            </div>\`;
          }

          let localVideoTrack = null;
          let localAudioTrack = null;
          let localTracks = [];
          async function showLocalCamera() {
            try {
              showLocalPlaceholder();
              console.log('Bắt đầu tạo local video track...');
              localVideoTrack = await Twilio.Video.createLocalVideoTrack();
              console.log('Đã tạo local video track:', localVideoTrack);
              localAudioTrack = await Twilio.Video.createLocalAudioTrack();
              console.log('Đã tạo local audio track:', localAudioTrack);
              localTracks = [localVideoTrack, localAudioTrack];
              const div = document.getElementById('local-media-div');
              div.innerHTML = '';
              div.appendChild(localVideoTrack.attach());
            } catch (e) {
              showError('Không thể bật camera: ' + e.message);
              console.log('Lỗi khi tạo local video/audio track:', e);
            }
          }

          function waitForVars() {
            if (window.token && window.roomName) {
              showRemotePlaceholder();
              if (!localVideoTrack || !localAudioTrack) {
                showLocalCamera().then(() => {
                  startCall(window.token, window.roomName);
                });
              } else {
                startCall(window.token, window.roomName);
              }
            } else {
              setTimeout(waitForVars, 100);
            }
          }

          let roomGlobal = null;
          let micEnabled = true;
          let camEnabled = true;

          function startCall(token, roomName) {
            console.log('Bắt đầu join room với token:', token, 'roomName:', roomName, 'tracks:', localTracks);
            Twilio.Video.connect(token, {
              name: roomName,
              tracks: localTracks.length ? localTracks : undefined
            }).then(room => {
              roomGlobal = room;
              showError('');
              room.localParticipant.tracks.forEach(publication => {
                if (publication.track && publication.track.kind === 'video') {
                  document.getElementById('local-media-div').innerHTML = '';
                  document.getElementById('local-media-div').appendChild(publication.track.attach());
                }
              });
              room.on('participantConnected', participant => {
                participant.tracks.forEach(publication => {
                  if (publication.isSubscribed && publication.track.kind === 'video') {
                    document.getElementById('remote-media-div').innerHTML = '';
                    document.getElementById('remote-media-div').appendChild(publication.track.attach());
                  }
                });
                participant.on('trackSubscribed', track => {
                  if (track.kind === 'video') {
                    document.getElementById('remote-media-div').innerHTML = '';
                    document.getElementById('remote-media-div').appendChild(track.attach());
                  }
                });
                participant.on('trackUnsubscribed', track => {
                  if (track.kind === 'video') {
                    track.detach().forEach(element => element.remove());
                    showRemotePlaceholder();
                  }
                });
              });
              room.on('participantDisconnected', () => {
                showRemotePlaceholder();
              });
            }).catch(err => {
              showError('Kết nối thất bại: ' + err.message);
              console.log('Lỗi khi join room:', err);
            });
          }

          document.getElementById('btn-mic').onclick = function() {
            if (!roomGlobal) return;
            micEnabled = !micEnabled;
            this.classList.toggle('active', !micEnabled);
            this.innerText = micEnabled ? '🎤' : '🔇';
            roomGlobal.localParticipant.audioTracks.forEach(pub => {
              pub.track.enable(micEnabled);
            });
          };

          document.getElementById('btn-cam').onclick = function() {
            if (!roomGlobal) return;
            camEnabled = !camEnabled;
            this.classList.toggle('active', !camEnabled);
            this.innerText = camEnabled ? '📷' : '🚫';
            roomGlobal.localParticipant.videoTracks.forEach(pub => {
              pub.track.enable(camEnabled);
            });
          };

          document.getElementById('btn-end').onclick = function() {
            if (roomGlobal) roomGlobal.disconnect();
            if (localVideoTrack) {
              localVideoTrack.stop();
              const div = document.getElementById('local-media-div');
              div.innerHTML = '';
            }
            document.getElementById('remote-media-div').innerHTML = '';
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'call-ended',
                callId: window.callId,
                isCreator: window.isCreator,
                receiverPhone: window.receiverPhone
              }));
            }
          };

          waitForVars();
        </script>
      </body>
    </html>
  `;

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'call-ended') {
        if (socket) {
          socket.emit('end-video-call', {
            callId: data.callId,
            isCreator: data.isCreator,
            receiverPhone: data.receiverPhone
          });
        }
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error handling WebView message:', error);
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        style={styles.webview}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        originWhitelist={['*']}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
});

export default VideoCallScreen;