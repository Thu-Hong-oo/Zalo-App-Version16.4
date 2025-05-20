const jwt = require('jsonwebtoken');
const videoCallService = require('./videoCall.service');

const setupVideoCallSocket = (io) => {
  // Middleware xác thực socket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.query.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      console.error('Socket authentication error:', err);
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Handle join video call room
    socket.on('join-video-call', async (data) => {
      try {
        const { userId, receiverPhone } = data;
        
        // Create a unique room name for this call
        const roomName = `call:${userId}:${receiverPhone}`;
        socket.join(roomName);
        
        console.log(`User ${userId} joined room ${roomName}`);

        // Create call record in database
        const call = await videoCallService.createCall(userId, receiverPhone, 'video');
        
        // Notify the receiver
        socket.to(roomName).emit('incoming-call', {
          callId: call._id,
          callerId: userId
        });

      } catch (error) {
        console.error('Error joining video call:', error);
        socket.emit('error', { message: 'Failed to join video call' });
      }
    });

    // Handle ICE candidates
    socket.on('ice-candidate', (data) => {
      const { receiverPhone, candidate } = data;
      const roomName = `call:${socket.user.userId}:${receiverPhone}`;
      socket.to(roomName).emit('ice-candidate', { candidate });
    });

    // Handle video call offer
    socket.on('video-call-offer', (data) => {
      const { receiverPhone, offer } = data;
      const roomName = `call:${socket.user.userId}:${receiverPhone}`;
      socket.to(roomName).emit('video-call-offer', { offer });
    });

    // Handle video call answer
    socket.on('video-call-answer', (data) => {
      const { callerId, answer } = data;
      const roomName = `call:${callerId}:${socket.user.userId}`;
      socket.to(roomName).emit('video-call-answer', { answer });
    });

    // Handle end call
    socket.on('end-video-call', async (data) => {
      try {
        const { receiverPhone } = data;
        const roomName = `call:${socket.user.userId}:${receiverPhone}`;
        
        // Update call status in database
        const calls = await videoCallService.getActiveCalls(socket.user.userId);
        if (calls.length > 0) {
          await videoCallService.endCall(calls[0]._id);
        }

        // Notify other participant
        socket.to(roomName).emit('video-call-ended');
        
        // Leave the room
        socket.leave(roomName);
      } catch (error) {
        console.error('Error ending video call:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
};

module.exports = setupVideoCallSocket; 