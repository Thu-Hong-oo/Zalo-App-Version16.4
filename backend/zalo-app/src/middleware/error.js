const { logger } = require('../utils/logger');
const multer = require('multer');

const errorHandler = (err, req, res, next) => {
    logger.error('Error:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    });

    // Handle multer errors
    if (err instanceof multer.MulterError) {
        return res.status(400).json({
            status: 'error',
            message: 'File upload error',
            error: err.message
        });
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            status: 'error',
            message: 'Invalid token'
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            status: 'error',
            message: 'Token expired'
        });
    }

    // Handle validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            status: 'error',
            message: err.message
        });
    }

    // Handle file upload errors
    if (err.message === 'Unexpected end of form') {
        return res.status(400).json({
            status: 'error',
            message: 'File upload was interrupted or incomplete'
        });
    }

    // Default error
    res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
};

module.exports = { errorHandler }; 