const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

// Cấu hình DynamoDB
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = 'VideoCalls';

class VideoCallModel {
  // Tạo cuộc gọi mới
  async create(callData) {
    const params = {
      TableName: TABLE_NAME,
      Item: callData
    };
    await dynamoDB.put(params).promise();
    return callData;
  }

  // Cập nhật trạng thái cuộc gọi
  async update(callId, updateData) {
    // Tạo UpdateExpression và ExpressionAttributeValues
    let updateExpression = 'SET ';
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};

    Object.entries(updateData).forEach(([key, value], index) => {
      if (key === 'duration') {
        // Đổi tên trường duration thành callDuration
        updateExpression += `#callDuration = :val${index}, `;
        expressionAttributeNames['#callDuration'] = 'callDuration';
      } else {
        updateExpression += `#${key} = :val${index}, `;
        expressionAttributeNames[`#${key}`] = key;
      }
      expressionAttributeValues[`:val${index}`] = value;
    });

    // Xóa dấu phẩy và khoảng trắng ở cuối
    updateExpression = updateExpression.slice(0, -2);

    const params = {
      TableName: TABLE_NAME,
      Key: { callId },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
  }

  // Lấy thông tin cuộc gọi
  async getById(callId) {
    const params = {
      TableName: TABLE_NAME,
      Key: { callId }
    };

    const result = await dynamoDB.get(params).promise();
    return result.Item;
  }

  // Lấy danh sách cuộc gọi của user (cả người gọi và người nhận)
  async getByUserId(userId, options = {}) {
    const params = {
      TableName: TABLE_NAME,
      IndexName: 'CallerIdIndex',
      KeyConditionExpression: 'callerId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    };

    const result = await dynamoDB.query(params).promise();
    let calls = result.Items || [];

    // Query từ ReceiverIdIndex
    const receiverParams = {
      TableName: TABLE_NAME,
      IndexName: 'ReceiverIdIndex',
      KeyConditionExpression: 'receiverId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    };

    const receiverResult = await dynamoDB.query(receiverParams).promise();
    calls = [...calls, ...(receiverResult.Items || [])];

    const [callerCalls, receiverCalls] = await Promise.all([
      dynamoDB.query(callerParams).promise(),
      dynamoDB.query(receiverParams).promise()
    ]);

    // Gộp và sắp xếp kết quả theo thời gian
    const allCalls = [...callerCalls.Items, ...receiverCalls.Items];
    return allCalls.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
  }

  // Lấy danh sách cuộc gọi đang active của user
  async getActiveCalls(userId) {
    // Query từ CallerIdIndex
    const callerParams = {
      TableName: TABLE_NAME,
      IndexName: 'CallerIdIndex',
      KeyConditionExpression: 'callerId = :userId',
      FilterExpression: '#status IN (:pending, :accepted)',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':pending': 'pending',
        ':accepted': 'accepted'
      }
    };

    // Query từ ReceiverIdIndex
    const receiverParams = {
      TableName: TABLE_NAME,
      IndexName: 'ReceiverIdIndex',
      KeyConditionExpression: 'receiverId = :userId',
      FilterExpression: '#status IN (:pending, :accepted)',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':pending': 'pending',
        ':accepted': 'accepted'
      }
    };

    const [callerCalls, receiverCalls] = await Promise.all([
      dynamoDB.query(callerParams).promise(),
      dynamoDB.query(receiverParams).promise()
    ]);

    return [...callerCalls.Items, ...receiverCalls.Items];
  }
}

module.exports = new VideoCallModel(); 