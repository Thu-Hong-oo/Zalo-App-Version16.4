import api from "../config/api";

const getCurrentUser = () => {
  try {
    // Try to get user from localStorage
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user && user.userId) {
        return user;
      }
    }

    // Try to get userInfo from localStorage as fallback
    const userInfoStr = localStorage.getItem("userInfo");
    if (userInfoStr) {
      const userInfo = JSON.parse(userInfoStr);
      if (userInfo && userInfo.userId) {
        return userInfo;
      }
    }

    return null;
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
};
export const markAsReadGroup = async (groupId) => {
  try {
    const response = await api.post(`/chat-group/${groupId}/read`);
    return response.data;
  } catch (error) {
    console.error("❌ Error in markAsReadGroup:", error);
    throw error;
  }
};

/**
 * Create a new group
 * @param {Object} groupData - Group data including name and members
 * @returns {Promise} - Promise with the response from the API
 */
export const createGroup = async (groupData) => {
  try {
    console.log("Creating group with data:", groupData);

    // Validate group data
    if (!groupData.members || groupData.members.length < 2) {
      throw new Error("Thiếu thông tin nhóm hoặc số lượng thành viên không đủ");
    }

    // Get current user
    const userInfo = getCurrentUser();
    if (!userInfo) {
      console.error("User info not found in localStorage");
      throw new Error("Vui lòng đăng nhập lại");
    }

    console.log("User info found:", userInfo);

    // Prepare group data
    const finalGroupData = {
      name:
        groupData.name ||
        `Nhóm của ${groupData.members
          .slice(0, 3)
          .map((m) => m.name)
          .join(", ")}`,
      members: [
        ...groupData.members.map((m) => m.userId),
        userInfo.userId, // Add creator to members list
      ],
      createdBy: userInfo.userId,
    };

    console.log("Sending group creation request with data:", finalGroupData);

    // Make API request
    const response = await api.post("/groups", finalGroupData);

    console.log("Group creation response:", response.data);

    if (!response.data) {
      throw new Error("Không nhận được thông tin nhóm từ server");
    }

    // Handle different response formats
    let groupId, groupName, memberCount;

    if (response.data.groupId) {
      // Format 1: { groupId, name, ... }
      groupId = response.data.groupId;
      groupName = response.data.name || finalGroupData.name;
      memberCount = response.data.memberCount || finalGroupData.members.length;
    } else if (response.data.id) {
      // Format 2: { id, name, ... }
      groupId = response.data.id;
      groupName = response.data.name || finalGroupData.name;
      memberCount = response.data.memberCount || finalGroupData.members.length;
    } else {
      throw new Error("Không nhận được thông tin nhóm từ server");
    }

    // Return consistent format for both web and app
    return {
      status: "success",
      data: {
        groupId: groupId,
        id: groupId, // Include both for compatibility
        name: groupName,
        memberCount: memberCount,
      },
    };
  } catch (error) {
    console.error("Create group error:", error);
    if (error.response) {
      console.error("Server error details:", {
        status: error.response.status,
        data: error.response.data,
      });
    }
    throw error;
  }
};

/**
 * Get recent contacts for group creation
 * @returns {Promise} - Promise with the response from the API
 */
export const getRecentContacts = async () => {
  try {
    console.log("Getting recent contacts...");

    const response = await api.get("/users/recent-contacts");

    if (!response.data) {
      throw new Error("Không nhận được dữ liệu từ server");
    }

    return {
      status: "success",
      data: {
        contacts: response.data.contacts.map((contact) => ({
          userId: contact.userId,
          name: contact.name,
          avatar: contact.avatar,
          lastActive: contact.lastActive || "Hoạt động gần đây",
        })),
      },
    };
  } catch (error) {
    console.error("Get recent contacts error:", error);
    if (error.response) {
      console.error("Server error details:", {
        status: error.response.status,
        data: error.response.data,
      });
    }
    throw error;
  }
};

/**
 * Get group details by ID
 * @param {string} groupId - The ID of the group to fetch
 * @returns {Promise} - Promise with the response from the API
 */
export const getGroupDetails = async (groupId) => {
  try {
    console.log(`Getting group details for group ID: ${groupId}`);

    const response = await api.get(`/groups/${groupId}`);

    if (!response.data) {
      throw new Error("Không nhận được dữ liệu từ server");
    }

    return {
      status: "success",
      data: response.data,
    };
  } catch (error) {
    console.error("Get group details error:", error);
    if (error.response) {
      console.error("Server error details:", {
        status: error.response.status,
        data: error.response.data,
      });
    }
    throw error;
  }
};

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

export const getAllGroups = async () => {
  try {
    console.log("Getting all groups...");

    const response = await api.get("/groups");

    if (!response.data) {
      throw new Error("Không nhận được dữ liệu từ server");
    }

    return {
      status: "success",
      data: response.data,
    };
  } catch (error) {
    console.error("Get all groups error:", error);
    if (error.response) {
      console.error("Server error details:", {
        status: error.response.status,
        data: error.response.data,
      });
    }
    throw error;
  }
};

// Constants for file validation
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-rar-compressed",
  "text/plain",
  "video/mp4",
];

const validateFile = (file) => {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File ${file.name} is too large. Maximum size is 10MB.`);
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`File type ${file.type} is not allowed.`);
  }
};

export const uploadFiles = async (groupId, formData, onProgress) => {
  const MAX_RETRIES = 3;
  let retryCount = 0;

  // Validate all files before upload
  const files = formData.getAll("files");
  files.forEach(validateFile);

  while (retryCount < MAX_RETRIES) {
    try {
      const response = await api.post(
        `/chat-group/${groupId}/upload`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (progressEvent) => {
            if (onProgress && progressEvent.total) {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              onProgress(percentCompleted);
            }
          },
        }
      );

      if (!response.data || response.data.status !== "success") {
        throw new Error("Không nhận được phản hồi từ server");
      }

      // Return array of uploaded files
      if (response.data.data.urls && response.data.data.urls.length > 0) {
        return {
          status: "success",
          data: response.data.data.urls.map((url, index) => ({
            url,
            name: response.data.data.files[index].originalname,
            size: response.data.data.files[index].size,
            type: response.data.data.files[index].mimetype,
          })),
        };
      }

      return {
        status: "success",
        data: [],
      };
    } catch (error) {
      console.error(`Upload attempt ${retryCount + 1} failed:`, error);

      if (error.response) {
        console.error("Server error details:", {
          status: error.response.status,
          data: error.response.data,
        });
      }

      retryCount++;
      if (retryCount === MAX_RETRIES) {
        throw error;
      }

      // Exponential backoff
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * Math.pow(2, retryCount))
      );
    }
  }
};
