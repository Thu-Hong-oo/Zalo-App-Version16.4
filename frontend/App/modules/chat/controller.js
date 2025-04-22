import api from "../../config/api";
import { getAccessToken } from "../../services/storage";
// // Hàm khởi tạo API
// export const initApi = async () => {
//   try {
//     const url = await getApiUrlAsync();
//     api.defaults.baseURL = url;
//     console.log('✅ API initialized with URL:', url);
//   } catch (error) {
//     console.log('Failed to initialize API:', error);
//     throw error;
//   }
// };

export const getConversations = async () => {
  try {
    const response = await api.get("/chat/conversations");
    return response.data;
  } catch (error) {
    console.error("❌ Error in getConversations:", error);
    throw error;
  }
};

export const getChatHistory = async (otherParticipantPhone, options = {}) => {
  try {
    const { date, limit = 50, before = true } = options;
    const params = { limit };

    if (date) {
      params.date = date;
      params.before = before;
    }

    const response = await api.get(`/chat/history/${otherParticipantPhone}`, {
      params,
    });
    return response.data;
  } catch (error) {
    console.error("Get chat history error:", error);
    throw error;
  }
};

export const sendMessage = async (receiverPhone, content) => {
  try {
    console.log("Sending message with params:", {
      receiverPhone,
      content
    });

    // Thêm token vào header
    const token = await getAccessToken();
    const config = {
      headers: {
        Authorization: `Bearer ${token}`
      }
    };

    const response = await api.post("/chat/message", {
      receiverPhone,
      content,
    }, config);

    console.log("Raw response from server:", {
      status: response.status,
      statusText: response.statusText,
      data: response.data,
      headers: response.headers
    });
    
    if (!response || !response.data) {
      throw new Error("Không nhận được phản hồi từ server");
    }

    // Kiểm tra cấu trúc response
    const messageData = response.data;
    console.log("Message data:", messageData);

    // Nếu response không có messageId nhưng có status success thì vẫn coi là thành công
    if (messageData.status === "success") {
      return messageData;
    }

    if (!messageData.messageId) {
      throw new Error("Response không chứa messageId");
    }

    return messageData;
  } catch (error) {
    console.error("❌ Error in sendMessage:", {
      error: error.message,
      response: error.response?.data,
      status: error.response?.status,
      config: error.config
    });
    throw error;
  }
};

export const markMessageAsRead = async (messageId) => {
  try {
    const response = await api.put(`/chat/message/${messageId}/read`);
    return response.data;
  } catch (error) {
    console.error("❌ Error in markMessageAsRead:", error);
    throw error;
  }
};

export const recallMessage = async (messageId, receiverPhone) => {
  try {
    const response = await api.put("/chat/messages/recall", {
      messageId,
      receiverPhone,
    });
    return response.data;
  } catch (error) {
    console.error("❌ Error in recallMessage:", error);
    throw error;
  }
};

export const forwardMessage = async (messageId, receiverPhone, content) => {
  try {
    const response = await api.post("/chat/messages/forward", {
      messageId,
      receiverPhone,
      content,
    });
    return response.data;
  } catch (error) {
    console.error("❌ Error in forwardMessage:", error);
    throw error;
  }
};

export const deleteMessage = async (messageId) => {
  try {
    const response = await api.delete("/chat/messages/delete", {
      data: { messageId },
    });
    return response.data;
  } catch (error) {
    console.error("❌ Error in deleteMessage:", error);
    throw error;
  }
};