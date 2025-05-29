import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Video, Phone, PhoneOff, PhoneMissed, PhoneIncoming } from 'lucide-react-native';

const CallMessage = ({ message }) => {
  const callType = message.type === 'video' || message.type === 'audio' ? message.type : (message.callType || 'video');
  const isVideo = callType === 'video';

  const getCallIcon = (status) => {
    if (isVideo) {
      switch (status) {
        case 'started': return <Video size={16} />;
        case 'ended': return <Video size={16} />;
        case 'missed': return <Video size={16} />;
        case 'declined': return <Video size={16} />;
        case 'cancelled': return <Video size={16} />;
        default: return <Video size={16} />;
      }
    } else {
      switch (status) {
        case 'started': return <PhoneIncoming size={16} />;
        case 'ended': return <Phone size={16} />;
        case 'missed': return <PhoneMissed size={16} />;
        case 'declined': return <PhoneOff size={16} />;
        case 'cancelled': return <PhoneOff size={16} />;
        default: return <Phone size={16} />;
      }
    }
  };

  const getCallText = (status, duration) => {
    if (isVideo) {
      switch (status) {
        case 'started': return 'Bắt đầu video call';
        case 'ended': return `Kết thúc video call${duration ? ` (${formatDuration(duration)})` : ''}`;
        case 'missed': return 'Video call nhỡ';
        case 'declined': return 'Video call bị từ chối';
        case 'cancelled': return 'Video call bị huỷ';
        default: return 'Video call';
      }
    } else {
      switch (status) {
        case 'started': return 'Bắt đầu cuộc gọi thoại';
        case 'ended': return `Kết thúc cuộc gọi thoại${duration ? ` (${formatDuration(duration)})` : ''}`;
        case 'missed': return 'Cuộc gọi nhỡ';
        case 'declined': return 'Cuộc gọi bị từ chối';
        case 'cancelled': return 'Cuộc gọi thoại bị huỷ';
        default: return 'Cuộc gọi thoại';
      }
    }
  };

  const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        {getCallIcon(message.callStatus || message.status)}
      </View>
      <View style={styles.infoContainer}>
        <Text style={styles.callText}>
          {getCallText(message.callStatus || message.status, message.duration)}
        </Text>
        <Text style={styles.callTime}>
          {new Date(message.timestamp).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  iconContainer: {
    marginRight: 8,
  },
  infoContainer: {
    flex: 1,
  },
  callText: {
    fontSize: 14,
    color: '#666',
  },
  callTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
});

export default CallMessage; 