import api from "../../config/api";
import { getAccessToken } from "../../services/storage";

export const getConversations = async () => {
  try {
    const response = await api.get("/chat/conversations");
    return response.data;
  } catch (error) {
    console.error("❌ Error in getConversations:", error);
    throw error;
  }
};

export const getChatHistory = async (phone) => {
  try {
    const response = await api.get(`/chat/history/${phone}`);
    return response.data;
  } catch (error) {
    console.error("❌ Error in getChatHistory:", error);
    throw error;
  }
};

export const sendMessage = async (receiverPhone, content) => {
  try {
    const response = await api.post("/chat/message", {
      receiverPhone,
      content,
    });
    return response.data;
  } catch (error) {
    console.error("❌ Error in sendMessage:", error);
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
