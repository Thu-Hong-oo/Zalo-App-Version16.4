import { API_URL } from './api';

export { API_URL };
export const SOCKET_URL = 'http://localhost:3000';

// Message types
export const MESSAGE_TYPES = {
  TEXT: 'text',
  FILE: 'file',
  IMAGE: 'image'
};

// Message status
export const MESSAGE_STATUS = {
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read'
};

// Socket events
export const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  NEW_MESSAGE: 'newMessage',
  MESSAGE_RECALLED: 'messageRecalled',
  MESSAGE_READ: 'messageRead',
  ERROR: 'error'
}; 