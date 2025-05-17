import React from 'react';
import './css/MessageContextMenu.css';

const MessageContextMenu = ({ 
  isVisible, 
  position, 
  onClose, 
  onRecall, 
  onDelete, 
  onForward,
  isOwnMessage,
  isDeleting 
}) => {
  if (!isVisible) return null;

  const style = {
    position: 'fixed',
    top: position.y,
    left: position.x,
  };

  return (
    <div className="message-context-menu" style={style}>
      {isOwnMessage && (
        <>
          <button onClick={onRecall} className="menu-item">
            Thu hồi
          </button>
          <button 
            onClick={onDelete} 
            className="menu-item delete"
            disabled={isDeleting}
          >
            {isDeleting ? 'Đang xóa...' : 'Xóa'}
          </button>
        </>
      )}
      <button onClick={onForward} className="menu-item">
        Chuyển tiếp
      </button>
    </div>
  );
};

export default MessageContextMenu; 