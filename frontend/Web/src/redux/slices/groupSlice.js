import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  groups: [],
  selectedGroup: null,
};

const groupSlice = createSlice({
  name: 'group',
  initialState,
  reducers: {
    setGroups(state, action) {
      state.groups = action.payload;
    },
    updateGroup(state, action) {
      const updated = action.payload;
      state.groups = state.groups.map(g => g.groupId === updated.groupId ? { ...g, ...updated } : g);
      if (state.selectedGroup?.groupId === updated.groupId) {
        state.selectedGroup = { ...state.selectedGroup, ...updated };
      }
    },
    setSelectedGroup(state, action) {
      state.selectedGroup = action.payload;
    },
    updateGroupMembers(state, action) {
      const { groupId, members } = action.payload;
      state.groups = state.groups.map(g => g.groupId === groupId ? { ...g, members } : g);
      if (state.selectedGroup?.groupId === groupId) {
        state.selectedGroup = { ...state.selectedGroup, members };
      }
    },
    updateGroupAvatar(state, action) {
      const { groupId, avatar } = action.payload;
      state.groups = state.groups.map(g => g.groupId === groupId ? { ...g, avatar } : g);
      if (state.selectedGroup?.groupId === groupId) {
        state.selectedGroup = { ...state.selectedGroup, avatar };
      }
    },
    updateGroupName(state, action) {
      const { groupId, name } = action.payload;
      state.groups = state.groups.map(g => g.groupId === groupId ? { ...g, name } : g);
      if (state.selectedGroup?.groupId === groupId) {
        state.selectedGroup = { ...state.selectedGroup, name };
      }
    },
  },
});

export const { setGroups, updateGroup, setSelectedGroup, updateGroupMembers, updateGroupAvatar, updateGroupName } = groupSlice.actions;
export default groupSlice.reducer; 