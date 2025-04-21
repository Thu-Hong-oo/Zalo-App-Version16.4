import api from '../config/api';

const getCurrentUser = () => {
  try {
    // Try to get user from localStorage
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user && user.userId) {
        return user;
      }
    }
    
    // Try to get userInfo from localStorage as fallback
    const userInfoStr = localStorage.getItem('userInfo');
    if (userInfoStr) {
      const userInfo = JSON.parse(userInfoStr);
      if (userInfo && userInfo.userId) {
        return userInfo;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

/**
 * Create a new group
 * @param {Object} groupData - Group data including name and members
 * @returns {Promise} - Promise with the response from the API
 */
export const createGroup = async (groupData) => {
  try {
    console.log('Creating group with data:', groupData);
    
    // Validate group data
    if (!groupData.members || groupData.members.length < 2) {
      throw new Error('Thiếu thông tin nhóm hoặc số lượng thành viên không đủ');
    }
    
    // Get current user
    const userInfo = getCurrentUser();
    if (!userInfo) {
      console.error('User info not found in localStorage');
      throw new Error('Vui lòng đăng nhập lại');
    }
    
    console.log('User info found:', userInfo);
    
    // Prepare group data
    const finalGroupData = {
      name: groupData.name || `Nhóm của ${groupData.members.slice(0, 3).map(m => m.name).join(', ')}`,
      members: groupData.members.map(m => m.userId),
      createdBy: userInfo.userId
    };
    
    console.log('Sending group creation request with data:', finalGroupData);
    
    // Make API request
    const response = await api.post('/groups', finalGroupData);
    
    console.log('Group creation response:', response.data);
    
    if (!response.data) {
      throw new Error('Không nhận được thông tin nhóm từ server');
    }
    
    // Handle different response formats
    let groupId, groupName, memberCount;
    
    if (response.data.groupId) {
      // Format 1: { groupId, name, ... }
      groupId = response.data.groupId;
      groupName = response.data.name || finalGroupData.name;
      memberCount = response.data.memberCount || finalGroupData.members.length;
    } else if (response.data.id) {
      // Format 2: { id, name, ... }
      groupId = response.data.id;
      groupName = response.data.name || finalGroupData.name;
      memberCount = response.data.memberCount || finalGroupData.members.length;
    } else {
      throw new Error('Không nhận được thông tin nhóm từ server');
    }
    
    // Return consistent format for both web and app
    return {
      status: 'success',
      data: {
        groupId: groupId,
        id: groupId, // Include both for compatibility
        name: groupName,
        memberCount: memberCount
      }
    };
  } catch (error) {
    console.error('Create group error:', error);
    if (error.response) {
      console.error('Server error details:', {
        status: error.response.status,
        data: error.response.data
      });
    }
    throw error;
  }
};

/**
 * Get recent contacts for group creation
 * @returns {Promise} - Promise with the response from the API
 */
export const getRecentContacts = async () => {
  try {
    console.log('Getting recent contacts...');
    
    const response = await api.get('/users/recent-contacts');
    
    if (!response.data) {
      throw new Error('Không nhận được dữ liệu từ server');
    }
    
    return {
      status: 'success',
      data: {
        contacts: response.data.contacts.map(contact => ({
          userId: contact.userId,
          name: contact.name,
          avatar: contact.avatar,
          lastActive: contact.lastActive || 'Hoạt động gần đây'
        }))
      }
    };
  } catch (error) {
    console.error('Get recent contacts error:', error);
    if (error.response) {
      console.error('Server error details:', {
        status: error.response.status,
        data: error.response.data
      });
    }
    throw error;
  }
};

/**
 * Get group details by ID
 * @param {string} groupId - The ID of the group to fetch
 * @returns {Promise} - Promise with the response from the API
 */
export const getGroupDetails = async (groupId) => {
  try {
    console.log(`Getting group details for group ID: ${groupId}`);
    
    const response = await api.get(`/groups/${groupId}`);
    
    if (!response.data) {
      throw new Error('Không nhận được dữ liệu từ server');
    }
    
    return {
      status: 'success',
      data: response.data
    };
  } catch (error) {
    console.error('Get group details error:', error);
    if (error.response) {
      console.error('Server error details:', {
        status: error.response.status,
        data: error.response.data
      });
    }
    throw error;
  }
};

export const sendGroupMessage = async (groupId, content) => {
  try {
    console.log(`Sending message to group ${groupId}: ${content}`);
    
    const response = await api.post(`/groups/${groupId}/messages`, {
      content
    });
    
    if (!response.data) {
      throw new Error('Không nhận được dữ liệu từ server');
    }
    
    return {
      status: 'success',
      data: response.data
    };
  } catch (error) {
    console.error('Send group message error:', error);
    if (error.response) {
      console.error('Server error details:', {
        status: error.response.status,
        data: error.response.data
      });
    }
    throw error;
  }
};

export const getAllGroups = async () => {
  try {
    console.log('Getting all groups...');
    
    const response = await api.get('/groups');
    
    if (!response.data) {
      throw new Error('Không nhận được dữ liệu từ server');
    }
    
    return {
      status: 'success',
      data: response.data
    };
  } catch (error) {
    console.error('Get all groups error:', error);
    if (error.response) {
      console.error('Server error details:', {
        status: error.response.status,
        data: error.response.data
      });
    }
    throw error;
  }
}; 