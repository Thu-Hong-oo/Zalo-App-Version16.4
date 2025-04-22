import api from "../../config/api";
import { getAccessToken } from "../../services/storage";

// Lấy danh sách tin nhắn trong nhóm
export const getGroupMessages = async (groupId, options = {}) => {
  try {
    const { date, limit = 50, before = true, lastEvaluatedKey } = options;
    const params = { limit, before };

    if (date) {
      params.date = date;
    }
    if (lastEvaluatedKey) {
      params.lastEvaluatedKey = lastEvaluatedKey;
    }

    const response = await api.get(`/chat-group/${groupId}/messages`, {
      params,
    });
    return response.data;
  } catch (error) {
    console.error("❌ Error in getGroupMessages:", error);
    throw error;
  }
};

// Gửi tin nhắn trong nhóm
export const sendGroupMessage = async (
  groupId,
  content,
  fileUrl = null,
  fileType = null
) => {
  try {
    const response = await api.post(`/chat-group/${groupId}/messages`, {
      content,
      fileUrl,
      fileType,
    });
    return response.data;
  } catch (error) {
    console.error("❌ Error in sendGroupMessage:", error);
    throw error;
  }
};

// Thu hồi tin nhắn trong nhóm
export const recallGroupMessage = async (groupId, messageId) => {
  try {
    const response = await api.put(
      `/chat-group/${groupId}/messages/${messageId}/recall`
    );
    return response.data;
  } catch (error) {
    console.error("❌ Error in recallGroupMessage:", error);
    throw error;
  }
};

// Xóa tin nhắn trong nhóm
export const deleteGroupMessage = async (groupId, messageId) => {
  try {
    const response = await api.delete(
      `/chat-group/${groupId}/messages/${messageId}`
    );
    return response.data;
  } catch (error) {
    console.error("❌ Error in deleteGroupMessage:", error);
    throw error;
  }
};

// Chuyển tiếp tin nhắn từ nhóm
export const forwardGroupMessage = async (
  groupId,
  sourceMessageId,
  targetId,
  targetType
) => {
  try {
    const response = await api.post(`/chat-group/${groupId}/messages/forward`, {
      sourceMessageId,
      targetId,
      targetType,
    });
    return response.data;
  } catch (error) {
    console.error("❌ Error in forwardGroupMessage:", error);
    throw error;
  }
};

// Lấy thông tin nhóm
export const getGroupInfo = async (groupId) => {
  try {
    const response = await api.get(`/groups/${groupId}`);
    return response.data;
  } catch (error) {
    console.error("❌ Error in getGroupInfo:", error);
    throw error;
  }
};
