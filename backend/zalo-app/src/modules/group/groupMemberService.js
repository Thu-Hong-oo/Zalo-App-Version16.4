const { dynamoDB, TABLES } = require('../../config/aws');

const MEMBER_ROLES = {
  ADMIN: 'ADMIN',
  MODERATOR: 'MODERATOR',
  MEMBER: 'MEMBER'
};

const MEMBER_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  BANNED: 'BANNED'
};

class GroupMemberService {
  /**
   * Add member to group with role
   * @param {Object} memberData - Member information
   * @returns {Promise<Object>} Created member entry
   */
  async addMember(memberData) {
    const timestamp = new Date().toISOString();
    const params = {
      TableName: TABLES.GROUP_MEMBERS,
      Item: {
        groupId: memberData.groupId,
        userId: memberData.userId,
        role: memberData.role || MEMBER_ROLES.MEMBER,
        joinedAt: timestamp,
        updatedAt: timestamp,
        addedBy: memberData.addedBy,
        status: MEMBER_STATUS.ACTIVE,
        nickname: memberData.nickname || '',
        lastReadTimestamp: timestamp,
        lastActiveAt: timestamp
      }
    };

    await dynamoDB.put(params).promise();
    return params.Item;
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

    Object.keys(updateData).forEach(key => {
      if (key !== 'groupId' && key !== 'userId') {
        updateExpressions.push(`${key} = :${key}`);
        expressionAttributeValues[`:${key}`] = updateData[key];
      }
    });

    updateExpressions.push('updatedAt = :updatedAt');
    expressionAttributeValues[':updatedAt'] = timestamp;

    const params = {
      TableName: TABLES.GROUP_MEMBERS,
      Key: { groupId, userId },
      UpdateExpression: `set ${updateExpressions.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
  }

  /**
   * Remove member from group
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async removeMember(groupId, userId) {
    const params = {
      TableName: TABLES.GROUP_MEMBERS,
      Key: { groupId, userId }
    };

    await dynamoDB.delete(params).promise();
  }

  /**
   * List all members in a group
   * @param {string} groupId - Group ID
   * @returns {Promise<Array>} List of members
   */
  async getGroupMembers(groupId) {
    const params = {
      TableName: TABLES.GROUP_MEMBERS,
      KeyConditionExpression: 'groupId = :groupId',
      ExpressionAttributeValues: {
        ':groupId': groupId
      }
    };

    const result = await dynamoDB.query(params).promise();
    return result.Items;
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

  /**
   * Update member's last read timestamp
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID
   * @param {string} timestamp - Last read timestamp
   * @returns {Promise<Object>} Updated member
   */
  async updateLastRead(groupId, userId, timestamp) {
    const params = {
      TableName: TABLES.GROUP_MEMBERS,
      Key: { groupId, userId },
      UpdateExpression: 'set lastReadTimestamp = :lastReadTimestamp, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':lastReadTimestamp': timestamp,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
  }

  /**
   * Check if user has required role in group
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID
   * @param {Array<string>} requiredRoles - Array of required roles
   * @returns {Promise<boolean>} Whether user has required role
   */
  async hasRole(groupId, userId, requiredRoles) {
    const member = await this.getMember(groupId, userId);
    if (!member || !member.isActive) return false;
    return requiredRoles.includes(member.role);
  }
}

module.exports = {
  GroupMemberService: new GroupMemberService(),
  MEMBER_ROLES,
  MEMBER_STATUS
}; 