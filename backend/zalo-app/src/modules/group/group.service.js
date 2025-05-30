const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand, DeleteCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require('uuid');
const GroupMemberService = require('./groupMember.service');
const User = require('../user/model'); // Đổi lại import thành model

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const GROUPS_TABLE = process.env.GROUPS_TABLE || 'groups-zalolite';
const CONVERSATIONS_TABLE = process.env.CONVERSATIONS_TABLE || 'conversations-zalolite';

class GroupService {
  async createGroup(data) {
    const { members, createdBy, name } = data;
    const groupId = uuidv4();
    const now = new Date().toISOString();

    const groupItem = {
      groupId,
      name: name || 'Nhóm mới',
      createdBy,
      createdAt: now,
      updatedAt: now,
      memberCount: members.length,
      isActive: true,
    };

    const putGroupParams = {
      TableName: GROUPS_TABLE,
      Item: groupItem,
    };
    await dynamodb.send(new PutCommand(putGroupParams));
    console.log(`Group created: ${groupId}`);

    const memberItems = members.map(userId => ({
      userId,
      role: userId === createdBy ? 'ADMIN' : 'MEMBER',
      isActive: true
    }));
    // Đảm bảo GroupMemberService.addMultipleMembers tồn tại và hoạt động
    await GroupMemberService.addMultipleMembers(groupId, memberItems);
    console.log(`Members added to group: ${groupId}`);

    const conversationItem = {
      conversationId: groupId, 
      type: 'GROUP',
      name: groupItem.name,
      avatar: groupItem.avatar,
      lastMessageTime: now,
      lastMessageSnippet: 'Nhóm đã được tạo.',
      participants: members,
      createdAt: now,
      updatedAt: now,
    };
    const putConversationParams = {
        TableName: CONVERSATIONS_TABLE,
        Item: conversationItem,
    };
    try {
        await dynamodb.send(new PutCommand(putConversationParams));
        console.log(`Conversation record created for group: ${groupId}`);
    } catch (convError) {
        console.error(`Failed to create conversation record for group ${groupId}:`, convError);
    }

    // Gọi hàm getGroupById để trả về đầy đủ thông tin
    return this.getGroupById(groupId);
  }

  async getGroupById(groupId) {
    // 1. Get group info
    const groupParams = {
      TableName: GROUPS_TABLE,
      Key: { groupId },
    };
    const { Item: groupInfo } = await dynamodb.send(new GetCommand(groupParams));

    if (!groupInfo || !groupInfo.isActive) {
      return null; 
    }

    // 2. Get members (basic info from GroupMemberService)
    const membersBasic = await GroupMemberService.getGroupMembers(groupId);
    if (!membersBasic || membersBasic.length === 0) {
      return { ...groupInfo, members: [] };
    }

    // 3. Get full details for each member using User.getById
    const memberDetailPromises = membersBasic.map(async (member) => {
      try {
        const userDetails = await User.getById(member.userId);
        return {
          ...member, 
          name: userDetails?.name || 'Người dùng Zalo', 
          avatar: userDetails?.avatar, 
        };
      } catch (userError) {
         console.error(`Error fetching details for user ${member.userId} in group ${groupId}:`, userError);
         return {
           ...member, // Vẫn trả về thông tin cơ bản
           name: 'Lỗi tải tên',
           avatar: null, // Hoặc avatar mặc định
         };
      }
    });

    const membersFull = await Promise.all(memberDetailPromises);

    // 4. Return combined info
    return {
      ...groupInfo,
      members: membersFull,
    };
  }

  // ... other service methods ...
  
   async getUserGroups(userId) {
     // Cần đảm bảo hàm này cũng trả về chi tiết thành viên nếu cần
     console.warn('getUserGroups might need updating to fetch full group details');
     const memberGroups = await GroupMemberService.getUserMemberRecords(userId);
     // Lấy chi tiết cho từng nhóm
     const groupPromises = memberGroups.map(m => this.getGroupById(m.groupId));
     // Lọc bỏ các nhóm null (ví dụ nhóm đã bị xóa)
     const groups = (await Promise.all(groupPromises)).filter(Boolean);
     return groups;
  }

  // Cập nhật avatar nhóm
  async updateGroupAvatar(groupId, avatarUrl) {
    try {
      const command = new UpdateCommand({
        TableName: GROUPS_TABLE,
        Key: {
          groupId
        },
        UpdateExpression: 'SET avatar = :avatar',
        ExpressionAttributeValues: {
          ':avatar': avatarUrl
        },
        ReturnValues: 'ALL_NEW'
      });

      const result = await dynamodb.send(command);
      return result.Attributes;
    } catch (error) {
      console.error('Update group avatar error:', error);
      throw error;
    }
  }

  // Cập nhật tên nhóm
  async updateGroupName(groupId, name) {
    try {
      const command = new UpdateCommand({
        TableName: GROUPS_TABLE,
        Key: {
          groupId
        },
        UpdateExpression: 'SET #name = :name',
        ExpressionAttributeNames: {
          '#name': 'name'
        },
        ExpressionAttributeValues: {
          ':name': name
        },
        ReturnValues: 'ALL_NEW'
      });

      const result = await dynamodb.send(command);
      return result.Attributes;
    } catch (error) {
      console.error('Update group name error:', error);
      throw error;
    }
  }

}

module.exports = new GroupService(); 