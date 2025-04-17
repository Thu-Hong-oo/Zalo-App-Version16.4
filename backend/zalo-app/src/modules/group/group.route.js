const express = require('express');
const router = express.Router();
const groupController = require('./group.controller');
const auth = require('../../middleware/auth');

// Group routes
router.post('/', auth, groupController.createGroup);
router.get('/:groupId', auth, groupController.getGroup);
router.put('/:groupId', auth, groupController.updateGroup);
router.delete('/:groupId', auth, groupController.deleteGroup);

// Member routes
router.post('/:groupId/members', auth, groupController.addMember);
router.get('/:groupId/members', auth, groupController.getMembers);
router.put('/:groupId/members/:memberId/role', auth, groupController.updateMember);
router.delete('/:groupId/members/:memberId', auth, groupController.removeMember);

// User groups
router.get('/users/:userId/groups', auth, groupController.getUserGroups);

// Message read status
router.put('/:groupId/members/:memberId/last-read', auth, groupController.updateLastRead);

module.exports = router; 