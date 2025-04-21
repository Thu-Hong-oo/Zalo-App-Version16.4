import axios from "axios";

// Cấu hình API
const COMPUTER_IP = "192.168.1.16";  // Địa chỉ IP máy tính
const BASE_URL = `http://${COMPUTER_IP}:3000`;  // API base URL
const API_URL = `${BASE_URL}/api`;  // API URL chính

// Hàm lấy base URL cho socket
export const getBaseUrl = () => {
  return BASE_URL;
};

// Hàm lấy API URL
export const getApiUrl = () => {
  return API_URL;
};

// Hàm lấy API URL (async version for backward compatibility)
export const getApiUrlAsync = async () => {
  return Promise.resolve(API_URL);
};

// Tạo instance Axios
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,  // Đảm bảo cookie và credentials được gửi
  headers: {
    "Content-Type": "application/json",
  },
});

// Add request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Xử lý lỗi phản hồi
    if (error.response) {
      console.error("API Error:", {
        url: error.config.url,
        message: error.message,
        response: error.response.data,
        status: error.response.status,
      });
    } else if (error.request) {
      console.error("API Error:", {
        url: error.config.url,
        message: "Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.",
        response: undefined,
        status: undefined,
      });
    } else {
      console.error("API Error:", {
        url: error.config.url,
        message: error.message,
        response: undefined,
        status: undefined,
      });
    }
    return Promise.reject(error);
  }
);

// Hàm kiểm tra kết nối tới server
export const checkServerConnection = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });  // Kiểm tra kết nối với endpoint `/health`
    return response.status === 200;  // Nếu status là 200, server hoạt động
  } catch (error) {
    console.error('Server connection check failed:', error);
    return false;  // Nếu có lỗi, trả về false
  }
};

export default api;
