import { configureStore } from '@reduxjs/toolkit';
import groupReducer from './slices/groupSlice';
import userReducer from './slices/userSlice';

export const store = configureStore({
  reducer: {
    group: groupReducer,
    user: userReducer,
  },
}); 