import { X } from 'lucide-react';

export default function AlertModal({ isOpen, title = 'Alert', message, onClose, type = 'error' }) {
  if (!isOpen) return null;

  const headerColor = type === 'error' ? '#DC2626' : (type === 'success' ? '#059669' : 'var(--text-dark)');

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h2 style={{ color: headerColor }}>{title}</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          <div style={{ color: 'var(--text-dark)', marginBottom: 20, whiteSpace: 'pre-wrap' }}>
            {message}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              className="btn btn-primary" 
              onClick={onClose} 
            >
              Okay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
