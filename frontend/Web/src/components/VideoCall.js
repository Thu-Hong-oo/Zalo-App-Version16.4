import React, { useEffect, useRef, useState } from 'react';
import Video from 'twilio-video';
import { FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash, FaPhoneSlash, FaUserCircle } from 'react-icons/fa';
import './css/VideoCall.css';
import api from '../config/api';
import { useSocket } from '../App';

const VideoCall = ({
  isOpen,
  onClose,
  identity,
  isCreator = false,
  roomName: initialRoomName,
  localName = "Bạn",
  remoteName = "Đối phương",
  localAvatar,
  remoteAvatar,
  callId,
  onCallEnded,
  receiverPhone
}) => {
  console.log('VideoCall props:', { isOpen, identity, isCreator, initialRoomName });
  const socket = useSocket();
  const [room, setRoom] = useState(null);
  const [localTracks, setLocalTracks] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [remoteConnected, setRemoteConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(null);
  const [roomName, setRoomName] = useState(initialRoomName || '');
  const [callStatus, setCallStatus] = useState('connecting');
  const [callDuration, setCallDuration] = useState(0);
  const durationInterval = useRef(null);
  const [isCallEnded, setIsCallEnded] = useState(false);
  const [shouldConnectRoom, setShouldConnectRoom] = useState(isCreator);

  const localMediaRef = useRef();
  const remoteMediaRef = useRef();

  // Thêm hàm gửi thông tin cuộc gọi
  const sendCallInfo = async (status, duration = 0) => {
    try {
      // Kiểm tra đầy đủ thông tin trước khi gửi
      if (!identity || !receiverPhone) {
        console.error('sendCallInfo: thiếu identity hoặc receiverPhone', { identity, receiverPhone });
        return;
      }

      await api.post('/video-call/status', {
        callId,
        roomName,
        status,
        duration,
        receiverPhone,
        senderPhone: identity
      });
    } catch (err) {
      console.error('Error sending call info:', err);
    }
  };

  // Hàm dọn dẹp tất cả local tracks
  const cleanupLocalTracks = () => {
    localTracks.forEach(track => {
      if (track.stop) {
        track.stop();
      }
      // Detach track khỏi DOM elements
      track.detach().forEach(element => {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      });
    });
    setLocalTracks([]);
    
    // Clear local video container
    if (localMediaRef.current) {
      localMediaRef.current.innerHTML = '';
    }
  };

  // useEffect khởi tạo phòng và gửi invite nếu là creator
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const fetchTokenAndRoom = async () => {
      try {
        setError(null);
        setConnecting(true);
        let name = roomName;

        // Create room if creator
        if (isCreator && !name) {
          const res = await api.post('/video-call/room', { roomName: `room_${Date.now()}` });
          name = res.data.data.room.name;
          setRoomName(name);

          // Gửi invite lên backend
          socket.emit('video-call-invite', {
            receiverPhone,
            roomName: name,
            callType: 'video'
          });
        }

        // Get token
        const res2 = await api.post('/video-call/token', { identity });
        if (!cancelled) {
          setToken(res2.data.data.token);
          if (!roomName && name) setRoomName(name);
        }
      } catch (err) {
        setError('Không thể lấy token hoặc tạo phòng: ' + (err.response?.data?.message || err.message));
        setConnecting(false);
      }
    };

    fetchTokenAndRoom();
    return () => { cancelled = true; };
  }, [isOpen, isCreator, identity]);

  // Lắng nghe các event socket từ backend
  useEffect(() => {
    if (!socket || !isOpen) return;
    if (!identity || !receiverPhone || !callId) {
      console.error('VideoCall: thiếu thông tin cần thiết', { identity, receiverPhone, callId });
      return;
    }

    const handleCallAccepted = (data) => {
      if (data.callId === callId) {
        setCallStatus('connected');
        setConnecting(false);
        setShouldConnectRoom(true); // Chỉ khi nhận được call-accepted mới connect Twilio room nếu là receiver
        sendCallInfo('started');
      }
    };

    const handleCallDeclined = (data) => {
      if (data.callId === callId) {
        setCallStatus('declined');
        sendCallInfo('declined');
        handleEndCall();
      }
    };

    const handleCallEnded = (data) => {
      if (data.callId === callId) {
        setCallStatus('ended');
        handleEndCall();
      }
    };

    const handleCallTimeout = (data) => {
      if (data.callId === callId) {
        setCallStatus('missed');
        sendCallInfo('missed');
        handleEndCall();
      }
    };

    socket.on('call-accepted', handleCallAccepted);
    socket.on('call-declined', handleCallDeclined);
    socket.on('call-ended', handleCallEnded);
    socket.on('call-timeout', handleCallTimeout);

    return () => {
      socket.off('call-accepted', handleCallAccepted);
      socket.off('call-declined', handleCallDeclined);
      socket.off('call-ended', handleCallEnded);
      socket.off('call-timeout', handleCallTimeout);
    };
  }, [socket, isOpen, callId]);

  // Connect to Twilio room chỉ khi shouldConnectRoom true
  useEffect(() => {
    if (!isOpen || !token || !roomName || !shouldConnectRoom) return;
    let currentRoom;

    const connectToRoom = async () => {
      try {
        setConnecting(true);
        setError(null);

        currentRoom = await Video.connect(token, { name: roomName });
        setRoom(currentRoom);

        let tracks = [];
        try {
          tracks = await Video.createLocalTracks({
            audio: true,
            video: { width: 640 }
          });
          setLocalTracks(tracks);
          tracks.forEach(track => {
            currentRoom.localParticipant.publishTrack(track);
          });
        } catch (err) {
          setError('Không truy cập được camera: ' + err.message);
          setLocalTracks([]);
          return;
        }

        const handleParticipant = participant => {
          setRemoteConnected(true);
          setCallStatus('connected');
          setConnecting(false);
          if (!durationInterval.current) {
            durationInterval.current = setInterval(() => {
              setCallDuration(prev => prev + 1);
            }, 1000);
          }
          participant.tracks.forEach(publication => {
            if (publication.isSubscribed) {
              if (remoteMediaRef.current) {
                remoteMediaRef.current.appendChild(publication.track.attach());
              }
            }
          });
          participant.on('trackSubscribed', track => {
            if (remoteMediaRef.current) {
              remoteMediaRef.current.appendChild(track.attach());
            }
          });
          participant.on('trackUnsubscribed', track => {
            track.detach().forEach(element => element.remove());
          });
        };

        currentRoom.participants.forEach(handleParticipant);
        currentRoom.on('participantConnected', handleParticipant);
        currentRoom.on('participantDisconnected', () => {
          setRemoteConnected(false);
          if (remoteMediaRef.current) {
            remoteMediaRef.current.innerHTML = '';
          }
        });
        currentRoom.on('disconnected', () => {
          setRemoteConnected(false);
          setConnecting(false);
          handleEndCall();
        });
      } catch (err) {
        setError('Không thể kết nối đến cuộc gọi. Vui lòng thử lại.');
        setConnecting(false);
      }
    };

    connectToRoom();

    return () => {
      if (currentRoom) {
        currentRoom.disconnect();
      }
      cleanupLocalTracks();
      if (remoteMediaRef.current) {
        remoteMediaRef.current.innerHTML = '';
      }
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }
    };
  }, [isOpen, token, roomName, shouldConnectRoom]);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('video-call-active');
    } else {
      document.body.classList.remove('video-call-active');
    }
    return () => {
      document.body.classList.remove('video-call-active');
    };
  }, [isOpen]);

  // Cleanup khi component unmount hoặc đóng
  useEffect(() => {
    return () => {
      if (!isOpen) {
        cleanupLocalTracks();
        if (durationInterval.current) {
          clearInterval(durationInterval.current);
          durationInterval.current = null;
        }
      }
    };
  }, [isOpen]);

  // Format duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleMute = () => {
    localTracks.forEach(track => {
      if (track.kind === 'audio') {
        track.isEnabled ? track.disable() : track.enable();
      }
    });
    setIsMuted(!isMuted);
  };

  const toggleCamera = async () => {
    try {
      if (!isCameraOff) {
        // Tắt camera
        const videoTrack = localTracks.find(track => 
          track.kind === 'video' || (track.mediaStreamTrack && track.mediaStreamTrack.kind === 'video')
        );
        
        if (videoTrack) {
          // Unpublish track from room
          if (room && room.localParticipant) {
            const publication = room.localParticipant.tracks.get(videoTrack.sid);
            if (publication) {
              room.localParticipant.unpublishTrack(videoTrack);
            }
          }
          
          // Stop và detach track
          videoTrack.stop();
          videoTrack.detach().forEach(element => {
            if (element.parentNode) {
              element.parentNode.removeChild(element);
            }
          });
          
          // Remove video track from localTracks
          setLocalTracks(prevTracks => prevTracks.filter(track => 
            !(track.kind === 'video' || (track.mediaStreamTrack && track.mediaStreamTrack.kind === 'video'))
          ));
        }
        
        setIsCameraOff(true);
      } else {
        // Bật lại camera
        try {
          const videoTrack = await Video.createLocalVideoTrack({ width: 640 });
          
          // Publish track to room
          if (room && room.localParticipant) {
            room.localParticipant.publishTrack(videoTrack);
          }
          
          // Add to localTracks
          setLocalTracks(prevTracks => [...prevTracks, videoTrack]);
          setIsCameraOff(false);
        } catch (err) {
          console.error('Không thể tạo lại video track:', err);
          setError('Không thể bật lại camera: ' + err.message);
        }
      }
    } catch (err) {
      console.error('Lỗi khi toggle camera:', err);
    }
  };

  const handleEndCall = () => {
    if (isCallEnded) return;
    setIsCallEnded(true);
    cleanupLocalTracks();
    if (room) {
      room.disconnect();
      setRoom(null);
    }
    if (remoteMediaRef.current) {
      remoteMediaRef.current.innerHTML = '';
    }
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }
    if (socket && callId) {
      if (callStatus === 'connected') {
        sendCallInfo('ended', callDuration);
        socket.emit('end-video-call', { callId });
      } else if ((callStatus === 'connecting' || callStatus === 'ringing') && isCreator) {
        sendCallInfo('cancelled');
        socket.emit('end-video-call', { callId });
      }
    }
    onClose();
    if (onCallEnded) onCallEnded(callId, callDuration);
  };

  // Attach local video track
  useEffect(() => {
    if (!localTracks.length || !localMediaRef.current) return;
    
    const videoTrack = localTracks.find(
      t =>
        (t.kind && t.kind.toLowerCase() === 'video') ||
        (t.mediaStreamTrack && t.mediaStreamTrack.kind && t.mediaStreamTrack.kind.toLowerCase() === 'video')
    );
    
    if (videoTrack && !isCameraOff) {
      try {
        // Clear previous video elements
        localMediaRef.current.innerHTML = '';
        
        const videoElement = videoTrack.attach();
        videoElement.style.width = '100%';
        videoElement.style.height = '100%';
        videoElement.autoplay = true;
        videoElement.muted = true;
        localMediaRef.current.appendChild(videoElement);
      } catch (err) {
        console.error('Lỗi khi attach video track:', err);
      }
    } else if (isCameraOff) {
      // Clear video when camera is off
      if (localMediaRef.current) {
        localMediaRef.current.innerHTML = '';
      }
    }
  }, [localTracks, isCameraOff]);

  if (!isOpen) return null;

  return (
    <div className="video-call-container">
      <div className="video-call-content">
        <div className="video-call-header">
          <h3>Cuộc gọi video với {remoteName}</h3>
          {callDuration > 0 && (
            <div className="call-duration">{formatDuration(callDuration)}</div>
          )}
        </div>

        <div className="video-grid">
          <div className="remote-video-container">
            <div ref={remoteMediaRef}></div>
            {!remoteConnected && (
              <div className="video-placeholder">
                {remoteAvatar ? (
                  <img src={remoteAvatar} alt="avatar" />
                ) : (
                  <FaUserCircle size={80} />
                )}
                <div>{connecting ? 'Đang kết nối...' : 'Chờ đối phương...'}</div>
              </div>
            )}
            <div className="local-video-container">
              {(localTracks.length === 0 && !isCameraOff) || error ? (
                <div className="video-placeholder small">
                  {localAvatar ? (
                    <img src={localAvatar} alt="avatar" />
                  ) : (
                    <FaUserCircle size={40} />
                  )}
                  <div>{error ? 'Không truy cập được camera' : 'Đang khởi tạo camera...'}</div>
                </div>
              ) : isCameraOff ? (
                <div className="video-placeholder small">
                  {localAvatar ? (
                    <img src={localAvatar} alt="avatar" />
                  ) : (
                    <FaUserCircle size={40} />
                  )}
                  <div>Đã tắt camera</div>
                </div>
              ) : (
                <div ref={localMediaRef}></div>
              )}
            </div>
          </div>
        </div>

        <div className="video-controls">
          <button
            className={`control-button ${isMuted ? 'muted' : ''}`}
            onClick={toggleMute}
            title={isMuted ? 'Bật mic' : 'Tắt mic'}
          >
            {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
          </button>

          <button
            className={`control-button ${isCameraOff ? 'camera-off' : ''}`}
            onClick={toggleCamera}
            title={isCameraOff ? 'Bật camera' : 'Tắt camera'}
          >
            {isCameraOff ? <FaVideoSlash /> : <FaVideo />}
          </button>

          <button
            className="control-button end-call"
            onClick={handleEndCall}
            title="Kết thúc cuộc gọi"
          >
            <FaPhoneSlash />
          </button>
        </div>

        <div className="video-status">
          {error ? (
            <div style={{ color: '#e74c3c' }}>{error}</div>
          ) : (
            <div>
              {connecting
                ? 'Đang kết nối...'
                : remoteConnected
                  ? 'Đã kết nối'
                  : 'Chờ đối phương tham gia...'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoCall;