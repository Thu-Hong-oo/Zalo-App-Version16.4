const express = require('express');
const router = express.Router();
const userRoutes = require('../user/routes');
const authRoutes = require('../auth/routes');

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Mount user routes
router.use('/users', userRoutes);

// Mount auth routes
router.use('/auth', authRoutes);

module.exports = router; 