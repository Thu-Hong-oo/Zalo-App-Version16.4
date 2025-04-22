import api from '../../config/api';
import { getAccessToken } from '../../services/storage';
import { getApiUrlAsync } from '../../config/api';
import { AuthContext } from '../../App';
import { useContext } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

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
export const addGroupMember = async (groupId, userId, options = {}) => {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Không tìm thấy token xác thực');
    }

    const response = await api.post(`/groups/${groupId}/members`, {
      userId,
      role: 'MEMBER'
    });

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('Add group member error:', error);
    return {
      success: false,
      error: error.message || 'Không thể thêm thành viên'
    };
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
    
    // Kiểm tra nếu là lỗi throughput của DynamoDB
    if (error.response?.data?.error?.includes('provisioned throughput')) {
      return {
        success: false,
        contacts: [],
        message: 'Hệ thống đang tải. Vui lòng thử lại sau giây lát.'
      };
    }
    
    // Trả về mảng rỗng thay vì throw error để tránh crash app
    return {
      success: false,
      contacts: [],
      message: 'Không thể tải danh sách liên hệ. Vui lòng thử lại sau.'
    };
  }
};

// Cập nhật avatar nhóm
export const updateGroupAvatar = async (groupId, avatarFile) => {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Unauthorized');
    }

    if (!avatarFile || !avatarFile.uri) {
      throw new Error('No avatar file provided');
    }

    const formData = new FormData();
    
    // Clean up the URI and ensure proper file object structure
    const fileUri = Platform.OS === 'android' 
      ? avatarFile.uri 
      : avatarFile.uri.replace('file://', '');
    
    const file = {
      uri: fileUri,
      type: avatarFile.type || 'image/jpeg',
      name: avatarFile.name || `avatar-${Date.now()}.jpg`
    };

    formData.append('avatar', file);

    console.log('Uploading avatar:', {
      groupId,
      fileDetails: file
    });

    const apiUrl = await getApiUrlAsync();
    const fullUrl = `${apiUrl}/groups/${groupId}/avatar`;
    
    const response = await axios({
      method: 'PUT',
      url: fullUrl,
      data: formData,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${token}`
      },
      transformRequest: [(data) => data]
    });

    console.log('Upload response:', response.data);

    if (!response.data || response.data.status === 'error') {
      throw new Error(response.data?.message || 'Failed to update avatar');
    }

    return response.data.avatarUrl;
  } catch (error) {
    console.error('Error updating group avatar:', error);
    if (error.response) {
      console.error('Server response:', error.response.data);
    }
    throw new Error('Failed to update avatar: ' + (error.message || 'Network error'));
  }
};

export const updateGroupName = async (groupId, newName) => {
  try {
    const response = await api.put(`/groups/${groupId}/name`, {
      name: newName
    });
    return response.data;
  } catch (error) {
    console.error('Update group name error:', error);
    throw error;
  }
}; 