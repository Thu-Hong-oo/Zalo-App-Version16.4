import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGroupDetails, getRecentContacts } from '../services/group';
import './css/GroupSidebar.css';
import { Users, Camera, Pencil, ChevronLeft, MoreVertical, UserPlus, Crown } from 'lucide-react';
import api from '../config/api';
import { SocketContext } from '../App';
import { useDispatch, useSelector } from 'react-redux';
import { setSelectedGroup, updateGroupName, updateGroupAvatar, updateGroupMembers } from '../redux/slices/groupSlice';

const GroupSidebar = ({ groupId, isOpen, onClose, onGroupUpdate, groupUpdates }) => {
  const navigate = useNavigate();
  const [groupInfo, setGroupInfo] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);
  const [showConfirmDissolve, setShowConfirmDissolve] = useState(false);
  const [showConfirmClearHistory, setShowConfirmClearHistory] = useState(false);
  const [showEditName, setShowEditName] = useState(false);
  const [showTransferAdmin, setShowTransferAdmin] = useState(false);
  const [showMembersList, setShowMembersList] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [notifications, setNotifications] = useState(true);
  const currentUser = JSON.parse(localStorage.getItem('user'));
//   console.log("thông tin user lấy từ local storage raw:", localStorage.getItem('user'));
//   console.log("thông tin user sau khi parse:", currentUser);
  const [friendsList, setFriendsList] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [recentContacts, setRecentContacts] = useState([]);
  const [searchPhone, setSearchPhone] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [fetchingContacts, setFetchingContacts] = useState(false);
  const [error, setError] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showDissolveSuccess, setShowDissolveSuccess] = useState(false);
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);
  const [showTransferSuccess, setShowTransferSuccess] = useState(false);
  const [showLeaveSuccess, setShowLeaveSuccess] = useState(false);

  const socket = useContext(SocketContext);
  const dispatch = useDispatch();
  const reduxSelectedGroup = useSelector(state => state.group.selectedGroup);

  useEffect(() => {
    if (isOpen && groupId) {
      fetchGroupInfo();
      fetchFriendData();
    }

    // Lắng nghe sự kiện nhóm bị giải tán
    if (socket) {
      socket.on('group:dissolved', (dissolvedGroupId) => {
        if (dissolvedGroupId === groupId) {
          // Nếu đang ở trong nhóm bị giải tán, đóng sidebar và chuyển hướng
          onClose();
          navigate('/app');
        }
      });
    }

    return () => {
      if (socket) {
        socket.off('group:dissolved');
      }
    };
  }, [isOpen, groupId, socket]);

  useEffect(() => {
    if (!groupUpdates || groupUpdates.groupId !== groupId) return;
    if (groupUpdates.type === 'NAME_UPDATED') {
      setGroupInfo(prev => ({ ...prev, name: groupUpdates.data.name }));
    }
    if (groupUpdates.type === 'AVATAR_UPDATED') {
      setGroupInfo(prev => ({ ...prev, avatar: groupUpdates.data.avatarUrl }));
    }
    // Có thể bổ sung các loại event khác
  }, [groupUpdates, groupId]);

  const fetchGroupInfo = async () => {
    try {
      setLoading(true);
      const response = await getGroupDetails(groupId);
      if (response.status === 'success') {
        setGroupInfo(response.data);
        setMembers(response.data.members || []);
        setNotifications(response.data.notifications !== false);
        dispatch(setSelectedGroup(response.data));
        
        // Kiểm tra role của người dùng hiện tại trong danh sách thành viên
        const currentMember = response.data.members?.find(member => member.userId === currentUser?.userId);
        const isUserAdmin = currentMember?.role === 'ADMIN';
        setIsAdmin(isUserAdmin);
        console.log("Admin check:", {
          isAdmin: isUserAdmin,
          currentUserId: currentUser?.userId,
          currentMemberRole: currentMember?.role,
          allAdmins: response.data.members?.filter(m => m.role === 'ADMIN')
        });
      } else {
        console.error('Error fetching group info:', response);
      }
    } catch (error) {
      console.error('Error fetching group info:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFriendData = async () => {
    try {
      const [friendsResponse, requestsResponse] = await Promise.all([
        api.get(`/friends/list/${currentUser.id}`),
        api.get(`/friends/request/sent/${currentUser.id}`)
      ]);

      if (friendsResponse.data.success) {
        setFriendsList(friendsResponse.data.friends);
      }

      if (requestsResponse.data.success) {
        setSentRequests(requestsResponse.data.sent);
      }
    } catch (error) {
      console.error('Error fetching friend data:', error);
    }
  };

  const handleAddFriend = async (userId) => {
    try {
      const response = await api.post('/friends/request', {
        from: currentUser.id,
        to: userId
      });

      if (response.data.success) {
        setSentRequests(prev => [...prev, { to: userId }]);
      } else {
        alert('Không thể gửi lời mời kết bạn');
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      alert('Không thể gửi lời mời kết bạn');
    }
  };

  const handleUpdateAvatar = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      setLoading(true);
      await api.put(`/groups/${groupId}/avatar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await fetchGroupInfo();
      dispatch(updateGroupAvatar({ groupId, avatar: URL.createObjectURL(file) }));
      if (onGroupUpdate) onGroupUpdate();
    } catch (error) {
      console.error('Error updating avatar:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateName = async () => {
    if (!newGroupName.trim()) return;

    try {
      setLoading(true);
      await api.put(`/groups/${groupId}/name`, { name: newGroupName.trim() });
      await fetchGroupInfo();
      dispatch(updateGroupName({ groupId, name: newGroupName.trim() }));
      if (onGroupUpdate) onGroupUpdate();
      setShowEditName(false);
    } catch (error) {
      console.error('Error updating group name:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleNotifications = async () => {
    try {
      setLoading(true);
      await api.put(`/groups/${groupId}/notifications`, {
        enabled: !notifications
      });
      setNotifications(!notifications);
      if (onGroupUpdate) onGroupUpdate();
    } catch (error) {
      console.error('Error toggling notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    try {
      // Nếu là admin và chưa chuyển quyền, hiển thị thông báo
      if (isAdmin) {
        setShowConfirmLeave(false);
        setShowLeaveWarning(true);
        return;
      }

      setLoading(true);
      await api.delete(`/groups/${groupId}/members/${currentUser.userId}`);
      
      // Emit sự kiện thành viên rời nhóm để cập nhật realtime
      if (socket) {
        socket.emit('group:member_leave', {
          groupId,
          userId: currentUser.userId,
          action: 'leave'
        });

        // Emit sự kiện để cập nhật danh sách chat
        socket.emit('chat:update', {
          type: 'group',
          action: 'leave',
          groupId: groupId,
          userId: currentUser.userId
        });
      }

      setShowConfirmLeave(false);
      setShowLeaveSuccess(true);
      
      // Sau 2 giây sẽ chuyển hướng và reload để cập nhật danh sách chat
      setTimeout(() => {
        setShowLeaveSuccess(false);
        navigate('/app');
        window.location.reload(); // Reload để cập nhật danh sách chat
      }, 2000);
    } catch (error) {
      console.error('Error leaving group:', error);
      alert('Không thể rời nhóm: ' + (error.response?.data?.message || 'Đã có lỗi xảy ra'));
    } finally {
      setLoading(false);
    }
  };

  const handleDissolveGroup = async () => {
    try {
      setLoading(true);
      await api.delete(`/groups/${groupId}`);
      
      // Emit sự kiện nhóm bị giải tán để cập nhật realtime
      if (socket) {
        socket.emit('group:dissolve', groupId);
      }
      
      // Hiển thị modal thông báo thành công
      setShowConfirmDissolve(false);
      setShowDissolveSuccess(true);
      
      // Sau 2 giây sẽ chuyển hướng
      setTimeout(() => {
        setShowDissolveSuccess(false);
        navigate('/app');
      }, 2000);
    } catch (error) {
      console.error('Error dissolving group:', error);
      alert('Không thể giải tán nhóm: ' + (error.response?.data?.message || 'Đã có lỗi xảy ra'));
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      setLoading(true);
      await api.delete(`/groups/${groupId}/messages`);
      if (onGroupUpdate) onGroupUpdate();
      setShowConfirmClearHistory(false);
    } catch (error) {
      console.error('Error clearing history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTransferAdmin = async () => {
    if (!selectedMember) {
      alert('Vui lòng chọn thành viên để chuyển quyền');
      return;
    }

    try {
      setLoading(true);
      // Chuyển role của admin hiện tại thành MEMBER
      await api.put(`/groups/${groupId}/members/${currentUser.userId}/role`, {
        role: 'MEMBER'
      });

      // Chuyển role của thành viên được chọn thành ADMIN
      await api.put(`/groups/${groupId}/members/${selectedMember.userId}/role`, {
        role: 'ADMIN'
      });

      await fetchGroupInfo();
      if (onGroupUpdate) onGroupUpdate();
      setShowTransferAdmin(false);
      setSelectedMember(null);
      setShowTransferSuccess(true);
      
      // Đóng modal success và sidebar sau 2 giây
      setTimeout(() => {
        setShowTransferSuccess(false);
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Error transferring admin:', error);
      alert('Không thể chuyển quyền trưởng nhóm: ' + (error.response?.data?.message || error.message || 'Đã có lỗi xảy ra'));
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentContacts = async () => {
    try {
      setFetchingContacts(true);
      setError(null);
      console.log("Fetching recent contacts...");
      
      const response = await getRecentContacts();
      console.log("Recent contacts response:", response);
      
      if (response.status === 'success' && response.data?.contacts) {
        console.log("Setting recent chats:", response.data.contacts);
        setRecentContacts(response.data.contacts);
      } else {
        console.error("API response not in expected format:", response);
        setRecentContacts([]);
        setError("Không thể tải danh sách liên hệ");
      }
    } catch (error) {
      console.error("Error fetching recent contacts:", error);
      setRecentContacts([]);
      setError("Không thể tải danh sách liên hệ: " + (error.message || "Lỗi không xác định"));
    } finally {
      setFetchingContacts(false);
    }
  };

  const handleSearchUser = async () => {
    if (!searchPhone.trim()) return;
    
    setIsSearching(true);
    try {
      // Chuẩn hóa số điện thoại
      let phone = searchPhone.trim();
      if (phone.startsWith('0')) {
        phone = '84' + phone.slice(1);
      }

      const response = await api.get(`/users/${phone}`);
      // Kiểm tra nếu response.data có userId thì là tìm thấy user
      if (response.data && response.data.userId) {
        setSearchResult(response.data);
      } else {
        setSearchResult(null);
        alert('Không tìm thấy người dùng');
      }
    } catch (error) {
      console.error('Error searching user:', error);
      setSearchResult(null);
      alert('Không tìm thấy người dùng');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectUser = (user) => {
    if (!selectedUsers.find(u => u.userId === user.userId)) {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleRemoveUser = (userId) => {
    setSelectedUsers(selectedUsers.filter(u => u.userId !== userId));
  };

  const handleAddMembers = async () => {
    if (selectedUsers.length === 0) {
      alert('Vui lòng chọn ít nhất một thành viên');
      return;
    }

    try {
      const promises = selectedUsers.map(user => 
        api.post(`/groups/${groupId}/members`, {
          userId: user.userId,
          role: 'MEMBER'
        })
      );

      await Promise.all(promises);
      await fetchGroupInfo();
      dispatch(updateGroupMembers({ groupId, members: [...members, ...selectedUsers] }));
      setShowAddMembersModal(false);
      setSelectedUsers([]);
      setSearchPhone('');
      setSearchResult(null);
    } catch (error) {
      console.error('Error adding members:', error);
      alert('Không thể thêm thành viên');
    }
  };

  const openAddMembersModal = () => {
    setShowAddMembersModal(true);
    fetchRecentContacts();
  };

  // Add useEffect to fetch recent contacts when modal opens
  useEffect(() => {
    if (showAddMembersModal) {
      fetchRecentContacts();
    } else {
      // Reset states when modal closes
      setSelectedUsers([]);
      setSearchPhone('');
      setSearchResult(null);
      setRecentContacts([]);
    }
  }, [showAddMembersModal]);

  return (
    <div className={`group-sidebar ${!isOpen ? 'hidden' : ''}`}>
      {!showMembersList ? (
        <>
          <div className="sidebar-header">
            <div className="group-info-header">
              <h2>Thông tin nhóm</h2>
            </div>
          </div>

          <div className="sidebar-content">
            {/* Group Profile */}
            <div className="group-profile">
              <div className="group-avatar">
                {groupInfo?.avatar ? (
                  <img 
                    src={groupInfo.avatar} 
                    alt={groupInfo.name} 
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(groupInfo?.name || '')}&background=random&color=fff&size=96`;
                    }}
                  />
                ) : (
                  <div className="default-avatar">
                    <Users size={40} color="#65676B" />
                  </div>
                )}
                <label className="edit-avatar" htmlFor="avatar-input">
                  <Camera size={16} color="#fff" />
                  <input
                    type="file"
                    id="avatar-input"
                    hidden
                    accept="image/*"
                    onChange={handleUpdateAvatar}
                    disabled={loading}
                  />
                </label>
              </div>
              <div className="group-name-edit">
                <h5>{groupInfo?.name}</h5>
                <button className="group-edit-name" onClick={() => setShowEditName(true)}>
                  <Pencil size={16} />
                </button>
              </div>
            </div>

            {/* Menu List */}
            <div className="menu-list">
              <div className="menu-item" onClick={() => setShowMembersList(true)}>
                <i className="fa-solid fa-users"></i>
                <span>Xem thành viên</span>
              </div>
              <div className="menu-item">
                <i className="fa-solid fa-link"></i>
                <div className="menu-item-content">
                  <span>Link nhóm</span>
                  <span className="menu-item-subtitle">https://zalo.me/g/dcjntb992</span>
                </div>
              </div>

              <div className="menu-item">
                <i className="fa-solid fa-image"></i>
                <div className="menu-item-content">
                  <span>Ảnh, file, link</span>
                  <div className="media-preview">
                    <span>Hình mới nhất của trò chuyện sẽ xuất hiện tại đây</span>
                  </div>
                </div>
              </div>

              <div className="menu-item">
                <i className="fa-regular fa-calendar"></i>
                <span>Lịch nhóm</span>
              </div>

              <div className="menu-item">
                <i className="fa-solid fa-bookmark"></i>
                <span>Tin nhắn đã ghim</span>
              </div>

              <div className="menu-item">
                <i className="fa-solid fa-chart-simple"></i>
                <span>Bình chọn</span>
              </div>

              {/* <div className="menu-item">
                <i className="fa-solid fa-gear"></i>
                <span>Cài đặt nhóm</span>
              </div> */}

              {isAdmin && (
                <div className="menu-item" onClick={() => setShowTransferAdmin(true)}>
                  <i className="fa-solid fa-user-shield"></i>
                  <span>Chuyển quyền trưởng nhóm</span>
                </div>
              )}

              {/* <div className="menu-item danger" onClick={() => setShowConfirmClearHistory(true)}>
                <i className="fa-solid fa-trash"></i>
                <span>Xóa lịch sử trò chuyện</span>
              </div> */}

              <div className="menu-item danger" onClick={() => setShowConfirmLeave(true)}>
                <i className="fa-solid fa-right-from-bracket"></i>
                <span>Rời nhóm</span>
              </div>
             

              {isAdmin && (
                <div className="menu-item danger" onClick={() => setShowConfirmDissolve(true)}>
                  <i className="fa-solid fa-trash-can"></i>
                  <span>Giải tán nhóm</span>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="group-members-header">
            <button className="group-back-button" onClick={() => setShowMembersList(false)}>
              <ChevronLeft size={24} />
            </button>
            <h1>Thành viên</h1>
          </div>

          <button className="group-add-member-button" onClick={openAddMembersModal}>
            <UserPlus size={20} />
            <span>Thêm thành viên</span>
          </button>

          <div className="group-members-section">
            <div className="group-section-header">
              <h2>Danh sách thành viên ({members.length})</h2>
              <button className="group-more-button">
                <MoreVertical size={20} />
              </button>
            </div>

            <div className="group-members-list">
              {members.map((member) => {
                const isCurrentUser = member.userId === currentUser?.userId;

                return (
                  <div key={member.userId} className="group-member-item">
                    <div className="group-member-avatar">
                      <img 
                        src={member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=random`}
                        alt={member.name}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=random`;
                        }}
                      />
                    </div>
                    <div className="group-member-info">
                      <div className="group-member-name">
                        {member.name}
                        {member.role === 'ADMIN' && (
                          <span className="group-admin-badge">
                            <Crown size={14} />
                            Trưởng nhóm
                          </span>
                        )}
                        {isCurrentUser && (
                          <span className="group-you-badge">Bạn</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      {showEditName && (
        <div className="modal">
          <div className="modal-content">
            <h3>Đổi tên nhóm</h3>
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Nhập tên nhóm mới"
              maxLength={50}
            />
            <div className="modal-actions">
              <button onClick={() => setShowEditName(false)}>Hủy</button>
              <button onClick={handleUpdateName} disabled={loading}>
                {loading ? 'Đang xử lý...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmLeave && (
        <div className="modal">
          <div className="modal-content">
            <h3>Rời nhóm</h3>
            <p>Bạn có chắc chắn muốn rời khỏi nhóm này?</p>
            <div className="modal-actions">
              <button onClick={() => setShowConfirmLeave(false)}>Hủy</button>
              <button onClick={handleLeaveGroup} disabled={loading}>
                {loading ? 'Đang xử lý...' : 'Rời nhóm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmDissolve && (
        <div className="modal">
          <div className="modal-content">
            <h3>Giải tán nhóm</h3>
            <p>Bạn có chắc chắn muốn giải tán nhóm này? Hành động này không thể hoàn tác.</p>
            <div className="modal-actions">
              <button onClick={() => setShowConfirmDissolve(false)}>Hủy</button>
              <button onClick={handleDissolveGroup} disabled={loading}>
                {loading ? 'Đang xử lý...' : 'Giải tán'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmClearHistory && (
        <div className="modal">
          <div className="modal-content">
            <h3>Xóa lịch sử trò chuyện</h3>
            <p>Bạn có chắc chắn muốn xóa toàn bộ lịch sử trò chuyện của nhóm?</p>
            <div className="modal-actions">
              <button onClick={() => setShowConfirmClearHistory(false)}>Hủy</button>
              <button onClick={handleClearHistory} disabled={loading}>
                {loading ? 'Đang xử lý...' : 'Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTransferAdmin && (
        <div className="modal">
          <div className="modal-content">
            <h3>Chuyển quyền trưởng nhóm</h3>
            <p className="modal-description">
              Sau khi chuyển quyền, bạn sẽ trở thành thành viên thông thường của nhóm.
            </p>
            <div className="members-list">
              {members
                .filter(member => member.role === 'MEMBER' && member.userId !== currentUser?.userId)
                .map((member) => (
                  <div
                    key={member.userId}
                    className={`member-item ${selectedMember?.userId === member.userId ? 'selected' : ''}`}
                    onClick={() => setSelectedMember(member)}
                  >
                    <img 
                      src={member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=random`}
                      alt={member.name} 
                      className="member-avatar"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=random`;
                      }}
                    />
                    <div className="member-info">
                      <p className="member-name">{member.name}</p>
                      <p className="member-role">Thành viên</p>
                    </div>
                  </div>
                ))}
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowTransferAdmin(false)}>Hủy</button>
              <button onClick={handleTransferAdmin} disabled={!selectedMember || loading}>
                {loading ? 'Đang xử lý...' : 'Chuyển quyền'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Members Modal */}
      {showAddMembersModal && (
        <div className="modal">
          <div className="modal-content">
            <h3>Thêm thành viên</h3>
            
            {/* Search section */}
            <div className="search-section">
              <div className="search-input">
                <input
                  type="text"
                  value={searchPhone}
                  onChange={(e) => setSearchPhone(e.target.value)}
                  placeholder="Nhập số điện thoại"
                />
                <button onClick={handleSearchUser} disabled={isSearching || !searchPhone.trim()}>
                  {isSearching ? 'Đang tìm...' : 'Tìm kiếm'}
                </button>
              </div>
              
              {searchResult && (
                <div className="search-result">
                  <div className="user-item">
                    <img 
                      src={searchResult.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(searchResult.name)}&background=random`}
                      alt={searchResult.name}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(searchResult.name)}&background=random`;
                      }}
                    />
                    <div className="user-info">
                      <span className="user-name">{searchResult.name}</span>
                      <span className="user-phone">{searchResult.phone}</span>
                    </div>
                    {members.some(member => member.userId === searchResult.userId) ? (
                      <button disabled className="already-member">Đã là thành viên</button>
                    ) : (
                      <button 
                        onClick={() => handleSelectUser(searchResult)}
                        disabled={selectedUsers.some(u => u.userId === searchResult.userId)}
                      >
                        {selectedUsers.some(u => u.userId === searchResult.userId) ? 'Đã chọn' : 'Thêm'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Selected users */}
            {selectedUsers.length > 0 && (
              <div className="selected-users">
                <h4>Đã chọn ({selectedUsers.length})</h4>
                <div className="selected-users-list">
                  {selectedUsers.map(user => (
                    <div key={user.userId} className="selected-user-item">
                      <img 
                        src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`}
                        alt={user.name}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`;
                        }}
                      />
                      <span>{user.name}</span>
                      <button onClick={() => handleRemoveUser(user.userId)}>×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent contacts */}
            <div className="recent-contacts">
              <h4>Trò chuyện gần đây</h4>
              {error && <div className="error-message">{error}</div>}
              {fetchingContacts ? (
                <div className="loading">Đang tải danh sách liên hệ...</div>
              ) : (
                <div className="recent-contacts-list">
                  {recentContacts.length > 0 ? (
                    recentContacts
                      .filter(contact => !members.some(member => member.userId === contact.userId)) // Lọc bỏ các thành viên đã có trong nhóm
                      .map(contact => (
                        <div key={contact.userId} className="user-item">
                          <img 
                            src={contact.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=random`}
                            alt={contact.name}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=random`;
                            }}
                          />
                          <div className="user-info">
                            <span className="user-name">{contact.name}</span>
                            <span className="user-phone">{contact.phone}</span>
                          </div>
                          <button 
                            onClick={() => handleSelectUser(contact)}
                            disabled={selectedUsers.some(u => u.userId === contact.userId)}
                          >
                            {selectedUsers.some(u => u.userId === contact.userId) ? 'Đã chọn' : 'Thêm'}
                          </button>
                        </div>
                      ))
                  ) : (
                    <div className="no-contacts">Không có cuộc trò chuyện nào gần đây</div>
                  )}
                </div>
              )}
            </div>

            {/* Modal actions */}
            <div className="modal-actions">
              <button onClick={() => setShowAddMembersModal(false)}>Hủy</button>
              <button 
                onClick={handleAddMembers}
                disabled={selectedUsers.length === 0}
              >
                {loading ? 'Đang thêm...' : 'Thêm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dissolve Success Modal */}
      {showDissolveSuccess && (
        <div className="modal">
          <div className="modal-content success-modal">
            <div className="success-icon">
              <i className="fa-solid fa-check-circle"></i>
            </div>
            <h3>Giải tán nhóm thành công</h3>
            <p>Bạn sẽ được chuyển về trang chủ...</p>
          </div>
        </div>
      )}

      {/* Leave Warning Modal for Admin */}
      {showLeaveWarning && (
        <div className="modal">
          <div className="modal-content warning-modal">
            <div className="warning-icon">
              <i className="fa-solid fa-exclamation-circle"></i>
            </div>
            <h3>Không thể rời nhóm</h3>
            <p>Bạn cần chuyển quyền trưởng nhóm cho thành viên khác trước khi rời nhóm.</p>
            <div className="modal-actions">
              <button onClick={() => setShowLeaveWarning(false)}>Đóng</button>
              <button 
                onClick={() => {
                  setShowLeaveWarning(false);
                  setShowTransferAdmin(true);
                }}
                className="primary"
              >
                Chuyển quyền ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Success Modal */}
      {showTransferSuccess && (
        <div className="modal">
          <div className="modal-content success-modal">
            <div className="success-icon">
              <i className="fa-solid fa-check-circle"></i>
            </div>
            <h3>Đã chuyển quyền trưởng nhóm thành công</h3>
            <p>Bạn sẽ trở thành thành viên thông thường...</p>
          </div>
        </div>
      )}

      {/* Leave Success Modal */}
      {showLeaveSuccess && (
        <div className="modal">
          <div className="modal-content success-modal">
            <div className="success-icon">
              <i className="fa-solid fa-check-circle"></i>
            </div>
            <h3>Bạn đã rời khỏi nhóm thành công</h3>
            <p>Bạn sẽ được chuyển về trang chủ...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupSidebar; 