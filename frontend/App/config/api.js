import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { Platform } from "react-native";

// Default configuration
const COMPUTER_IP = "192.168.2.118"; // Your computer's IP address
const API_PORT = "3000";

// Get the appropriate base URL based on environment
const getDefaultBaseUrl = () => {
  // Use computer IP for both dev and prod on mobile
  if (Platform.OS !== 'web') {
    return `http://${COMPUTER_IP}:${API_PORT}`;
  }
  // Use localhost only for web
  return `http://localhost:${API_PORT}`;
};

const BASE_URL = getDefaultBaseUrl();
const API_URL = `${BASE_URL}/api`;

// Get base URL for socket
export const getBaseUrl = () => BASE_URL;

// Get API URL
export const getApiUrl = () => API_URL;

// Get API URL (async version for backward compatibility)
export const getApiUrlAsync = async () => Promise.resolve(API_URL);

// Create Axios instance
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add request interceptor
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem("accessToken");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      console.log('Request config:', {
        url: config.url,
        method: config.method,
        baseURL: config.baseURL,
      });
      return config;
    } catch (error) {
      console.error('Error in request interceptor:', error);
      return config;
    }
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Network or timeout error
    if (error.code === 'ECONNABORTED') {
      throw new Error('Kết nối quá thời gian. Vui lòng thử lại.');
    }
    
    if (!error.response) {
      console.error('Network error details:', {
        message: error.message,
        code: error.code,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          baseURL: error.config?.baseURL,
        }
      });
      throw new Error('Không thể kết nối đến máy chủ. Vui lòng kiểm tra:\n1. Điện thoại và máy tính có cùng mạng WiFi\n2. Địa chỉ IP máy tính đã đúng chưa\n3. Server đã chạy chưa');
    }

    // Server error with response
    if (error.response?.status === 401) {
      // Handle unauthorized error
      AsyncStorage.removeItem("accessToken");
    }
    
    throw error;
  }
);

// Function to update baseURL
export const updateBaseURL = (newBaseURL) => {
  api.defaults.baseURL = `${newBaseURL}/api`;
  console.log('Updated API baseURL:', api.defaults.baseURL);
};

// Check server connection
export const checkServerConnection = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/health`, { 
      timeout: 5000,
      headers: { 'Cache-Control': 'no-cache' }
    });
    return response.status === 200;
  } catch (error) {
    console.error('Server connection check failed:', error);
    return false;
  }
};

export default api;