const { dynamoDB, TABLES } = require('../../config/aws');
const { v4: uuidv4 } = require('uuid');
const userController = require('../user/controller');

class GroupService {
  /**
   * Create a new chat group
   * @param {Object} groupData - Group information
   * @returns {Promise<Object>} Created group
   */
  async createGroup(groupData) {
    const groupId = uuidv4();
    const timestamp = new Date().toISOString();

    // Get members information to generate group name
    const memberPromises = groupData.members.map(async (userId) => {
      const mockRes = {
        json: (data) => data
      };
      try {
        const userData = await userController.getUserByUserId(
          { params: { userId } },
          mockRes
        );
        return userData;
      } catch (error) {
        console.error('Error getting user data:', error);
        return { userId }; // Fallback to using userId if user data not found
      }
    });
    
    const members = await Promise.all(memberPromises);
    console.log('Members data:', members); // Debug log

    // Generate group name from member names (max 3 names)
    const memberNames = members
      .filter(member => member) // Filter out any undefined members
      .map(member => member.name || member.phone)
      .slice(0, 3);
    const defaultGroupName = memberNames.join(', ');

    const params = {
      TableName: TABLES.GROUPS,
      Item: {
        groupId,
        name: defaultGroupName || 'New Group', // Fallback name if no member names available
        description: '',
        createdBy: groupData.createdBy,
        createdAt: timestamp,
        updatedAt: timestamp,
        isActive: true,
        memberCount: 0, // Start with 0, will be updated as members are added
        lastMessageAt: timestamp,
        lastMessage: null
      }
    };

    await dynamoDB.put(params).promise();

    // Add all members to the group
    const memberPromises2 = groupData.members.map(userId => {
      const role = userId === groupData.createdBy ? 'ADMIN' : 'MEMBER';
      return this.addMember(groupId, userId, role);
    });

    await Promise.all(memberPromises2);

    // Get updated group info with correct member count
    return this.getGroupById(groupId);
  }

  /**
   * Get group by ID
   * @param {string} groupId - Group ID
   * @returns {Promise<Object>} Group information
   */
  async getGroupById(groupId) {
    const params = {
      TableName: TABLES.GROUPS,
      Key: { groupId }
    };

    const result = await dynamoDB.get(params).promise();
    if (!result.Item) return null;

    // Get all members information
    const membersResult = await dynamoDB.query({
      TableName: TABLES.GROUP_MEMBERS,
      KeyConditionExpression: 'groupId = :groupId',
      FilterExpression: 'isActive = :isActive',
      ExpressionAttributeValues: {
        ':groupId': groupId,
        ':isActive': true
      }
    }).promise();

    // Get user details for each member
    const memberPromises = membersResult.Items.map(async (member) => {
      const mockRes = {
        json: (data) => data
      };
      try {
        const userData = await userController.getUserByUserId(
          { params: { userId: member.userId } },
          mockRes
        );
        return {
          ...member,
          userDetails: userData
        };
      } catch (error) {
        console.error('Error getting user data:', error);
        return {
          ...member,
          userDetails: { userId: member.userId }
        };
      }
    });

    const membersWithDetails = await Promise.all(memberPromises);

    // Add members info to group
    result.Item.members = membersWithDetails;

    return result.Item;
  }

