import api from '../../config/api';
import { getAccessToken } from '../../services/storage';
import { getApiUrlAsync } from '../../config/api';
import { AuthContext } from '../../App';
import { useContext } from 'react';

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

// Lấy danh sách nhóm của user
export const getUserGroups = async () => {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Không tìm thấy token xác thực');
    }

    console.log('Getting user groups...');
    const response = await api.get('/users/groups');
    return response.data;
  } catch (error) {
    console.error('Get user groups error:', error);
    throw error;
  }
};

// Tạo nhóm mới
export const createGroup = async (groupData) => {
  try {
    console.log('Creating group with data:', groupData);
    
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Không tìm thấy token xác thực');
    }

    const response = await api.post('/groups', groupData);
    return response.data;
  } catch (error) {
    console.error('Create group error:', error);
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
export const addGroupMember = async (groupId, userId, role = 'MEMBER') => {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Không tìm thấy token xác thực');
    }

    const response = await api.post(`/groups/${groupId}/members`, {
      userId,
      role
    });
    return response.data;
  } catch (error) {
    console.error('Add group member error:', error);
    throw error;
  }
};

// Xóa thành viên khỏi nhóm
export const removeGroupMember = async (groupId, userId) => {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Không tìm thấy token xác thực');
    }

    const response = await api.delete(`/groups/${groupId}/members/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Remove group member error:', error);
    throw error;
  }
};

// Rời nhóm
export const leaveGroup = async (groupId, userId) => {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Không tìm thấy token xác thực');
    }

    if (!userId) {
      throw new Error('Không tìm thấy thông tin người dùng');
    }

    const response = await api.delete(`/groups/${groupId}/members/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Leave group error:', error);
    throw error;
  }
};

// Giải tán nhóm
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

// Cập nhật vai trò thành viên
export const updateMemberRole = async (groupId, userId, role) => {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Không tìm thấy token xác thực');
    }

    const response = await api.put(`/groups/${groupId}/members/${userId}/role`, {
      role
    });
    return response.data;
  } catch (error) {
    console.error('Update member role error:', error);
    throw error;
  }
};

// Lấy danh sách thành viên nhóm
export const getGroupMembers = async (groupId) => {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Không tìm thấy token xác thực');
    }

    const response = await api.get(`/groups/${groupId}/members`);
    return response.data;
  } catch (error) {
    console.error('Get group members error:', error);
    throw error;
  }
};

// Cập nhật thời gian đọc tin nhắn cuối cùng
export const updateLastRead = async (groupId, userId) => {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Không tìm thấy token xác thực');
    }

    const response = await api.put(`/groups/${groupId}/members/${userId}/last-read`);
    return response.data;
  } catch (error) {
    console.error('Update last read error:', error);
    throw error;
  }
};

// Lấy danh sách liên hệ gần đây
export const getRecentContacts = async () => {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Không tìm thấy token xác thực');
    }

    console.log('Getting recent contacts...');
    const response = await api.get('/users/recent-contacts');
    console.log('Raw API response:', response);
    
    // Đảm bảo trả về đúng cấu trúc dữ liệu
    return {
      success: true,
      contacts: response.data.contacts || response.data || []
    };
  } catch (error) {
    console.error('Get recent contacts error:', error);
    throw error;
  }
}; 