import React from 'react';
import { Phone, Video, PhoneOff, PhoneMissed, PhoneIncoming, VideoOff } from 'lucide-react';

const CallMessage = ({ message }) => {
  // Ưu tiên message.type === 'video' hoặc 'audio', nếu không thì fallback callType
  const callType = message.type === 'video' || message.type === 'audio' ? message.type : (message.callType || 'video');
  const isVideo = callType === 'video';

  const getCallIcon = (status) => {
    if (isVideo) {
      switch (status) {
        case 'started': return <VideoOff size={16} />;
        case 'ended': return <Video size={16} />;
        case 'missed': return <VideoOff size={16} />;
        case 'declined': return <VideoOff size={16} />;
        case 'cancelled': return <VideoOff size={16} />;
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
    <div className="call-message">
      <div className="call-icon">
        {getCallIcon(message.callStatus || message.status)}
      </div>
      <div className="call-info">
        <span className="call-text">{getCallText(message.callStatus || message.status, message.duration)}</span>
        <span className="call-time">
          {new Date(message.timestamp).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
      </div>
    </div>
  );
};

export default CallMessage; 