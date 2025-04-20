import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import Constants from "expo-constants";
// cấu hình và quản lý các HTTP requests

// Cấu hình API
const COMPUTER_IP = "192.168.1.77";
const API_URL = `http://${COMPUTER_IP}:3000/api`;

// Hàm lấy API URL với logging
export const getApiUrlAsync = async () => {
  try {
    console.log("Getting API URL...");
    console.log("Platform:", Platform.OS);
    console.log("App ownership:", Constants.appOwnership);
    console.log("Using IP:", COMPUTER_IP);
    console.log("Final API URL:", API_URL);
    return API_URL;
  } catch (error) {
    console.log("❌ Error getting IP:", error);
    return API_URL;
  }
};

// Tạo instance Axios
const api = axios.create({
  baseURL: API_URL,
  timeout: 60000, // Tăng timeout lên 60 giây
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
});

// Request interceptor
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem("accessToken");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Không thay đổi Content-Type nếu đang upload file
      if (config.data instanceof FormData) {
        delete config.headers["Content-Type"];
      }

      // Log request details
      console.log("Request config:", {
        url: config.url,
        method: config.method,
        headers: config.headers,
        data: config.data,
      });

      return config;
    } catch (error) {
      console.error("Request interceptor error:", error);
      return Promise.reject(error);
    }
  },
  (error) => {
    console.error("Request error:", error);
    return Promise.reject(error);
  }
);

// Response interceptor//Xử lý sau khi nhận response
api.interceptors.response.use(
  (response) => {
    // Log successful response
    console.log("Response:", {
      status: response.status,
      data: response.data,
      headers: response.headers,
    });
    return response;
  },
  (error) => {
    console.error("Response error:", {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      status: error.response?.status,
    });

    if (error.code === "ECONNABORTED") {
      throw new Error("Kết nối quá thời gian. Vui lòng thử lại.");
    }

    if (!error.response) {
      // Network error
      throw new Error(
        "Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng."
      );
    }

    if (error.response.status === 401) {
      // Handle unauthorized
      throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    }

    if (error.response.status === 400) {
      throw new Error(error.response.data.message || "Yêu cầu không hợp lệ");
    }

    throw error.response.data || error;
  }
);

export default api;
