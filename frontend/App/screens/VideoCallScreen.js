// VideoCallMobile.js
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
} from 'react-native-webrtc';
import io from 'socket.io-client';

const VideoCallMobile = ({ callId }) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const peerConnection = useRef();
  const socket = useRef();

  useEffect(() => {
    requestPermissions();
    initializeCall();
    return () => cleanup();
  }, [callId]);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);
        if (
          granted['android.permission.RECORD_AUDIO'] === PermissionsAndroid.RESULTS.GRANTED &&
          granted['android.permission.CAMERA'] === PermissionsAndroid.RESULTS.GRANTED
        ) {
          console.log('Permissions granted');
        } else {
          console.log('Permissions denied');
        }
      } catch (err) {
        console.warn(err);
      }
    }
  };

  const initializeCall = async () => {
    try {
      // Kết nối Socket.IO
      socket.current = io('YOUR_SERVER_URL');
      socket.current.emit('join-call-room', callId);

      // Lấy media stream
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: {
          mandatory: {
            minWidth: 640,
            minHeight: 480,
            minFrameRate: 30,
          },
          facingMode: 'user',
          optional: [],
        },
      });
      setLocalStream(stream);

      // Tạo peer connection
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      };
      peerConnection.current = new RTCPeerConnection(configuration);

      // Thêm local stream
      stream.getTracks().forEach(track => {
        peerConnection.current.addTrack(track, stream);
      });

      // Xử lý remote stream
      peerConnection.current.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };

      // Xử lý ICE candidates
      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
          socket.current.emit('ice-candidate', {
            callId,
            candidate: event.candidate
          });
        }
      };

      setupSocketListeners();
    } catch (error) {
      console.error('Error initializing call:', error);
    }
  };

  const setupSocketListeners = () => {
    socket.current.on('offer', async ({ offer, callerId }) => {
      try {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        
        socket.current.emit('answer', {
          callId,
          answer
        });
      } catch (error) {
        console.error('Error handling offer:', error);
      }
    });

    socket.current.on('answer', async ({ answer }) => {
      try {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    });

    socket.current.on('ice-candidate', async ({ candidate }) => {
      try {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('Error handling ICE candidate:', error);
      }
    });
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleCamera = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsCameraOff(!isCameraOff);
    }
  };

  const startCall = async () => {
    try {
      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);
      
      socket.current.emit('offer', {
        callId,
        offer
      });
    } catch (error) {
      console.error('Error starting call:', error);
    }
  };

  const endCall = () => {
    socket.current.emit('end-call', { callId });
    cleanup();
  };

  const cleanup = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection.current) {
      peerConnection.current.close();
    }
    socket.current.disconnect();
  };

  return (
    <View style={styles.container}>
      <View style={styles.videoContainer}>
        {localStream && (
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.localVideo}
            objectFit="cover"
          />
        )}
        {remoteStream && (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={styles.remoteVideo}
            objectFit="cover"
          />
        )}
      </View>
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, isMuted && styles.buttonActive]}
          onPress={toggleMute}
        >
          <Text>{isMuted ? 'Unmute' : 'Mute'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, isCameraOff && styles.buttonActive]}
          onPress={toggleCamera}
        >
          <Text>{isCameraOff ? 'Turn On Camera' : 'Turn Off Camera'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={startCall}
        >
          <Text>Start Call</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.endCallButton]}
          onPress={endCall}
        >
          <Text>End Call</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  localVideo: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 100,
    height: 150,
    backgroundColor: '#2c3e50',
  },
  remoteVideo: {
    flex: 1,
    backgroundColor: '#2c3e50',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  button: {
    padding: 15,
    borderRadius: 25,
    backgroundColor: '#3498db',
  },
  buttonActive: {
    backgroundColor: '#e74c3c',
  },
  endCallButton: {
    backgroundColor: '#e74c3c',
  },
});

export default VideoCallMobile;