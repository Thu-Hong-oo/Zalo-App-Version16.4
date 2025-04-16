import api from '../../config/api';
import { getApiUrlAsync } from '../../config/api';

// Thêm interceptor để xử lý lỗi
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.log('API Error:', error);
    if (error.code === 'ECONNABORTED') {
      throw new Error('Kết nối quá thời gian. Vui lòng thử lại.');
    }
    if (!error.response) {
      console.log('Network error details:', {
        message: error.message,
        code: error.code,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          baseURL: error.config?.baseURL,
        }
      });
      throw new Error('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.');
    }
    throw error.response?.data || error;
  }
);

// Hàm khởi tạo API
export const initApi = async () => {
  try {
    const url = await getApiUrlAsync();
    api.defaults.baseURL = url;
    console.log('✅ API initialized with URL:', url);
  } catch (error) {
    console.log('Failed to initialize API:', error);
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
    const response = await api.post('/auth/login', { phone, password });
    return response.data;
  } catch (error) {
    throw error;
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