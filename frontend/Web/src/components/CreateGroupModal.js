import React, { useState, useEffect } from "react";
import { X, Search, Camera, Check, Users, UserPlus } from "lucide-react";
import { createGroup, getRecentContacts } from "../services/group";
import './css/CreateGroupModal.css';

const CreateGroupModal = ({ isOpen, onClose, onGroupCreated }) => {
  const [groupName, setGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [recentChats, setRecentChats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingContacts, setFetchingContacts] = useState(false);
  const [activeTab, setActiveTab] = useState("recent");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchRecentContacts();
    }
  }, [isOpen]);

  const fetchRecentContacts = async () => {
    try {
      setFetchingContacts(true);
      setError(null);
      console.log("Fetching recent contacts...");
      
      const response = await getRecentContacts();
      console.log("Recent contacts response:", response);
      
      if (response.status === 'success' && response.data?.contacts) {
        console.log("Setting recent chats:", response.data.contacts);
        setRecentChats(response.data.contacts);
      } else {
        console.error("API response not in expected format:", response);
        setRecentChats([]);
        setError("Không thể tải danh sách liên hệ");
      }
    } catch (error) {
      console.error("Error fetching recent contacts:", error);
      setRecentChats([]);
      setError("Không thể tải danh sách liên hệ: " + (error.message || "Lỗi không xác định"));
    } finally {
      setFetchingContacts(false);
    }
  };

  const handleCreateGroup = async () => {
    if (selectedContacts.length < 2) {
      setError("Vui lòng chọn ít nhất 2 thành viên");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log("Creating group with contacts:", selectedContacts);
      
      // Check if user is logged in
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        setError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
        return;
      }
      
      const groupData = {
        name: groupName,
        members: selectedContacts
      };
      
      const response = await createGroup(groupData);
      console.log("Group creation response:", response);

      if (response.status === 'success' && response.data) {
        alert("Tạo nhóm thành công!");
        if (onGroupCreated) {
          // Make sure we pass the complete group data
          console.log("Calling onGroupCreated with:", response.data);
          onGroupCreated(response.data);
        }
        onClose();
      } else {
        console.error("Group creation not successful:", response);
        setError("Có lỗi xảy ra khi tạo nhóm");
      }
    } catch (error) {
      console.error("Error creating group:", error);
      
      // Handle specific error cases
      if (error.message === "Vui lòng đăng nhập lại") {
        setError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        // Optionally redirect to login page after a delay
        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
      } else {
        setError(error.message || "Có lỗi xảy ra khi tạo nhóm");
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleContactSelection = (contact) => {
    setSelectedContacts(prev => {
      const isSelected = prev.some(c => c.userId === contact.userId);
      if (isSelected) {
        return prev.filter(c => c.userId !== contact.userId);
      } else {
        return [...prev, contact];
      }
    });
  };

  const removeSelectedContact = (contactId) => {
    setSelectedContacts(prev => prev.filter(c => c.userId !== contactId));
  };

  const filteredContacts = recentChats.filter(contact => 
    contact.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Tạo nhóm mới</h2>
          <button className="close-button" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          <div className="group-name-input">
            <div className="camera-icon">
              <Camera size={24} />
            </div>
            <input
              type="text"
              placeholder="Tên nhóm"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>

          <div className="search-box">
            <Search size={20} />
            <input
              type="text"
              placeholder="Tìm kiếm bạn bè"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="tabs">
            <button
              className={`tab ${activeTab === "recent" ? "active" : ""}`}
              onClick={() => setActiveTab("recent")}
            >
              Gần đây
            </button>
            <button
              className={`tab ${activeTab === "contacts" ? "active" : ""}`}
              onClick={() => setActiveTab("contacts")}
            >
              Danh bạ
            </button>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="contacts-list">
            {fetchingContacts ? (
              <div className="loading-contacts">
                <div className="loading-spinner"></div>
                <p>Đang tải danh sách liên hệ...</p>
              </div>
            ) : filteredContacts.length > 0 ? (
              filteredContacts.map((contact) => (
                <div
                  key={contact.userId}
                  className={`contact-item ${selectedContacts.some(c => c.userId === contact.userId) ? "selected" : ""}`}
                  onClick={() => toggleContactSelection(contact)}
                >
                  <div className="contact-avatar">
                    {contact.avatar ? (
                      <img src={contact.avatar} alt={contact.name} />
                    ) : (
                      <div className="avatar-placeholder">
                        {contact.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="contact-info">
                    <span className="contact-name">{contact.name}</span>
                    <span className="contact-phone">{contact.lastActive}</span>
                  </div>
                  {selectedContacts.some(c => c.userId === contact.userId) && (
                    <Check className="check-icon" size={20} />
                  )}
                </div>
              ))
            ) : (
              <div className="no-contacts">
                <p>Không có liên hệ gần đây</p>
              </div>
            )}
          </div>

          {selectedContacts.length > 0 && (
            <div className="selected-contacts">
              <h3>Đã chọn ({selectedContacts.length})</h3>
              <div className="selected-contacts-list">
                {selectedContacts.map((contact) => (
                  <div key={contact.userId} className="selected-contact">
                    <span>{contact.name}</span>
                    <button
                      className="remove-button"
                      onClick={() => removeSelectedContact(contact.userId)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="cancel-button" onClick={onClose}>
            Hủy
          </button>
          <button
            className="create-button"
            onClick={handleCreateGroup}
            disabled={loading || selectedContacts.length < 2}
          >
            {loading ? "Đang tạo..." : "Tạo nhóm"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateGroupModal;