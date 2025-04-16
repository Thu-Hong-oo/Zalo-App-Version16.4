import api from '../../config/api';
import { getApiUrlAsync } from '../../config/api';
import { getAccessToken } from '../../services/storage';

// Hàm khởi tạo API
export const initUserApi = async () => {
  try {
    const url = await getApiUrlAsync();
    api.defaults.baseURL = url;
    console.log('✅ User API initialized with URL:', url);
    console.log('API config:', {
      baseURL: api.defaults.baseURL,
      headers: api.defaults.headers,
      timeout: api.defaults.timeout
    });
  } catch (error) {
    console.log('Failed to initialize User API:', error);
    throw error;
  }
};

// Lấy thông tin profile
export const getUserProfile = async () => {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Không tìm thấy token xác thực');
    }

    // Log để debug
    console.log('Getting user profile with token:', token);
    console.log('API base URL:', api.defaults.baseURL);
    
    const response = await api.get('/users/profile');

    // Log response để debug
    console.log('User profile response:', response.data);
    
    if (!response.data) {
      throw new Error('Không nhận được dữ liệu từ server');
    }

    return response.data;
  } catch (error) {
    console.error('Get user profile error:', error);
    if (error.response) {
      // Log chi tiết lỗi từ server
      console.error('Server error details:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          baseURL: error.config?.baseURL,
          headers: error.config?.headers
        }
      });
    }
    throw error;
  }
};

// Cập nhật thông tin profile
export const updateUserProfile = async (profileData) => {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Không tìm thấy token xác thực');
    }

    const response = await api.put('/users/profile', profileData);
    return response.data;
  } catch (error) {
    console.error('Update user profile error:', error);
    throw error;
  }
};

// Cập nhật trạng thái online/offline
export const updateStatus = async (status) => {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Không tìm thấy token xác thực');
    }

    const response = await api.put('/users/status', { status });
    return response.data;
  } catch (error) {
    console.error('Update status error:', error);
    // Don't throw error for status update to prevent blocking logout
    return null;
  }
};

// Đổi mật khẩu
export const changePassword = async (currentPassword, newPassword) => {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Không tìm thấy token xác thực');
    }

    console.log('Changing password with data:', { currentPassword, newPassword });

    const response = await api.put('/users/password', {
      currentPassword,
      newPassword
    });
    
    console.log('Change password response:', response.data);
    
    if (response.data && response.data.message) {
      return response.data;
    }
    
    throw new Error('Không nhận được phản hồi từ server');
  } catch (error) {
    console.error('Change password error:', error);
    if (error.response) {
      // Log chi tiết lỗi từ server
      console.error('Server error details:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          baseURL: error.config?.baseURL,
          headers: error.config?.headers
        }
      });
      throw new Error(error.response.data.message || 'Không thể đổi mật khẩu. Vui lòng thử lại.');
    }
    throw new Error('Không thể kết nối đến máy chủ. Vui lòng thử lại.');
  }
};

// Tìm kiếm người dùng
export const searchUsers = async (query) => {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Không tìm thấy token xác thực');
    }

    const response = await api.get(`/users/search?query=${encodeURIComponent(query)}`);
    return response.data;
  } catch (error) {
    console.error('Search users error:', error);
    throw error;
  }
};

export const updateAvatar = async (file) => {
  try {
    console.log('Starting avatar update with file:', file);

    if (!file || !file.uri) {
      throw new Error('No file selected');
    }

    // Get the access token
    const token = await getAccessToken();
    if (!token) {
      throw new Error('No token provided');
    }

    const formData = new FormData();
    
    // Xử lý file theo cách đơn giản hơn cho thiết bị di động
    formData.append('avatar', {
      uri: file.uri,
      type: file.type || 'image/jpeg',
      name: file.name || 'avatar.jpg'
    });

    console.log('FormData prepared:', {
      uri: file.uri,
      type: file.type,
      name: file.name,
      size: file.size
    });

    // Sử dụng fetch thay vì axios để upload file trên thiết bị di động
    const apiUrl = await getApiUrlAsync();
    console.log('Uploading to URL:', `${apiUrl}/users/avatar`);
    
    // Thêm timeout dài hơn cho upload file
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 giây timeout
    
    const response = await fetch(`${apiUrl}/users/avatar`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        // Không set Content-Type, để browser tự set với boundary
      },
      body: formData,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Server error response:', {
        status: response.status,
        statusText: response.statusText,
        data: errorData
      });
      throw new Error(errorData.message || `Server error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Avatar update response:', data);

    if (!data || !data.avatarUrl) {
      throw new Error('Invalid response from server');
    }

    return data.avatarUrl;
  } catch (error) {
    console.error('Avatar update error:', error);
    
    // Xử lý lỗi AbortError (timeout)
    if (error.name === 'AbortError') {
      throw new Error('Upload timeout. Please try again with a smaller image.');
    }
    
    // Xử lý lỗi network
    if (error.message === 'Network request failed') {
      console.error('Network error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      
      // Thử lại với axios nếu fetch thất bại
      try {
        console.log('Retrying with axios...');
        const apiUrl = await getApiUrlAsync();
        
        const response = await api.post('/users/avatar', formData, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          },
          timeout: 60000,
          transformRequest: (data, headers) => {
            // Remove Content-Type header to let the browser set it with the boundary
            delete headers['Content-Type'];
            return data;
          }
        });
        
        console.log('Axios retry successful:', response.data);
        return response.data.avatarUrl;
      } catch (retryError) {
        console.error('Axios retry failed:', retryError);
        throw new Error('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.');
      }
    }
    
    throw new Error(error.message || 'Failed to update avatar');
  }
};

// Tạo avatar từ tên
export const generateInitialsAvatar = async (name = '') => {
  try {
    // Tạo initials từ tên
    let initials = '';
    if (name.trim()) {
      // Tách tên thành các từ
      const nameParts = name.trim().split(' ');
      
      if (nameParts.length === 1) {
        // Nếu chỉ có một từ, lấy nguyên từ đó
        initials = nameParts[0];
      } else {
        // Nếu có nhiều từ, lấy chữ cái đầu tiên của từ đầu và từ cuối
        initials = nameParts[0][0] + nameParts[nameParts.length - 1][0];
      }
    }
    
    // Tạo màu ngẫu nhiên
    const randomColor = Math.floor(Math.random() * 16777215).toString(16);
    
    // Tạo URL cho avatar
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${randomColor}&color=fff`;
    
    return avatarUrl;
  } catch (error) {
    console.error('Error generating initials avatar:', error);
    return 'https://ui-avatars.com/api/?name=U&background=random&color=fff';
  }
};

// Bỏ qua cập nhật avatar
export const skipAvatarUpdate = async (userData) => {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Không tìm thấy token xác thực');
    }

    // Tạo avatar mặc định
    const defaultAvatarUrl = await generateInitialsAvatar(userData?.name || '');

    // Cập nhật profile với avatar mặc định
    const response = await api.put('/users/profile', {
      name: userData?.name || '',
      avatar: defaultAvatarUrl
    });

    if (response.data) {
      return {
        ...response.data,
        avatar: defaultAvatarUrl
      };
    }

    throw new Error('Không nhận được phản hồi từ server');
  } catch (error) {
    console.error('Skip avatar update error:', error);
    throw error;
  }
}; 