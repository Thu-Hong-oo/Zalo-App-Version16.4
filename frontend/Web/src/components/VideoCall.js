import React, { useEffect, useRef, useState } from 'react';
import Video from 'twilio-video';
import { FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash, FaPhoneSlash, FaUserCircle } from 'react-icons/fa';
import './css/VideoCall.css';
import { getApiUrl } from '../config/api';

console.log('Render VideoCall component');

const VideoCall = ({
  isOpen,
  onClose,
  identity,
  isCreator = false,
  roomName: initialRoomName,
  localName = "Bạn",
  remoteName = "Đối phương",
  localAvatar,
  remoteAvatar
}) => {
  console.log('VideoCall props:', { isOpen, identity, isCreator, initialRoomName });
  const [room, setRoom] = useState(null);
  const [localTracks, setLocalTracks] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [remoteConnected, setRemoteConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(null);
  const [roomName, setRoomName] = useState(initialRoomName || '');

  const localMediaRef = useRef();
  const remoteMediaRef = useRef();

  // Tự động lấy token và tạo phòng nếu là creator
  useEffect(() => {
    console.log('useEffect lấy token/room', { isOpen, isCreator, identity });
    if (!isOpen) return;
    let cancelled = false;
    const fetchTokenAndRoom = async () => {
      try {
        setError(null);
        setConnecting(true);
        let name = roomName;
        const apiUrl = getApiUrl();
        // Nếu là creator và chưa có roomName, tạo phòng
        if (isCreator && !name) {
          const res = await fetch(`${apiUrl}/video-call/rooms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomName: `room_${Date.now()}` })
          });
          if (!res.ok) {
            throw new Error(`Failed to create room: ${res.status}`);
          }
          const data = await res.json();
          name = data.room?.uniqueName || `room_${Date.now()}`;
          setRoomName(name);
          console.log('Đã tạo phòng:', name);
        }
        // Lấy token
        const res2 = await fetch(`${apiUrl}/video-call/token?identity=${encodeURIComponent(identity || ('user_' + Math.floor(Math.random() * 10000)))}`);
        if (!res2.ok) {
          throw new Error(`Failed to get token: ${res2.status}`);
        }
        const data2 = await res2.json();
        if (!cancelled) {
          setToken(data2.token);
          if (!roomName && name) setRoomName(name);
          console.log('Đã lấy token:', data2.token);
        }
      } catch (err) {
        setError('Không thể lấy token hoặc tạo phòng: ' + err.message);
        setConnecting(false);
        console.error('Lỗi lấy token/room:', err);
      }
    };
    fetchTokenAndRoom();
    return () => { cancelled = true; };
  }, [isOpen, isCreator, identity]);

  useEffect(() => {
    console.log('useEffect connect Twilio', { isOpen, token, roomName });
    if (!isOpen || !token || !roomName) return;
    let currentRoom;

    const connectToRoom = async () => {
      try {
        setConnecting(true);
        setError(null);
        console.log('Bắt đầu connect Twilio room:', { token, roomName });

        // Kết nối vào phòng
        currentRoom = await Video.connect(token, { name: roomName });
        setRoom(currentRoom);
        console.log('Đã connect vào room:', currentRoom);

        // Tạo local tracks
        let tracks = [];
        try {
          tracks = await Video.createLocalTracks({
            audio: true,
            video: { width: 640 }
          });
          setLocalTracks(tracks);
          console.log('Local tracks:', tracks);
          const hasVideoTrack = tracks.some(
            t =>
              (t.kind && t.kind.toLowerCase() === 'video') ||
              (t.mediaStreamTrack && t.mediaStreamTrack.kind && t.mediaStreamTrack.kind.toLowerCase() === 'video')
          );
          
          if (!hasVideoTrack) {
            console.warn('Không có video track trong localTracks:', tracks);
          }
          
          
        } catch (err) {
          console.error('Lỗi khi lấy local tracks:', err);
          setError('Không truy cập được camera: ' + err.message);
          setLocalTracks([]);
          return;
        }

        // Xử lý khi có người tham gia
        const handleParticipant = participant => {
          setRemoteConnected(true);
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

        // Xử lý người tham gia hiện tại
        currentRoom.participants.forEach(handleParticipant);
        currentRoom.on('participantConnected', handleParticipant);
        currentRoom.on('participantDisconnected', () => {
          setRemoteConnected(false);
          if (remoteMediaRef.current) {
            remoteMediaRef.current.innerHTML = '';
          }
        });

        // Xử lý khi ngắt kết nối
        currentRoom.on('disconnected', () => {
          setRemoteConnected(false);
          setConnecting(false);
          handleEndCall();
        });

        setConnecting(false);
      } catch (err) {
        console.error('Error connecting to room:', err);
        setError('Không thể kết nối đến cuộc gọi. Vui lòng thử lại.');
        setConnecting(false);
      }
    };

    connectToRoom();

    return () => {
      if (currentRoom) {
        console.log('Cleanup: disconnect room');
        currentRoom.disconnect();
      }
      if (localMediaRef.current) {
        console.log('Cleanup: clear localMediaRef');
        localMediaRef.current.innerHTML = '';
      }
      if (remoteMediaRef.current) {
        console.log('Cleanup: clear remoteMediaRef');
        remoteMediaRef.current.innerHTML = '';
      }
    };
  }, [isOpen, token, roomName]);

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

  const toggleMute = () => {
    localTracks.forEach(track => {
      if (track.kind === 'audio') {
        track.isEnabled ? track.disable() : track.enable();
      }
    });
    setIsMuted(!isMuted);
  };

  const toggleCamera = () => {
    localTracks.forEach(track => {
      const isVideo = track.kind === 'video' || (track.mediaStreamTrack && track.mediaStreamTrack.kind === 'video');
      if (isVideo) {
        if (track.isEnabled) {
          track.disable();
          if (track.stop) track.stop(); // Tắt hẳn camera
        } else {
          // Đã stop thì không enable lại được, cần recreate track
          // Có thể thêm logic tạo lại local track nếu muốn bật lại camera
          console.warn('Track đã bị stop, cần tạo lại local track để bật lại camera');
        }
      }
    });
    setIsCameraOff(!isCameraOff);
  };

  const handleEndCall = () => {
    if (room) {
      room.disconnect();
      setRoom(null);
    }
    if (localMediaRef.current) {
      localMediaRef.current.innerHTML = '';
    }
    if (remoteMediaRef.current) {
      remoteMediaRef.current.innerHTML = '';
    }
    onClose();
  };

  // Thêm useEffect mới để attach local video track
  useEffect(() => {
    if (!localTracks.length || !localMediaRef.current) return;
    localMediaRef.current.innerHTML = '';
    const videoTrack = localTracks.find(
      t =>
        (t.kind && t.kind.toLowerCase() === 'video') ||
        (t.mediaStreamTrack && t.mediaStreamTrack.kind && t.mediaStreamTrack.kind.toLowerCase() === 'video')
    );
    if (videoTrack) {
      try {
        const videoElement = videoTrack.attach();
        videoElement.style.width = '100%';
        videoElement.style.height = '100%';
        videoElement.autoplay = true;
        videoElement.muted = true;
        localMediaRef.current.appendChild(videoElement);
        console.log('Đã attach video track (useEffect):', videoTrack, videoElement);
        console.log('localMediaRef.current innerHTML:', localMediaRef.current.innerHTML);
        console.log('localMediaRef.current children:', localMediaRef.current.children);
        setTimeout(() => {
          console.log('videoElement.srcObject:', videoElement.srcObject);
          console.log('videoElement.readyState:', videoElement.readyState);
        }, 1000);
      } catch (err) {
        console.error('Lỗi khi attach video track (useEffect):', err, videoTrack);
      }
    } else {
      console.warn('Không tìm thấy video track trong localTracks (useEffect):', localTracks);
    }
  }, [localTracks]);

  if (!isOpen) return null;

  return (
    <div className="video-call-container">
      <div className="video-call-content">
        <div className="video-call-header">
          <h3>Cuộc gọi video với {remoteName}</h3>
        </div>

        <div className="video-grid">
          {/* Remote video */}
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
            {/* Local video always overlays at bottom right */}
            <div className="local-video-container">
              {localTracks.length === 0 || error ? (
                <div className="video-placeholder small">
                  {localAvatar ? (
                    <img src={localAvatar} alt="avatar" />
                  ) : (
                    <FaUserCircle size={40} />
                  )}
                  <div>{error ? 'Không truy cập được camera' : 'Đang khởi tạo camera...'}</div>
                </div>
              ) : (
                <div ref={localMediaRef}></div>
              )}
              {isCameraOff && localTracks.length > 0 && !error && (
                <div className="video-placeholder small">
                  {localAvatar ? (
                    <img src={localAvatar} alt="avatar" />
                  ) : (
                    <FaUserCircle size={40} />
                  )}
                  <div>Đã tắt camera</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
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

        {/* Status */}
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