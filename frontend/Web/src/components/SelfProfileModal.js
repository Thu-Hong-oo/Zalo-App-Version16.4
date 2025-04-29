import React, { useEffect, useState } from 'react';
import './css/MemberInfoModal.css';
import api from '../config/api';
import { Camera, Pencil } from 'lucide-react';

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()}`;
};

const SelfProfileModal = ({ onClose, userId }) => {
  const [user, setUser] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ name: '', gender: '', dateOfBirth: '', phone: '', coverUrl: '', avatar: '' });
  const [loading, setLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const res = await api.get(`/users/byId/${userId}`);
      setUser(res.data);
      setForm({
        name: res.data.name || '',
        gender: res.data.gender || '',
        dateOfBirth: res.data.dateOfBirth || '',
        phone: res.data.phone || '',
        coverUrl: res.data.coverUrl || '',
        avatar: res.data.avatar || '',
      });
    };
    fetchProfile();
  }, [userId]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAvatarChange = (e) => {
    if (e.target.files[0]) {
      setAvatarFile(e.target.files[0]);
      setForm({ ...form, avatar: URL.createObjectURL(e.target.files[0]) });
    }
  };
  const handleCoverChange = (e) => {
    if (e.target.files[0]) {
      setCoverFile(e.target.files[0]);
      setForm({ ...form, coverUrl: URL.createObjectURL(e.target.files[0]) });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Update avatar if changed
      if (avatarFile) {
        const fd = new FormData();
        fd.append('avatar', avatarFile);
        await api.post('/users/avatar', fd);
      }
      // Update cover if changed 
      // ...
      // Update profile
      await api.put('/users/profile', {
        name: form.name,
        gender: form.gender,
        dateOfBirth: form.dateOfBirth,
      });
      setEditMode(false);
      window.location.reload();
    } catch (err) {
      alert('Cập nhật thất bại!');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="member-info-modal" onClick={e => e.stopPropagation()} style={{maxWidth: 420}}>
        <div className="modal-header">
          <span>Thông tin tài khoản</span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
      
        <div className="profile-header" style={{marginTop: 0}}>
          <div style={{position: 'relative'}}>
            <img className="avatar-member-infor" src={form.avatar || '/default-avatar.png'} alt={form.name} />
            {editMode && (
              <label htmlFor="avatar-input" className="edit-avatar-btn" style={{position: 'absolute', bottom: 0, right: 0, background: '#fff', borderRadius: '50%', padding: 8, cursor: 'pointer', border: '1px solid #eee'}}>
                <Camera size={18} />
                <input id="avatar-input" type="file" accept="image/*" style={{display: 'none'}} onChange={handleAvatarChange} />
              </label>
            )}
          </div>
          {editMode ? (
            <input className="profile-name" name="name" value={form.name} onChange={handleChange} style={{fontSize: 20, fontWeight: 600, textAlign: 'center', margin: '8px 0'}} />
          ) : (
            <div className="profile-name">{form.name}</div>
          )}
        </div>
        <div className="profile-info">
          <div className="info-title">Thông tin cá nhân</div>
          <div className="info-row">
            <span>Giới tính</span>
            {editMode ? (
              <select name="gender" value={form.gender} onChange={handleChange}>
                <option value="">Chọn</option>
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
                <option value="Khác">Khác</option>
              </select>
            ) : (
              <span>{form.gender || 'Khác'}</span>
            )}
          </div>
          <div className="info-row">
            <span>Ngày sinh</span>
            {editMode ? (
              <input type="date" name="dateOfBirth" value={form.dateOfBirth || ''} onChange={handleChange} />
            ) : (
              <span>{form.dateOfBirth ? formatDate(form.dateOfBirth) : '--/--/----'}</span>
            )}
          </div>
          <div className="info-row">
            <span>Điện thoại</span>
            <span>{form.phone ? `+${form.phone.replace(/^84/, '84 ')}` : ''}</span>
          </div>
        </div>
        {/* Nút cập nhật */}
        <div style={{textAlign: 'center', marginTop: 16}}>
          {editMode ? (
            <button className="message-btn" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Đang lưu...' : <><Pencil size={16} style={{marginRight: 6}}/>Lưu thay đổi</>}
            </button>
          ) : (
            <button className="add-friend-btn" onClick={() => setEditMode(true)}>
              <Pencil size={16} style={{marginRight: 6}}/>Cập nhật
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SelfProfileModal; 