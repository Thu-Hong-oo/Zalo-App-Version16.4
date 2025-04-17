const { dynamoDB, TABLES } = require('../../config/aws');
const groupService = require('./groupService');

const MEMBER_ROLES = {
  ADMIN: 'ADMIN',     // Trưởng nhóm
  DEPUTY: 'DEPUTY',   // Phó nhóm
  MEMBER: 'MEMBER'    // Thành viên
};

const MEMBER_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  BANNED: 'BANNED'
};

class GroupMemberService {
  /**
   * Add member to group
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID
   * @param {string} role - Member role (ADMIN or MEMBER)
   * @returns {Promise<Object>} Group member information
   */
  async addMember(groupId, userId, role = 'MEMBER') {
    const timestamp = new Date().toISOString();

    const params = {
      TableName: TABLES.GROUP_MEMBERS,
      Item: {
        groupId,
        userId,
        role,
        joinedAt: timestamp,
        updatedAt: timestamp,
        isActive: true,
        lastReadAt: timestamp
      },
      ConditionExpression: 'attribute_not_exists(groupId) AND attribute_not_exists(userId)'
    };

    await dynamoDB.put(params).promise();
    await groupService.updateMemberCount(groupId, 1);
    return params.Item;
  }

  /**
   * Remove member from group
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async removeMember(groupId, userId) {
    // First check if member exists and is active
    const currentMember = await this.getMember(groupId, userId);
    if (!currentMember || !currentMember.isActive) {
      throw new Error('Member not found or already removed');
    }

    // Delete member from GROUP_MEMBERS table
    const deleteParams = {
      TableName: TABLES.GROUP_MEMBERS,
      Key: {
        groupId,
        userId
      }
    };

    await dynamoDB.delete(deleteParams).promise();

    // Update group's member count
    await groupService.updateMemberCount(groupId, -1);
  }

  /**
   * Get group members
   * @param {string} groupId - Group ID
   * @returns {Promise<Array>} List of group members
   */
  async getGroupMembers(groupId) {
    const params = {
      TableName: TABLES.GROUP_MEMBERS,
      KeyConditionExpression: 'groupId = :groupId',
      FilterExpression: 'isActive = :isActive',
      ExpressionAttributeValues: {
        ':groupId': groupId,
        ':isActive': true
      }
    };

    const result = await dynamoDB.query(params).promise();
    return result.Items;
  }

  /**
   * Check if user is member of group
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if user is member
   */
  async isMember(groupId, userId) {
    const params = {
      TableName: TABLES.GROUP_MEMBERS,
      Key: {
        groupId,
        userId
      }
    };

    const result = await dynamoDB.get(params).promise();
    return result.Item && result.Item.isActive === true;
  }

  /**
   * Update member role
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID
   * @param {string} role - New role
   * @returns {Promise<Object>} Updated member information
   */
  async updateRole(groupId, userId, role) {
    const params = {
      TableName: TABLES.GROUP_MEMBERS,
      Key: {
        groupId,
        userId
      },
      UpdateExpression: 'set #role = :role, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#role': 'role'
      },
      ExpressionAttributeValues: {
        ':role': role,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
  }

  /**
   * Update last read timestamp
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated member information
   */
  async updateLastRead(groupId, userId) {
    const params = {
      TableName: TABLES.GROUP_MEMBERS,
      Key: {
        groupId,
        userId
      },
      UpdateExpression: 'set lastReadAt = :lastReadAt, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':lastReadAt': new Date().toISOString(),
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
  }

  /**
   * Get member by group ID and user ID
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Member information
   */
  async getMember(groupId, userId) {
    const params = {
      TableName: TABLES.GROUP_MEMBERS,
      Key: {
        groupId,
        userId
      }
    };

    const result = await dynamoDB.get(params).promise();
    return result.Item;
  }

  /**
   * Update member information
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated member
   */
  async updateMember(groupId, userId, updateData) {
    const timestamp = new Date().toISOString();
    const updateExpressions = [];
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};

    Object.keys(updateData).forEach(key => {
      if (key !== 'groupId' && key !== 'userId') {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = updateData[key];
      }
    });

    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = timestamp;

    const params = {
      TableName: TABLES.GROUP_MEMBERS,
      Key: { groupId, userId },
      UpdateExpression: `set ${updateExpressions.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
  }

  /**
   * Get members by role
   * @param {string} groupId - Group ID
   * @param {string} role - Member role
   * @returns {Promise<Array>} List of members
   */
  async getMembersByRole(groupId, role) {
    const params = {
      TableName: TABLES.GROUP_MEMBERS,
      IndexName: 'role-index',
      KeyConditionExpression: 'groupId = :groupId AND role = :role',
      ExpressionAttributeValues: {
        ':groupId': groupId,
        ':role': role
      }
    };

    const result = await dynamoDB.query(params).promise();
    return result.Items;
  }

  /**
   * Update member's last active timestamp
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated member
   */
  async updateLastActive(groupId, userId) {
    const timestamp = new Date().toISOString();
    const params = {
      TableName: TABLES.GROUP_MEMBERS,
      Key: { groupId, userId },
      UpdateExpression: 'set lastActiveAt = :lastActiveAt, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':lastActiveAt': timestamp,
        ':updatedAt': timestamp
      },
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
  }
}

module.exports = {
  GroupMemberService: new GroupMemberService(),
  MEMBER_ROLES,
  MEMBER_STATUS
}; 