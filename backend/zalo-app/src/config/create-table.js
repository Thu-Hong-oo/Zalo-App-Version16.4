const { CreateTableCommand } = require("@aws-sdk/client-dynamodb");
const { dynamodb } = require("./aws");

async function createTables() {
  const tables = [
    // Bảng users
    {
      TableName: "users-zalolite",
      KeySchema: [{ AttributeName: "phone", KeyType: "HASH" }],
      AttributeDefinitions: [
        { AttributeName: "phone", AttributeType: "S" },
        { AttributeName: "userId", AttributeType: "S" }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: "userId-index",
          KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
          Projection: { ProjectionType: "ALL" },
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5,
          },
        },
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5,
      },
    },

    // Bảng friends
    {
      TableName: "friends-zalolite",
      KeySchema: [
        { AttributeName: "userPhone", KeyType: "HASH" },
        { AttributeName: "friendPhone", KeyType: "RANGE" }
      ],
      AttributeDefinitions: [
        { AttributeName: "userPhone", AttributeType: "S" },
        { AttributeName: "friendPhone", AttributeType: "S" }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: "friendPhone-index",
          KeySchema: [
            { AttributeName: "friendPhone", KeyType: "HASH" },
            { AttributeName: "userPhone", KeyType: "RANGE" }
          ],
          Projection: { ProjectionType: "ALL" },
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
          }
        }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    },

    // Bảng friend requests
    {
      TableName: "friendRequests",
      KeySchema: [{ AttributeName: "requestId", KeyType: "HASH" }],
      AttributeDefinitions: [{ AttributeName: "requestId", AttributeType: "S" }],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5,
      },
    },

    // Bảng groups
    {
      TableName: "GROUPS",
      KeySchema: [{ AttributeName: "groupId", KeyType: "HASH" }],
      AttributeDefinitions: [{ AttributeName: "groupId", AttributeType: "S" }],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5,
      },
    },

    // Bảng group members
    {
      TableName: "GROUP_MEMBERS",
      KeySchema: [
        { AttributeName: "groupId", KeyType: "HASH" },
        { AttributeName: "userId", KeyType: "RANGE" }
      ],
      AttributeDefinitions: [
        { AttributeName: "groupId", AttributeType: "S" },
        { AttributeName: "userId", AttributeType: "S" }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: "userId-index",
          KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
          Projection: { ProjectionType: "ALL" },
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5,
          },
        },
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5,
      },
    },

    // Bảng messages
    {
      TableName: "MESSAGES",
      KeySchema: [
        { AttributeName: "groupId", KeyType: "HASH" },
        { AttributeName: "timestamp", KeyType: "RANGE" }
      ],
      AttributeDefinitions: [
        { AttributeName: "groupId", AttributeType: "S" },
        { AttributeName: "timestamp", AttributeType: "S" }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5,
      },
    }
  ];

  for (const tableParams of tables) {
    try {
      await dynamodb.send(new CreateTableCommand(tableParams));
      console.log(`Tạo bảng ${tableParams.TableName} thành công`);
    } catch (error) {
      if (error.name === 'ResourceInUseException') {
        console.log(`Bảng ${tableParams.TableName} đã tồn tại`);
      } else {
        console.error(`Lỗi khi tạo bảng ${tableParams.TableName}:`, error);
      }
    }
  }
}

createTables().catch(console.error);

module.exports = createTables; 