  /**
   * Update group information
   * @param {string} groupId - Group ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated group
   */
  async updateGroup(groupId, updateData) {
    const timestamp = new Date().toISOString();
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    let updateExpression = 'set ';

    // Process each field in updateData
    Object.entries(updateData).forEach(([key, value]) => {
      if (key !== 'groupId' && key !== 'createdAt' && key !== 'members') {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = value;
      }
    });

    // Add updatedAt
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = timestamp;

    updateExpression += updateExpressions.join(', ');

    const params = {
      TableName: TABLES.GROUPS,
      Key: { groupId },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
  }

  /**
   * Add member to group
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID to add
   * @param {string} role - Member role (ADMIN or MEMBER)
   * @returns {Promise<Object>} Updated group member
   */
  async addMember(groupId, userId, role = 'MEMBER') {
    // Ensure groupId and userId are strings
    if (typeof groupId !== 'string') {
      throw new Error('groupId must be a string');
    }
    if (typeof userId !== 'string') {
      throw new Error('userId must be a string');
    }

    // Check if member already exists
    const existingMember = await dynamoDB.get({
      TableName: TABLES.GROUP_MEMBERS,
      Key: {
        groupId: groupId.toString(),
        userId: userId.toString()
      }
    }).promise();

    // If member exists and is active, don't add again
    if (existingMember.Item && existingMember.Item.isActive) {
      return existingMember.Item;
    }

    // If member exists but inactive, reactivate them
    if (existingMember.Item) {
      const params = {
        TableName: TABLES.GROUP_MEMBERS,
        Key: {
          groupId: groupId.toString(),
          userId: userId.toString()
        },
        UpdateExpression: 'set isActive = :isActive, updatedAt = :updatedAt, role = :role',
        ExpressionAttributeValues: {
          ':isActive': true,
          ':updatedAt': new Date().toISOString(),
          ':role': role
        },
        ReturnValues: 'ALL_NEW'
      };

      const result = await dynamoDB.update(params).promise();
      await this.updateMemberCount(groupId, 1);
      return result.Attributes;
    }

    // Add new member
    const timestamp = new Date().toISOString();
    const params = {
      TableName: TABLES.GROUP_MEMBERS,
      Item: {
        groupId: groupId.toString(),
        userId: userId.toString(),
        role,
        joinedAt: timestamp,
        updatedAt: timestamp,
        isActive: true,
        lastReadAt: timestamp
      }
    };

    await dynamoDB.put(params).promise();
    await this.updateMemberCount(groupId, 1);
    return params.Item;
  }

  /**
   * Remove member from group
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID to remove
   * @returns {Promise<Object>} Updated group
   */
  async removeMember(groupId, userId) {
    // First get the current group to find the index of the user
    const group = await this.getGroupById(groupId);
    const memberIndex = group.members.indexOf(userId);
    
    if (memberIndex === -1) {
      throw new Error('User is not a member of this group');
    }

    const params = {
      TableName: TABLES.GROUPS,
      Key: { groupId },
      UpdateExpression: `REMOVE members[${memberIndex}] SET updatedAt = :updatedAt`,
      ExpressionAttributeValues: {
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
  }

  /**
   * List all groups where user is a member
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of groups
   */
  async getUserGroups(userId) {
    try {
      // Get all group memberships for the user
      const membershipParams = {
        TableName: TABLES.GROUP_MEMBERS,
        IndexName: 'userId-index',
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: 'isActive = :isActive',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':isActive': true
        }
      };

      console.log('Fetching memberships for user:', userId);
      const memberships = await dynamoDB.query(membershipParams).promise();
      
      if (!memberships.Items || memberships.Items.length === 0) {
        console.log('No groups found for user:', userId);
        return [];
      }

      // Get details for each group
      const groupPromises = memberships.Items.map(async (membership) => {
        const group = await this.getGroupById(membership.groupId);
        if (group && group.isActive) {
          return {
            ...group,
            memberRole: membership.role,
            lastReadAt: membership.lastReadAt
          };
        }
        return null;
      });

      const groups = await Promise.all(groupPromises);

      // Filter out null values and sort by lastMessageAt
      return groups
        .filter(group => group !== null)
        .sort((a, b) => {
          const timeA = new Date(a.lastMessageAt || a.createdAt);
          const timeB = new Date(b.lastMessageAt || b.createdAt);
          return timeB - timeA;
        });
    } catch (error) {
      console.error('Error in getUserGroups:', error);
      throw error;
    }
  }

  /**
   * Delete group (hard delete)
   * @param {string} groupId - Group ID
   * @returns {Promise<void>}
   */
  async deleteGroup(groupId) {
    // 1. Delete all members from GROUP_MEMBERS table
    const membersResult = await dynamoDB.query({
      TableName: TABLES.GROUP_MEMBERS,
      KeyConditionExpression: 'groupId = :groupId',
      ExpressionAttributeValues: {
        ':groupId': groupId
      }
    }).promise();

    // Delete each member entry
    const memberDeletions = membersResult.Items.map(member => {
      return dynamoDB.delete({
        TableName: TABLES.GROUP_MEMBERS,
        Key: {
          groupId: member.groupId,
          userId: member.userId
        }
      }).promise();
    });

    // Wait for all member deletions to complete
    await Promise.all(memberDeletions);

    // 2. Delete the group from GROUPS table
    await dynamoDB.delete({
      TableName: TABLES.GROUPS,
      Key: { groupId }
    }).promise();
  }

  /**
   * Update last message in group
   * @param {string} groupId - Group ID
   * @param {Object} messageData - Message data
   * @returns {Promise<Object>} Updated group
   */
  async updateLastMessage(groupId, messageData) {
    const timestamp = new Date().toISOString();

    const params = {
      TableName: TABLES.GROUPS,
      Key: { groupId },
      UpdateExpression: 'set lastMessage = :lastMessage, lastMessageAt = :lastMessageAt, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':lastMessage': messageData,
        ':lastMessageAt': timestamp,
        ':updatedAt': timestamp
      },
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
  }

  /**
   * Update member count
   * @param {string} groupId - Group ID
   * @param {number} change - Change in member count (+1 or -1)
   * @returns {Promise<Object>} Updated group
   */
  async updateMemberCount(groupId, change) {
    const params = {
      TableName: TABLES.GROUPS,
      Key: { groupId },
      UpdateExpression: 'set memberCount = memberCount + :change, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':change': change,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
  }

  /**
   * Sync member count for a group
   * @param {string} groupId - Group ID
   * @returns {Promise<Object>} Updated group
   */
  async syncMemberCount(groupId) {
    // Get active members count
    const membersResult = await dynamoDB.query({
      TableName: TABLES.GROUP_MEMBERS,
      KeyConditionExpression: 'groupId = :groupId',
      FilterExpression: 'isActive = :isActive',
      ExpressionAttributeValues: {
        ':groupId': groupId,
        ':isActive': true
      }
    }).promise();

    const actualCount = membersResult.Items.length;

    // Update group with correct count
    const params = {
      TableName: TABLES.GROUPS,
      Key: { groupId },
      UpdateExpression: 'set memberCount = :count, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':count': actualCount,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
  }
}

module.exports = new GroupService(); 