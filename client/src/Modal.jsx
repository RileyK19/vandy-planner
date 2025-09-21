// Modal.js - Reusable modal component

import React from 'react';

function Modal({ onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close modal">
            {'\u00D7'}
        </button>
        {children}
      </div>
    </div>
  );
}

export default Modal;