// VideoCallMobile.js
import React, { useRef, useState } from 'react';
import { View, Button, StyleSheet, Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import TwilioVideo from 'react-native-twilio-video-webrtc';

const VideoCallScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const twilioRef = useRef();
  const { token, roomName } = route.params;

  const [isVideoConnected, setIsVideoConnected] = useState(false);
  const [status, setStatus] = useState('disconnected');
  const [error, setError] = useState(null);

  const onConnect = () => {
    try {
      twilioRef.current.connect({ accessToken: token, roomName });
      setStatus('connecting');
    } catch (err) {
      setError(err.message);
    }
  };

  const onEndCall = () => {
    twilioRef.current.disconnect();
    setStatus('disconnected');
    navigation.goBack();
  };

  return (
    <View style={{ flex: 1 }}>
      {!isVideoConnected && (
        <Button title="Join Video Call" onPress={onConnect} />
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
        // ... bạn có thể thêm các event khác nếu muốn
      />
      {isVideoConnected && (
        <Button title="End Call" onPress={onEndCall} color="red" />
      )}
      {error && <Text style={{ color: 'red', textAlign: 'center' }}>{error}</Text>}
    </View>
  );
};

export default VideoCallScreen;