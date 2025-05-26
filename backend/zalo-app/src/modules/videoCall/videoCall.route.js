const express = require('express');
require('dotenv').config();
const router = express.Router();
const twilio = require('twilio');

const AccessToken = twilio.jwt.AccessToken;
const VideoGrant = AccessToken.VideoGrant;
// Route cấp token Twilio Video
router.get('/token', (req, res) => {
  const identity = req.query.identity || 'user_' + Math.floor(Math.random() * 10000);
  const token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_API_KEY,
    process.env.TWILIO_API_SECRET,
    { identity }
  );
  const videoGrant = new VideoGrant();
  token.addGrant(videoGrant);
  res.json({ token: token.toJwt() });
});

// Route tạo phòng video call mới
router.post('/rooms', async (req, res) => {
  try {
    const { roomName } = req.body;
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_API_KEY
    );

    const room = await client.video.rooms.create({
      uniqueName: roomName,
      type: 'go',
      recordParticipantsOnConnect: false
    });

    res.json({ room });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Route lấy danh sách phòng đang hoạt động
router.get('/rooms', async (req, res) => {
  try {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_API_KEY
    );

    const rooms = await client.video.rooms.list({ status: 'in-progress' });
    res.json({ rooms });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// Route lấy thông tin phòng cụ thể
router.get('/rooms/:roomName', async (req, res) => {
  try {
    const { roomName } = req.params;
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_API_KEY
    );

    const room = await client.video.rooms(roomName).fetch();
    res.json({ room });
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// Route kết thúc phòng video call
router.post('/rooms/:roomName/end', async (req, res) => {
  try {
    const { roomName } = req.params;
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_API_KEY
    );

    await client.video.rooms(roomName).update({ status: 'completed' });
    res.json({ message: 'Room ended successfully' });
  } catch (error) {
    console.error('Error ending room:', error);
    res.status(500).json({ error: 'Failed to end room' });
  }
});

// ... existing code ...

module.exports = router;