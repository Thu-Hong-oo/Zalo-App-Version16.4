import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { TwilioVideo } from 'react-native-twilio-video-webrtc';
import Ionicons from 'react-native-vector-icons/Ionicons';
import api from '../config/api';

const VideoCallScreen = ({ route, navigation }) => {
  const { token, roomName, callId, receiverPhone, isCreator } = route.params;
  const twilioRef = useRef(null);
  const [isVideoConnected, setIsVideoConnected] = useState(false);
  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const durationInterval = useRef(null);

  useEffect(() => {
    if (isVideoConnected) {
      durationInterval.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, [isVideoConnected]);

  const onConnect = () => {
    try {
      twilioRef.current?.connect({ accessToken: token, roomName });
      setStatus('connecting');
    } catch (err) {
      setError(err.message);
    }
  };

  const onEndCall = async () => {
    try {
      twilioRef.current?.disconnect();
      setStatus('disconnected');
      
      // Gửi thông tin cuộc gọi kết thúc
      if (callId) {
        await api.post('/video-call/status', {
          callId,
          roomName,
          status: status === 'connected' ? 'ended' : 'cancelled',
          duration: callDuration,
          receiverPhone,
          senderPhone: route.params.identity
        });
      }
      
      navigation.goBack();
    } catch (err) {
      console.error('Error ending call:', err);
    }
  };

  const toggleMute = () => {
    twilioRef.current?.setLocalAudioEnabled(!isMuted);
    setIsMuted(!isMuted);
  };

  const toggleCamera = () => {
    twilioRef.current?.setLocalVideoEnabled(!isCameraOff);
    setIsCameraOff(!isCameraOff);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {!isVideoConnected && (
        <TouchableOpacity style={styles.connectButton} onPress={onConnect}>
          <Text style={styles.connectButtonText}>Join Video Call</Text>
        </TouchableOpacity>
      )}
      
      <TwilioVideo
        ref={twilioRef}
        onRoomDidConnect={() => {
          setIsVideoConnected(true);
          setStatus('connected');
        }}
        onRoomDidDisconnect={() => {
          setIsVideoConnected(false);
          setStatus('disconnected');
        }}
        onRoomDidFailToConnect={err => {
          setError('Failed to connect: ' + err.error);
          setStatus('disconnected');
        }}
        onParticipantAddedVideoTrack={() => {}}
        onParticipantRemovedVideoTrack={() => {}}
        style={styles.video}
      />

      {isVideoConnected && (
        <View style={styles.controls}>
          <TouchableOpacity 
            style={[styles.controlButton, isMuted && styles.controlButtonActive]} 
            onPress={toggleMute}
          >
            {isMuted ? <Ionicons name="mic-off" size={24} color="#fff" /> : <Ionicons name="mic" size={24} color="#fff" />}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.controlButton, isCameraOff && styles.controlButtonActive]} 
            onPress={toggleCamera}
          >
            {isCameraOff ? <Ionicons name="videocam-off" size={24} color="#fff" /> : <Ionicons name="videocam" size={24} color="#fff" />}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.controlButton, styles.endCallButton]} 
            onPress={onEndCall}
          >
            <Ionicons name="call" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {callDuration > 0 && (
        <Text style={styles.duration}>{formatDuration(callDuration)}</Text>
      )}

      {error && (
        <Text style={styles.error}>{error}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  video: {
    flex: 1,
  },
  controls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#666',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  controlButtonActive: {
    backgroundColor: '#e74c3c',
  },
  endCallButton: {
    backgroundColor: '#e74c3c',
  },
  connectButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -75 }, { translateY: -25 }],
    backgroundColor: '#1877f2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  duration: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#fff',
    fontSize: 16,
  },
  error: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#e74c3c',
    fontSize: 16,
  },
});

export default VideoCallScreen;