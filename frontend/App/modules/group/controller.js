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

// Cập nhật avatar nhóm
export const updateGroupAvatar = async (groupId, avatar) => {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Không tìm thấy token xác thực');
    }

    if (!avatar || !avatar.uri) {
      throw new Error('Không tìm thấy file ảnh');
    }

    console.log('Updating group avatar with data:', {
      uri: avatar.uri,
      type: avatar.type,
      name: avatar.fileName
    });

    const formData = new FormData();
    
    // Xử lý file ảnh
    const fileType = avatar.type || 'image/jpeg';
    const fileName = avatar.fileName || 'avatar.jpg';
    
    // Nếu uri là base64
    if (avatar.uri.startsWith('data:')) {
      // Convert base64 to blob
      const response = await fetch(avatar.uri);
      const blob = await response.blob();
      formData.append('avatar', blob, fileName);
    } else {
      // Nếu là file từ thư viện
      formData.append('avatar', {
        uri: avatar.uri,
        type: fileType,
        name: fileName
      });
    }

    console.log('Sending form data with file name:', fileName);

    const response = await api.put(`/groups/${groupId}/avatar`, formData, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'multipart/form-data'
      }
    });

    console.log('Update avatar response:', response.data);
    
    if (!response.data || !response.data.data?.avatarUrl) {
      throw new Error('Không nhận được URL ảnh từ server');
    }
    
    return response.data.data.avatarUrl;
  } catch (error) {
    console.error('Avatar update error:', error);
    if (error.response) {
      console.error('Server error details:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      });
      throw new Error(error.response.data.message || 'Không thể cập nhật ảnh nhóm');
    }
    throw error;
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