// const { dynamoDB, TABLES } = require("../../config/aws");
// const { v4: uuidv4 } = require("uuid");
// const { GroupMemberService } = require("./index");

// class GroupChatService {
//   /**
//    * Send a message to group
//    * @param {Object} messageData - Message information
//    * @returns {Promise<Object>} Created message
//    */
//   async sendMessage(messageData) {
//     const messageId = uuidv4();
//     const timestamp = new Date().toISOString();

//     const params = {
//       TableName: TABLES.GROUP_MESSAGES,
//       Item: {
//         messageId,
//         groupId: messageData.groupId,
//         senderId: messageData.senderId,
//         content: messageData.content,
//         type: messageData.type || "text",
//         createdAt: timestamp,
//         updatedAt: timestamp,
//         isActive: true,
//         metadata: messageData.metadata || {},
//       },
//     };

//     await dynamoDB.put(params).promise();
//     return params.Item;
//   }

//   /**
//    * Get group messages
//    * @param {string} groupId - Group ID
//    * @param {Object} options - Query options
//    * @returns {Promise<Array>} List of messages
//    */
//   async getMessages(groupId, options = {}) {
//     const { limit = 50, lastEvaluatedKey } = options;

//     const params = {
//       TableName: TABLES.GROUP_MESSAGES,
//       KeyConditionExpression: "groupId = :groupId",
//       FilterExpression: "isActive = :isActive",
//       ExpressionAttributeValues: {
//         ":groupId": groupId,
//         ":isActive": true,
//       },
//       Limit: limit,
//       ScanIndexForward: false, // Get latest messages first
//     };

//     if (lastEvaluatedKey) {
//       params.ExclusiveStartKey = lastEvaluatedKey;
//     }

//     const result = await dynamoDB.query(params).promise();
//     return {
//       messages: result.Items,
//       lastEvaluatedKey: result.LastEvaluatedKey,
//     };
//   }

//   /**
//    * Delete message (soft delete)
//    * @param {string} messageId - Message ID
//    * @param {string} senderId - Sender ID
//    * @returns {Promise<Object>} Updated message
//    */
//   async deleteMessage(messageId, senderId) {
//     const params = {
//       TableName: TABLES.GROUP_MESSAGES,
//       Key: { messageId },
//       UpdateExpression: "SET isActive = :isActive, updatedAt = :updatedAt",
//       ConditionExpression: "senderId = :senderId",
//       ExpressionAttributeValues: {
//         ":isActive": false,
//         ":updatedAt": new Date().toISOString(),
//         ":senderId": senderId,
//       },
//       ReturnValues: "ALL_NEW",
//     };

//     const result = await dynamoDB.update(params).promise();
//     return result.Attributes;
//   }

//   /**
//    * Forward message to another group
//    * @param {string} messageId - Original message ID
//    * @param {string} targetGroupId - Target group ID
//    * @param {string} senderId - New sender ID
//    * @returns {Promise<Object>} Forwarded message
//    */
//   async forwardMessage(messageId, targetGroupId, senderId) {
//     const originalMessage = await this.getMessage(messageId);
//     if (!originalMessage) {
//       throw new Error("Message not found");
//     }

//     return this.sendMessage({
//       groupId: targetGroupId,
//       senderId,
//       content: originalMessage.content,
//       type: originalMessage.type,
//       metadata: {
//         ...originalMessage.metadata,
//         forwardedFrom: originalMessage.messageId,
//       },
//     });
//   }

//   /**
//    * Get message by ID
//    * @param {string} messageId - Message ID
//    * @returns {Promise<Object>} Message data
//    */
//   async getMessage(messageId) {
//     const params = {
//       TableName: TABLES.GROUP_MESSAGES,
//       Key: { messageId },
//     };

//     const result = await dynamoDB.get(params).promise();
//     return result.Item;
//   }

//   /**
//    * Check if user has permission to perform action
//    * @param {string} groupId - Group ID
//    * @param {string} userId - User ID
//    * @param {string} action - Action to check
//    * @returns {Promise<boolean>} Whether user has permission
//    */
//   async checkPermission(groupId, userId, action) {
//     const member = await GroupMemberService.getMember(groupId, userId);
//     if (!member || !member.isActive) return false;

//     // Define permission rules based on member role
//     const permissions = {
//       [MEMBER_ROLES.ADMIN]: ["send", "delete", "forward"],
//       [MEMBER_ROLES.MODERATOR]: ["send", "delete", "forward"],
//       [MEMBER_ROLES.MEMBER]: ["send", "forward"],
//     };

//     return permissions[member.role]?.includes(action) || false;
//   }
// }

// module.exports = new GroupChatService();
