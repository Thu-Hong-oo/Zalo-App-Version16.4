const express = require('express');
const router = express.Router();
const groupController = require('../modules/group/group.controller');
const auth = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(auth);

// Get current user's groups
router.get('/my-groups', groupController.getUserGroups);

// Create new group
router.post('/', groupController.createGroup);

// Get group by ID
router.get('/:groupId', groupController.getGroup);

// Update group
router.put('/:groupId', groupController.updateGroup);

// Delete group
router.delete('/:groupId', groupController.deleteGroup);

// Add member to group
router.post('/:groupId/members', groupController.addMember);

// Get group members
router.get('/:groupId/members', groupController.getMembers);

// Update member role
router.put('/:groupId/members/:memberId', groupController.updateMember);

// Remove member from group
router.delete('/:groupId/members/:memberId', groupController.removeMember);

// Update last read timestamp
router.put('/:groupId/members/:memberId/last-read', groupController.updateLastRead);

module.exports = router; 