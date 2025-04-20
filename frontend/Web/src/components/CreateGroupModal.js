"use client";

import React, { useState, useEffect } from "react";
import { X, Search, Camera, Check, Users, UserPlus } from "lucide-react";
import api from "../config/api";
import './css/CreateGroupModal.css';

const CreateGroupModal = ({ isOpen, onClose }) => {
  const [groupName, setGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [recentChats, setRecentChats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("recent");

  useEffect(() => {
    if (isOpen) {
      fetchRecentContacts();
    }
  }, [isOpen]);

  const fetchRecentContacts = async () => {
    try {
      const response = await api.get("/users/recent-contacts");
      if (response.data.status === "success") {
        setRecentChats(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching recent contacts:", error);
    }
  };

  const handleCreateGroup = async () => {
    if (selectedContacts.length < 2) {
      alert("Vui lòng chọn ít nhất 2 thành viên");
      return;
    }

    try {
      setLoading(true);
      const response = await api.post("/chat/groups", {
        name: groupName || `Nhóm của ${selectedContacts.map(c => c.name).join(", ")}`,
        members: selectedContacts.map(c => c.id)
      });

      if (response.data.status === "success") {
        alert("Tạo nhóm thành công!");
        onClose();
      }
    } catch (error) {
      console.error("Error creating group:", error);
      alert("Có lỗi xảy ra khi tạo nhóm");
    } finally {
      setLoading(false);
    }
  };

  const toggleContactSelection = (contact) => {
    setSelectedContacts(prev => {
      const isSelected = prev.some(c => c.id === contact.id);
      if (isSelected) {
        return prev.filter(c => c.id !== contact.id);
      } else {
        return [...prev, contact];
      }
    });
  };

  const removeSelectedContact = (contactId) => {
    setSelectedContacts(prev => prev.filter(c => c.id !== contactId));
  };

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

          <div className="contacts-list">
            {recentChats.map((contact) => (
              <div
                key={contact.id}
                className={`contact-item ${selectedContacts.some(c => c.id === contact.id) ? "selected" : ""}`}
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
                  <span className="contact-phone">{contact.phone}</span>
                </div>
                {selectedContacts.some(c => c.id === contact.id) && (
                  <Check className="check-icon" size={20} />
                )}
              </div>
            ))}
          </div>

          {selectedContacts.length > 0 && (
            <div className="selected-contacts">
              <h3>Đã chọn ({selectedContacts.length})</h3>
              <div className="selected-contacts-list">
                {selectedContacts.map((contact) => (
                  <div key={contact.id} className="selected-contact">
                    <span>{contact.name}</span>
                    <button
                      className="remove-button"
                      onClick={() => removeSelectedContact(contact.id)}
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