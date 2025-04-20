import api from '../../config/api';
import { getAccessToken } from '../../services/storage';
import { getApiUrlAsync } from '../../config/api';

// Khởi tạo API cho group
export const initGroupApi = async () => {
  try {
    const url = await getApiUrlAsync();
    api.defaults.baseURL = url;
    console.log('✅ Group API initialized with URL:', url);
  } catch (error) {
    console.error('Failed to initialize Group API:', error);
    throw error;
  }
};

// Lấy danh sách người liên hệ gần đây để tạo nhóm
export const getRecentContacts = async () => {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Không tìm thấy token xác thực');
    }

    console.log('Getting recent contacts...');
    const response = await api.get('/users/recent-contacts', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
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

// Tạo nhóm mới
export const createGroup = async (groupData) => {
  try {
    console.log('Starting group creation with data:', groupData);
    
    const token = await getAccessToken();
    console.log('Retrieved token:', token ? 'Token exists' : 'No token found');
    
    if (!token) {
      throw new Error('Không tìm thấy token xác thực');
    }

    if ( !groupData.members || groupData.members.length < 2) {
      throw new Error('Thiếu thông tin nhóm hoặc số lượng thành viên không đủ');
    }

    console.log('Creating group with data:', {
     // name: groupData.name,
      memberCount: groupData.members.length,
      creatorId: groupData.creatorId
    });

    const response = await api.post('/groups', groupData);

    console.log('Group creation response:', response.data);

    if (!response.data || !response.data.groupId) {
      throw new Error('Không nhận được thông tin nhóm từ server');
    }

    return {
      status: 'success',
      data: {
        groupId: response.data.groupId,
        name: response.data.name || groupData.name,
        memberCount: groupData.members.length
      }
    };

  } catch (error) {
    console.error('Create group error:', error);
    if (error.response) {
      console.error('Server error details:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      });
    }
    throw error;
  }
};

// Lấy thông tin nhóm
export const getGroupInfo = async (groupId) => {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Không tìm thấy token xác thực');
    }

    const response = await api.get(`/groups/${groupId}`);
    return response.data;
  } catch (error) {
    console.error('Get group info error:', error);
    throw error;
  }
};

// Cập nhật thông tin nhóm
export const updateGroupInfo = async (groupId, updateData) => {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Không tìm thấy token xác thực');
    }

    const response = await api.put(`/groups/${groupId}`, updateData);
    return response.data;
  } catch (error) {
    console.error('Update group info error:', error);
    throw error;
  }
};

// Thêm thành viên vào nhóm
export const addGroupMembers = async (groupId, memberIds) => {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Không tìm thấy token xác thực');
    }

    const response = await api.post(`/groups/${groupId}/members`, {
      memberIds
    });
    return response.data;
  } catch (error) {
    console.error('Add group members error:', error);
    throw error;
  }
};

// Xóa thành viên khỏi nhóm
export const removeGroupMember = async (groupId, memberId) => {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Không tìm thấy token xác thực');
    }

    const response = await api.delete(`/groups/${groupId}/members/${memberId}`);
    return response.data;
  } catch (error) {
    console.error('Remove group member error:', error);
    throw error;
  }
};

// Rời nhóm
export const leaveGroup = async (groupId) => {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Không tìm thấy token xác thực');
    }

    const response = await api.post(`/groups/${groupId}/leave`);
    return response.data;
  } catch (error) {
    console.error('Leave group error:', error);
    throw error;
  }
};

// Giải tán nhóm (chỉ admin)
export const dissolveGroup = async (groupId) => {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Không tìm thấy token xác thực');
    }

    const response = await api.delete(`/groups/${groupId}`);
    return response.data;
  } catch (error) {
    console.error('Dissolve group error:', error);
    throw error;
  }
}; 