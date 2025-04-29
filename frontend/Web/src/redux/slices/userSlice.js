import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  userId: null,
  name: '',
  avatar: '',
  gender: '',
  dateOfBirth: '',
  phone: '',
  status: '',
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUser(state, action) {
        console.log("setUser reducer nhận:", action.payload);
        Object.assign(state, action.payload);
      if (!action.payload || typeof action.payload !== 'object') return;
      Object.assign(state, action.payload);
    },
    updateUserAvatar(state, action) {
      state.avatar = action.payload;
    },
    updateUserProfile(state, action) {
      if (!action.payload || typeof action.payload !== 'object') return;
      Object.assign(state, action.payload);
    },
    updateUserStatus(state, action) {
      state.status = action.payload;
    }
  },
});

export const { setUser, updateUserAvatar, updateUserProfile, updateUserStatus } = userSlice.actions;
export default userSlice.reducer;