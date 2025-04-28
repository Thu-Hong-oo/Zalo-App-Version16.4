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
      const idx = state.groups.findIndex(g => g.groupId === updated.groupId);
      if (idx !== -1) {
        state.groups[idx] = { ...state.groups[idx], ...updated };
      }
      if (state.selectedGroup && state.selectedGroup.groupId === updated.groupId) {
        state.selectedGroup = { ...state.selectedGroup, ...updated };
      }
    },
    setSelectedGroup(state, action) {
      state.selectedGroup = action.payload;
    },
    updateGroupMembers(state, action) {
      const { groupId, members } = action.payload;
      const idx = state.groups.findIndex(g => g.groupId === groupId);
      if (idx !== -1) {
        state.groups[idx].members = members;
      }
      if (state.selectedGroup && state.selectedGroup.groupId === groupId) {
        state.selectedGroup.members = members;
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
    removeGroup(state, action) {
      const groupId = action.payload;
      state.groups = state.groups.filter(g => g.groupId !== groupId);
      if (state.selectedGroup && state.selectedGroup.groupId === groupId) {
        state.selectedGroup = null;
      }
    },
  },
});

export const { setGroups, updateGroup, setSelectedGroup, updateGroupMembers, updateGroupAvatar, updateGroupName, removeGroup } = groupSlice.actions;
export default groupSlice.reducer; 