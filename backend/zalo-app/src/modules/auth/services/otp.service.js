const twilio = require('twilio');
const redis = require('redis');
const { promisify } = require('util');
require('dotenv').config();
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const redisClient = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD
});

const getAsync = promisify(redisClient.get).bind(redisClient);
const setAsync = promisify(redisClient.set).bind(redisClient);
const delAsync = promisify(redisClient.del).bind(redisClient);

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendOTP = async (phoneNumber) => {
  try {
    const otp = generateOTP();
    const expirationTime = parseInt(process.env.OTP_EXPIRATION_MINUTES) * 60; // Convert to seconds

    // Store OTP in Redis with expiration
    await setAsync(
      `otp:${phoneNumber}`,
      JSON.stringify({
        code: otp,
        attempts: 0,
        createdAt: new Date().toISOString()
      }),
      'EX',
      expirationTime
    );

    // Send OTP via Twilio
    await client.messages.create({
      body: `Your verification code is: ${otp}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });

    return true;
  } catch (error) {
    console.error('Error sending OTP:', error);
    throw new Error('Failed to send OTP');
  }
};

const verifyOTP = async (phoneNumber, otp) => {
  try {
    const storedData = await getAsync(`otp:${phoneNumber}`);
    if (!storedData) {
      throw new Error('OTP expired or not found');
    }

    const { code, attempts } = JSON.parse(storedData);
    const maxAttempts = parseInt(process.env.OTP_MAX_ATTEMPTS);

    if (attempts >= maxAttempts) {
      await delAsync(`otp:${phoneNumber}`);
      throw new Error('Maximum attempts reached');
    }

    if (code !== otp) {
      // Increment attempts
      const updatedData = JSON.parse(storedData);
      updatedData.attempts += 1;
      await setAsync(
        `otp:${phoneNumber}`,
        JSON.stringify(updatedData),
        'EX',
        parseInt(process.env.OTP_EXPIRATION_MINUTES) * 60
      );
      throw new Error('Invalid OTP');
    }

    // OTP verified successfully, delete it
    await delAsync(`otp:${phoneNumber}`);
    return true;
  } catch (error) {
    console.error('Error verifying OTP:', error);
    throw error;
  }
};

module.exports = {
  sendOTP,
  verifyOTP
}; 