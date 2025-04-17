const { dynamoDB, TABLES } = require('../../config/aws');
const { v4: uuidv4 } = require('uuid');

class GroupService {
  /**
   * Create a new chat group
   * @param {Object} groupData - Group information
   * @returns {Promise<Object>} Created group
   */
  async createGroup(groupData) {
    const groupId = uuidv4();
    const timestamp = new Date().toISOString();

    const params = {
      TableName: TABLES.GROUPS,
      Item: {
        groupId,
        name: groupData.name,
        description: groupData.description || '',
        createdBy: groupData.createdBy,
        createdAt: timestamp,
        updatedAt: timestamp,
        isActive: true
      }
    };

    await dynamoDB.put(params).promise();
    return params.Item;
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
    const expressionAttributeValues = {};

    Object.keys(updateData).forEach(key => {
      if (key !== 'groupId') {
        updateExpressions.push(`${key} = :${key}`);
        expressionAttributeValues[`:${key}`] = updateData[key];
      }
    });

    updateExpressions.push('updatedAt = :updatedAt');
    expressionAttributeValues[':updatedAt'] = timestamp;

    const params = {
      TableName: TABLES.GROUPS,
      Key: { groupId },
      UpdateExpression: `set ${updateExpressions.join(', ')}`,
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
   * @returns {Promise<Object>} Updated group
   */
  async addMember(groupId, userId) {
    const params = {
      TableName: TABLES.GROUPS,
      Key: { groupId },
      UpdateExpression: 'set members = list_append(members, :userId), updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':userId': [userId],
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
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
    const params = {
      TableName: TABLES.GROUP_MEMBERS,
      IndexName: 'userId-index',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    };

    const result = await dynamoDB.query(params).promise();
    const groupIds = result.Items.map(item => item.groupId);
    
    if (groupIds.length === 0) {
      return [];
    }

    const batchGetParams = {
      RequestItems: {
        [TABLES.GROUPS]: {
          Keys: groupIds.map(groupId => ({ groupId }))
        }
      }
    };

    const groupsResult = await dynamoDB.batchGet(batchGetParams).promise();
    return groupsResult.Responses[TABLES.GROUPS];
  }

  /**
   * Delete group (soft delete)
   * @param {string} groupId - Group ID
   * @returns {Promise<Object>} Deleted group
   */
  async deleteGroup(groupId) {
    const params = {
      TableName: TABLES.GROUPS,
      Key: { groupId },
      UpdateExpression: 'set isActive = :isActive, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':isActive': false,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
  }
}

module.exports = new GroupService(); 