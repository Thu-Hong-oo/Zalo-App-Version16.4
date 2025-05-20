// VideoCallWeb.js
import React, { useEffect, useRef, useState, useContext } from 'react';
import { Phone, Mic, MicOff, Video, VideoOff, X } from 'lucide-react';
import './css/VideoCall.css';
import { SocketContext } from '../App';

const VideoCall = ({ isOpen, onClose, receiverPhone, receiverName }) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [error, setError] = useState(null);
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const peerConnection = useRef();
  const socket = useContext(SocketContext);

  useEffect(() => {
    if (isOpen) {
      initializeCall();
    }
    return () => {
      cleanup();
    };
  }, [isOpen]);

  const initializeCall = async () => {
    try {
      if (!socket) {
        throw new Error('Socket connection not available');
      }

      // Lấy media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

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
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // Xử lý ICE candidates
      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', {
            receiverPhone,
            candidate: event.candidate
          });
        }
      };

      // Tạo và gửi offer
      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);
      
      socket.emit('video-call-offer', {
        receiverPhone,
        offer
      });

      setupSocketListeners();
    } catch (error) {
      console.error('Error initializing call:', error);
      setError(error.message);
      onClose();
    }
  };

  const setupSocketListeners = () => {
    if (!socket) return;

    socket.on('video-call-answer', async ({ answer }) => {
      try {
        if (peerConnection.current) {
          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
        }
      } catch (error) {
        console.error('Error handling answer:', error);
        setError('Error handling call answer');
      }
    });

    socket.on('ice-candidate', async ({ candidate }) => {
      try {
        if (peerConnection.current) {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (error) {
        console.error('Error handling ICE candidate:', error);
        setError('Error handling ICE candidate');
      }
    });

    socket.on('video-call-ended', () => {
      cleanup();
      onClose();
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

  const endCall = () => {
    if (socket) {
      socket.emit('end-video-call', { receiverPhone });
    }
    cleanup();
    onClose();
  };

  const cleanup = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection.current) {
      peerConnection.current.close();
    }
    setLocalStream(null);
    setRemoteStream(null);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="video-call-overlay">
      <div className="video-call-container">
        <div className="video-call-header">
          <h3>Cuộc gọi với {receiverName}</h3>
          <button className="close-button" onClick={endCall}>
            <X size={24} />
          </button>
        </div>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        <div className="video-grid">
          <div className="remote-video-container">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="remote-video"
            />
            {!remoteStream && (
              <div className="waiting-message">
                Đang chờ người dùng tham gia...
              </div>
            )}
          </div>
          
          <div className="local-video-container">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="local-video"
            />
          </div>
        </div>

        <div className="call-controls">
          <button
            className={`control-button ${isMuted ? 'active' : ''}`}
            onClick={toggleMute}
          >
            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
          </button>
          
          <button
            className={`control-button ${isCameraOff ? 'active' : ''}`}
            onClick={toggleCamera}
          >
            {isCameraOff ? <VideoOff size={24} /> : <Video size={24} />}
          </button>
          
          <button
            className="control-button end-call"
            onClick={endCall}
          >
            <Phone size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoCall;