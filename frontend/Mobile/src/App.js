import { SocketProvider } from './context/SocketContext';

const handleCallOffer = useCallback((data) => {
  const { offer, callerId, callId } = data;
  // Xử lý khi nhận được offer từ người gọi
  if (socket) {
    socket.emit('video-call-answer', {
      callerId,
      answer: peerConnection.current.localDescription,
      callId,
    });
  }
}, [socket]);

const handleCallAnswer = useCallback((data) => {
  const { answer } = data;
  // Xử lý khi nhận được answer từ người nhận
  if (peerConnection.current) {
    peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
  }
}, []);

const handleCallIceCandidate = useCallback((data) => {
  const { candidate } = data;
  // Xử lý khi nhận được ICE candidate
  if (peerConnection.current) {
    peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
  }
}, []);

const handleCallEnd = useCallback(() => {
  // Xử lý khi cuộc gọi kết thúc
  if (peerConnection.current) {
    peerConnection.current.close();
  }
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
}, [localStream]);

useEffect(() => {
  if (socket) {
    socket.on('video-call-offer', handleCallOffer);
    socket.on('video-call-answer', handleCallAnswer);
    socket.on('ice-candidate', handleCallIceCandidate);
    socket.on('video-call-ended', handleCallEnd);

    return () => {
      socket.off('video-call-offer', handleCallOffer);
      socket.off('video-call-answer', handleCallAnswer);
      socket.off('ice-candidate', handleCallIceCandidate);
      socket.off('video-call-ended', handleCallEnd);
    };
  }
}, [socket, handleCallOffer, handleCallAnswer, handleCallIceCandidate, handleCallEnd]);

return (
  <SocketProvider>
    {/* ... existing code ... */}
  </SocketProvider>
); 