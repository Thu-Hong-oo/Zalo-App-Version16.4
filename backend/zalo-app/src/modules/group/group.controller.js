const { groupService, GroupMemberService, MEMBER_ROLES } = require('./index');
const { createGroupSchema, updateGroupSchema, addMemberSchema, updateMemberSchema } = require('./group.validator');
const { GROUP_EVENTS } = require('./group.model');
const { emitEvent } = require('../events');

class GroupController {
  /**
   * Get user's groups
   */
  async getUserGroups(req, res) {
    try {
      const userId = req.user.userId; // Lấy userId từ token
      console.log('Getting groups for user:', userId);
      
      const groups = await groupService.getUserGroups(userId);
      console.log('Found groups:', groups.length);
      
      res.json(groups);
    } catch (error) {
      console.error('Error getting user groups:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Create a new group
   */
  async createGroup(req, res) {
    try {
      const { error } = createGroupSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      console.log('Creating group with request body:', req.body); // Debug log

      // Create group with members and name
      const group = await groupService.createGroup({
        members: req.body.members,
        createdBy: req.body.createdBy,
        name: req.body.name // Explicitly pass the name
      });

      emitEvent(GROUP_EVENTS.CREATED, group);
      res.status(201).json(group);
    } catch (error) {
      console.error('Create group error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get group by ID
   */
  async getGroup(req, res) {
    try {
      const group = await groupService.getGroupById(req.params.groupId);
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }
      res.json(group);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Update group
   */
  async updateGroup(req, res) {
    try {
      const { error } = updateGroupSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const group = await groupService.updateGroup(req.params.groupId, req.body);
      emitEvent(GROUP_EVENTS.UPDATED, group);
      res.json(group);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Delete group (soft delete)
   */
  async deleteGroup(req, res) {
    try {
      const group = await groupService.deleteGroup(req.params.groupId);
      emitEvent(GROUP_EVENTS.DELETED, group);
      res.json({ message: 'Group deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Add member to group
   */
  async addMember(req, res) {
    try {
      const { error } = addMemberSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const member = await GroupMemberService.addMember(
        req.params.groupId,
        req.body.userId,
        req.body.role
      );

      emitEvent(GROUP_EVENTS.MEMBER_ADDED, member);
      res.status(201).json(member);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get group members
   */
  async getMembers(req, res) {
    try {
      const members = await GroupMemberService.getGroupMembers(req.params.groupId);
      res.json(members);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Update member role
   */
  async updateMember(req, res) {
    try {
      const { error } = updateMemberSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const member = await GroupMemberService.updateMember(
        req.params.groupId,
        req.params.memberId,
        req.body
      );

      emitEvent(GROUP_EVENTS.MEMBER_UPDATED, member);
      res.json(member);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Remove member from group
   */
  async removeMember(req, res) {
    try {
      await GroupMemberService.removeMember(req.params.groupId, req.params.memberId);
      emitEvent(GROUP_EVENTS.MEMBER_REMOVED, {
        groupId: req.params.groupId,
        userId: req.params.memberId
      });
      res.json({ message: 'Member removed successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Update last read timestamp
   */
  async updateLastRead(req, res) {
    try {
      const member = await GroupMemberService.updateLastRead(
        req.params.groupId,
        req.params.memberId,
        req.body.timestamp
      );
      res.json(member);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new GroupController(); 