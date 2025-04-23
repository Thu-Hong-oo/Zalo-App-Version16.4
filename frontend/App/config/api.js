import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { Platform } from "react-native";

// Default configuration

const COMPUTER_IP = "192.168.148.43"; // Your computer's IP address

const API_PORT = "3000";

// Get the appropriate base URL based on environment
const getDefaultBaseUrl = () => {
  // Use computer IP for both dev and prod on mobile
  if (Platform.OS !== "web") {
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
      console.log(
        "Interceptor - Token:",
        token ? "Token exists" : "No token found"
      );

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log(
          "Interceptor - Added token to headers:",
          config.headers.Authorization
        );
      } else {
        console.log(
          "Interceptor - No token found, request will be sent without auth"
        );
      }

      console.log("Interceptor - Final request config:", {
        url: config.url,
        method: config.method,
        headers: config.headers,
      });

      return config;
    } catch (error) {
      console.error("Interceptor error:", error);
      return config;
    }
  },
  (error) => {
    console.error("Interceptor request error:", error);
    return Promise.reject(error);
  }
);

// Add response interceptor
api.interceptors.response.use(
  (response) => {
    console.log("Response interceptor - Success:", {
      url: response.config.url,
      status: response.status,
    });
    return response;
  },
  (error) => {
    console.error("Response interceptor - Error:", {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data,
    });

    if (error.response?.status === 401) {
      console.log("Unauthorized - Token may be invalid or expired");
    }

    return Promise.reject(error);
  }
);

// Function to update baseURL
export const updateBaseURL = (newBaseURL) => {
  api.defaults.baseURL = `${newBaseURL}/api`;
  console.log("Updated API baseURL:", api.defaults.baseURL);
};

// Check server connection
export const checkServerConnection = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/health`, {
      timeout: 5000,
      headers: { "Cache-Control": "no-cache" },
    });
    return response.status === 200;
  } catch (error) {
    console.error("Server connection check failed:", error);
    return false;
  }
};
export default api;
