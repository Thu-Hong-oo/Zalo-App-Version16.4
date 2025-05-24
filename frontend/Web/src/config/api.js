import axios from "axios";

// Cấu hình API
const COMPUTER_IP = "192.168.1.14";

const BASE_URL = `http://${COMPUTER_IP}:3000`;

const API_URL = `${BASE_URL}/api`;
const SOCKET_URL = BASE_URL;

// Hàm lấy base URL cho socket
export const getSocketUrl = () => {
  return SOCKET_URL;
};

// Hàm lấy base URL cho API
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
  timeout: 40000,
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

// Add response interceptor to handle token refresh
api.interceptors.response.use(

  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't tried to refresh token yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem("refreshToken");
        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken
        });

        if (response.data?.accessToken) {
          localStorage.setItem("accessToken", response.data.accessToken);
          api.defaults.headers.common["Authorization"] = `Bearer ${response.data.accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // If refresh token is invalid, logout user
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }

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
