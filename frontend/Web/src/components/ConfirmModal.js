import React from 'react';
import './css/ConfirmModal.css';

const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  type = 'default' // 'default' | 'danger'
}) => {
  if (!isOpen) return null;

  return (
    <div className="confirm-modal-overlay" onClick={onClose}>
      <div className="confirm-modal" onClick={e => e.stopPropagation()}>
        <div className="confirm-modal-header">
          <h3>{title}</h3>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>
        
        <div className="confirm-modal-content">
          <p>{message}</p>
        </div>

        <div className="confirm-modal-footer">
          <button 
            className="cancel-button" 
            onClick={onClose}
          >
            {cancelText}
          </button>
          <button 
            className={`confirm-button ${type}`}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal; 