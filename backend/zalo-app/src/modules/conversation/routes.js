const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/auth');

// TODO: Implement conversation routes
router.get('/', authMiddleware, (req, res) => {
    res.json({ message: 'Conversation routes not implemented yet' });
});

module.exports = router; 