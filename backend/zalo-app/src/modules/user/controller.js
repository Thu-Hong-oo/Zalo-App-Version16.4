const User = require('./model');
const { s3 } = require('../../config/aws');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const winston = require('winston');
const path = require('path');
const fs = require('fs');
const AWS = require('aws-sdk');

// // Create logger instance
// const logger = winston.createLogger({
//     level: 'info',
//     format: winston.format.combine(
//         winston.format.timestamp(),
//         winston.format.json()
//     ),
//     transports: [
//         new winston.transports.File({ filename: 'error.log', level: 'error' }),
//         new winston.transports.File({ filename: 'combined.log' })
//     ]
// });

// if (process.env.NODE_ENV !== 'production') {
//     logger.add(new winston.transports.Console({
//         format: winston.format.combine(
//             winston.format.colorize(),
//             winston.format.simple()
//         )
//     }));
// }

// Define updateAvatar function separately
const updateAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                status: 'error',
                message: 'Không tìm thấy file ảnh'
            });
        }

        const { phone } = req.user;
        
        // Get current user
        const currentUser = await User.getByPhone(phone);
        if (!currentUser) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng' });
        }

        // Lấy thông tin file
        const file = req.file;
        console.log('Received file:', {
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size
        });

        // Upload to S3
        const filepath = `avatars/${phone}_${Date.now()}${path.extname(file.originalname)}`;
        const s3Response = await s3.upload({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: filepath,
            Body: file.buffer,
            ContentType: file.mimetype,
        }).promise();

        console.log('S3 upload result:', s3Response);

        // Cập nhật avatar mới trong database
        const updatedUser = await User.update(currentUser.userId, { 
            avatar: s3Response.Location 
        });

        if (!updatedUser) {
            return res.status(500).json({
                status: 'error',
                message: 'Không thể cập nhật avatar'
            });
        }

        return res.json({
            status: 'success',
            message: 'Cập nhật avatar thành công',
            avatarUrl: s3Response.Location
        });
    } catch (error) {
        console.error('Update avatar error:', error);
        return res.status(500).json({
            status: 'error', 
            message: 'Lỗi khi cập nhật avatar',
            error: error.message
        });
    }
};

const getProfile = async (req, res) => {
    try {
        const { phone } = req.user;
        const user = await User.getByPhone(phone);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateProfile = async (req, res) => {
    try {
        const { phone } = req.user;
        const updateData = { ...req.body };

        // Get current user
        const currentUser = await User.getByPhone(phone);
        if (!currentUser) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng' });
        }

        // Convert phoneNumber to phone if exists
        if (updateData.phoneNumber) {
            updateData.phone = updateData.phoneNumber;
            delete updateData.phoneNumber;
        }

        // Remove fields that shouldn't be updated
        delete updateData.userId;
        delete updateData.createdAt;
        delete updateData.updatedAt;

        console.log('Updating user with data:', updateData);

        // Use userId for update
        const updatedUser = await User.update(currentUser.userId, updateData);

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Convert phone to phoneNumber in response
        const userResponse = {
            ...updatedUser,
            phoneNumber: updatedUser.phone
        };
        delete userResponse.password;
        delete userResponse.phone;

        res.json(userResponse);
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ message: error.message });
    }
};

const searchUsers = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ message: 'Search query is required' });
        }

        const users = await User.searchUsers(query);
        
        // Remove passwords from results
        const usersWithoutPasswords = users.map(user => {
            const { password, ...userWithoutPassword } = user;
            return userWithoutPassword;
        });

        res.json(usersWithoutPasswords);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getUserByPhone = async (req, res) => {
    try {
        const { phone } = req.params;
        const user = await User.getByPhone(phone);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateStatus = async (req, res) => {
    try {
        const { phone } = req.user;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ 
                status: 'error',
                message: 'Status is required' 
            });
        }

        // Get current user first
        const currentUser = await User.getByPhone(phone);
        if (!currentUser) {
            return res.status(404).json({ 
                status: 'error',
                message: 'User not found' 
            });
        }

        // Update user status using userId
        const updatedUser = await User.update(currentUser.userId, { status });

        if (!updatedUser) {
            return res.status(404).json({ 
                status: 'error',
                message: 'User not found' 
            });
        }

        return res.json({
            status: 'success',
            message: 'Status updated successfully',
            user: updatedUser
        });
    } catch (error) {
        console.error('Update status error:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Error updating status',
            error: error.message
        });
    }
};

const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const { phone } = req.user;

        // Validate input
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                status: 'error',
                message: 'Vui lòng cung cấp mật khẩu hiện tại và mật khẩu mới'
            });
        }

        // Get user from database
        const user = await User.getByPhone(phone);
        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'Không tìm thấy người dùng'
            });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({
                status: 'error',
                message: 'Mật khẩu hiện tại không đúng'
            });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update password using userId
        const updatedUser = await User.update(user.userId, { password: hashedPassword });
        if (!updatedUser) {
            return res.status(500).json({
                status: 'error',
                message: 'Không thể cập nhật mật khẩu'
            });
        }

        res.json({
            status: 'success',
            message: 'Đổi mật khẩu thành công'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Lỗi server',
            error: error.message
        });
    }
};

// Export individual controller methods
const userController = {
    getProfile,
    updateProfile,
    updateAvatar,
    searchUsers,
    getUserByPhone,
    updateStatus,
    changePassword
};

// Debug log
console.log('Exporting userController:', userController);
console.log('Exporting updateAvatar method:', userController.updateAvatar);

module.exports = userController; 