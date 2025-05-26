// Format phone number for storage in DynamoDB (84xxx)
export const formatPhoneForStorage = (phone) => {
  if (!phone) return '';
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // If phone starts with 0, remove it
  if (digits.startsWith('0')) {
    return `84${digits.substring(1)}`;
  }
  
  // If phone doesn't start with 84, add it
  if (!digits.startsWith('84')) {
    return `84${digits}`;
  }
  
  return digits;
};

// Format phone number for display (0xxx)
export const formatPhone = (phone) => {
  if (!phone) return '';
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // If starts with 84, convert to 0
  if (digits.startsWith('84')) {
    return `0${digits.substring(2)}`;
  }
  
  // If doesn't start with 0, add it
  if (!digits.startsWith('0')) {
    return `0${digits}`;
  }
  
  return digits;
}; 