import api from '../../config/api';
import { getApiUrlAsync } from '../../config/api';


// Hàm khởi tạo API
export const initApi = async () => {
  try {
    const url = await getApiUrlAsync();
    api.defaults.baseURL = url;
    console.log('✅ API initialized with URL:', url);
  } catch (error) {
    console.error('Failed to initialize API:', error);
    throw error;
  }
};

export const sendRegisterOTP = async (phone) => {
  try {
    console.log('Sending OTP to phone:', phone);
    console.log('Using baseURL:', api.defaults.baseURL);
    const response = await api.post('/auth/register/send-otp', { phone });
    console.log('OTP sent successfully:', response.data);
    return response.data;
  } catch (error) {
    console.log('Send OTP error:', error);
    throw error;
  }
};

export const verifyRegisterOTP = async (phone, otp) => {
  try {
    const response = await api.post('/auth/register/verify-otp', { phone, otp });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const completeRegistration = async (phone, name, password) => {
  try {
    const response = await api.post('/auth/register/complete', {
      phone,
      name,
      password
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const login = async (phone, password) => {
  try {
    console.log('Attempting login with:', { phone });
    const response = await api.post('/auth/login', { 
      phone, 
      password 
    });
    
    if (!response.data) {
      throw new Error('Không nhận được dữ liệu từ server');
    }
    
    console.log('Login successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('Login error:', error);
    if (error.response) {
      // Lỗi từ server
      const message = error.response.data?.message || 'Đăng nhập thất bại';
      throw new Error(message);
    } else if (error.request) {
      // Không nhận được phản hồi từ server
      throw new Error('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.');
    } else {
      // Lỗi khác
      throw new Error(error.message || 'Đã xảy ra lỗi khi đăng nhập');
    }
  }
};

export const refreshToken = async (refreshToken) => {
  try {
    const response = await api.post('/auth/refresh', { refreshToken });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const logout = async () => {
  try {
    const response = await api.post('/auth/logout');
    return response.data;
  } catch (error) {
    throw error;
  }
}; 