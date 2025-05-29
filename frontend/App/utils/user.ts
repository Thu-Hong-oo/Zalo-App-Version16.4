// src/utils/user.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export const getStoredUser = async () => {
  const raw = await AsyncStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
};

export const getCurrentUserId = async () => {
  const u = await getStoredUser();
  return u?.userId ?? null;          // ⚠️  KHÔNG fallback sang phone
};
