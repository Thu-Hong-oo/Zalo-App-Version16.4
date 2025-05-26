import api from '../../config/api';
import { getAccessToken } from '../../services/storage';
import { jwtDecode } from 'jwt-decode';

// Lấy userId từ token
const getUserIdFromToken = async () => {
  const token = await getAccessToken();
  if (!token) {
      console.error('Access token not found in storage');
      return null;
  }
  try {
    const decodedToken = jwtDecode(token);
    // Đảm bảo trường trong token đúng là 'userId'. Kiểm tra lại payload token nếu cần.
    if (!decodedToken.userId) {
        console.error('userId not found in decoded token:', decodedToken);
        return null;
    }
    return decodedToken.userId;
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

export const getFriendsList = async () => {
  try {
    const userId = await getUserIdFromToken();
    if (!userId) throw new Error('Không tìm thấy thông tin người dùng (userId is null/undefined)');

    const response = await api.get(`/friends/list/${userId}`);
    console.log('API Response - getFriendsList:', response.data);

    if (response.data && response.data.success === true) {
      return response.data.friends || [];
    } else {
      throw new Error(response.data?.message || 'Không thể lấy danh sách bạn bè');
    }
  } catch (error) {
    console.error('Error details in getFriendsList catch:', error);
    throw error;
  }
};

export const sendFriendRequest = async (toUserId) => {
  try {
    const fromUserId = await getUserIdFromToken();
    if (!fromUserId) throw new Error('Không tìm thấy thông tin người gửi (fromUserId is null/undefined)');

    const response = await api.post('/friends/request', {
      from: fromUserId,
      to: toUserId,
    });
    console.log('API Response - sendFriendRequest:', response.data);

    if (response.data && response.data.success === true) {
      return response.data;
    } else {
      throw new Error(response.data?.message || 'Không thể gửi lời mời kết bạn');
    }
  } catch (error) {
    console.error('Error details in sendFriendRequest catch:', error);
    throw error;
  }
};

export const getSentFriendRequests = async () => {
  let userId = null; // Khai báo userId ở phạm vi rộng hơn để dùng trong catch
  try {
    userId = await getUserIdFromToken();
    if (!userId) throw new Error('Không tìm thấy thông tin người dùng');

    const response = await api.get(`/friends/request/sent/${userId}`);
    console.log('API Response - getSentFriendRequests:', response.data);

    if (response.data && response.data.success === true) {
      return response.data.sent || [];
    } else {
      throw new Error(response.data?.message || 'Không thể lấy lời mời đã gửi');
    }
  } catch (error) {
    // Log lỗi gốc với context
    console.error(`Error details in getSentFriendRequests catch [userId: ${userId}]:`, error);
    // Ném lại lỗi gốc
    throw error;
  }
};

export const getReceivedFriendRequests = async () => {
  let userId = null; // Khai báo userId ở phạm vi rộng hơn để dùng trong catch
  try {
    userId = await getUserIdFromToken();
    if (!userId) throw new Error('Không tìm thấy thông tin người dùng');

    const response = await api.get(`/friends/request/received/${userId}`);
    console.log('API Response - getReceivedFriendRequests:', response.data);

    if (response.data && response.data.success === true) {
      return response.data.received || [];
    } else {
      throw new Error(response.data?.message || 'Không thể lấy lời mời đã nhận');
    }
  } catch (error) {
    // Log lỗi gốc với context
    console.error(`Error details in getReceivedFriendRequests catch [userId: ${userId}]:`, error);
    // Ném lại lỗi gốc
    throw error;
  }
};

// Hàm lấy thông tin user bằng phone
export const getUserInfoByPhone = async (phone) => {
  try {
    const apiUrl = `/users/${phone}`; // Endpoint đúng là /users/:phone
    console.log(`Calling API: ${apiUrl}`);
    const response = await api.get(apiUrl);
    console.log(`API Response - getUserInfoByPhone (${phone}):`, response.data);
    const userData = response.data?.data || response.data;

    if (userData && userData.userId) {
      return userData;
    } else {
      console.warn(`User data not found in response for phone ${phone} or API error:`, response.data);
      return null;
    }
  } catch (error) {
    console.error(`Error fetching user info by phone (${phone}):`, error);
    throw error;
  }
};

export const acceptFriendRequest = async (requestId) => {
  try {
    if (!requestId) throw new Error('Thiếu requestId');
    const response = await api.post('/friends/request/accept', { requestId });
    console.log('API Response - acceptFriendRequest:', response.data);
    if (response.data && response.data.success === true) {
      return response.data;
    } else {
      throw new Error(response.data?.message || 'Không thể chấp nhận lời mời');
    }
  } catch (error) {
    console.error('Error accepting friend request:', error);
    throw error;
  }
};

export const rejectFriendRequest = async (requestId) => {
  try {
    if (!requestId) throw new Error('Thiếu requestId');
    const response = await api.post('/friends/request/reject', { requestId });
    console.log('API Response - rejectFriendRequest:', response.data);
    if (response.data && response.data.success === true) {
      return response.data;
    } else {
      throw new Error(response.data?.message || 'Không thể từ chối lời mời');
    }
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    throw error;
  }
}; 