// File: src/utils/hardDeleteMessage.js

const { DynamoDB } = require("aws-sdk");
const dynamoDB = new DynamoDB.DocumentClient();

/**
 * Xoá cứng một tin nhắn khỏi bảng DynamoDB.
 * @param {object} msg - object chứa messageId và timestamp
 */
exports.hardDeleteMessage = (msg) =>
  dynamoDB.delete({
    TableName: process.env.MESSAGE_TABLE,
    Key: {
      messageId: msg.messageId,
      timestamp: msg.timestamp,
    },
  }).promise();
