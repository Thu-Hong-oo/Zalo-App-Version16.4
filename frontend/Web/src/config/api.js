// XÓA 3 dòng import này:
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import { Platform } from "react-native";
// import Constants from "expo-constants";

// Chỉ giữ lại import axios
import axios from "axios";

// Cấu hình API
const COMPUTER_IP = "192.168.2.118";
const BASE_URL = `http://${COMPUTER_IP}:3000`;
const API_URL = `${BASE_URL}/api`;

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
  withCredentials: true,
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
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error("API Error:", {
        url: error.config.url,
        message: error.message,
        response: error.response.data,
        status: error.response.status,
      });
    } else if (error.request) {
      // The request was made but no response was received
      console.error("API Error:", {
        url: error.config.url,
        message:
          "Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.",
        response: undefined,
        status: undefined,
      });
    } else {
      // Something happened in setting up the request that triggered an Error
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

// Thêm hàm kiểm tra kết nối
export const checkServerConnection = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    console.error("Server connection check failed:", error);
    return false;
  }
};

export default api;
