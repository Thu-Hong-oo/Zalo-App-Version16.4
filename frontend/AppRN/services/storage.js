import AsyncStorage from '@react-native-async-storage/async-storage';

export const saveAccessToken = async (token) => {
  try {
    await AsyncStorage.setItem('accessToken', token);
  } catch (error) {
    console.error('Error saving access token:', error);
    throw error;
  }
};

export const saveRefreshToken = async (token) => {
  try {
    await AsyncStorage.setItem('refreshToken', token);
  } catch (error) {
    console.error('Error saving refresh token:', error);
    throw error;
  }
};

export const saveUserInfo = async (userInfo) => {
  try {
    await AsyncStorage.setItem('userInfo', JSON.stringify(userInfo));
  } catch (error) {
    console.error('Error saving user info:', error);
    throw error;
  }
};

export const getAccessToken = async () => {
  try {
    return await AsyncStorage.getItem('accessToken');
  } catch (error) {
    console.error('Error getting access token:', error);
    throw error;
  }
};

export const getRefreshToken = async () => {
  try {
    return await AsyncStorage.getItem('refreshToken');
  } catch (error) {
    console.error('Error getting refresh token:', error);
    throw error;
  }
};

export const getUserInfo = async () => {
  try {
    const userInfo = await AsyncStorage.getItem('userInfo');
    return userInfo ? JSON.parse(userInfo) : null;
  } catch (error) {
    console.error('Error getting user info:', error);
    throw error;
  }
};

export const clearStorage = async () => {
  try {
    await AsyncStorage.clear();
  } catch (error) {
    console.error('Error clearing storage:', error);
    throw error;
  }
};