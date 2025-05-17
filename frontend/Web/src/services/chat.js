import api from '../config/api'

export const sendMessage = async (phone, content) => {
  try {
    const response = await api.post(`/chat/send/${phone}`, { content })
    return response.data
  } catch (error) {
    throw error
  }
}

export const getChatHistory = async (phone) => {
  try {
    const response = await api.get(`/chat/history/${phone}`)
    return response.data
  } catch (error) {
    throw error
  }
}

export const markAsRead = async (phone) => {
  try {
    const response = await api.post(`/chat/read/${phone}`)
    return response.data
  } catch (error) {
    throw error
  }
}

export const getConversationInfo = async (phone) => {
  try {
    const response = await api.get(`/chat/conversation/${phone}`)
    return response.data
  } catch (error) {
    throw error
  }
}

export const deleteMessage = async (messageId) => {
  try {
    const response = await api.delete(`/chat/message/${messageId}`)
    return response.data
  } catch (error) {
    throw error
  }
}

export const forwardMessage = async (messageId, targetPhone) => {
  try {
    const response = await api.post(`/chat/forward/${messageId}`, { targetPhone })
    return response.data
  } catch (error) {
    throw error
  }
}

export const uploadFile = async (phone, file) => {
  try {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await api.post(`/chat/upload/${phone}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data
  } catch (error) {
    throw error
  }
}

export const getTypingStatus = async (phone) => {
  try {
    const response = await api.get(`/chat/typing/${phone}`)
    return response.data
  } catch (error) {
    throw error
  }
}

export const setTypingStatus = async (phone, isTyping) => {
  try {
    const response = await api.post(`/chat/typing/${phone}`, { isTyping })
    return response.data
  } catch (error) {
    throw error
  }
} 