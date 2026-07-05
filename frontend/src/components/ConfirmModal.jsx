import { X } from 'lucide-react';

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Delete', confirmColor = '#DC2626' }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="close-btn" onClick={onCancel}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          <div style={{ color: 'var(--text-dark)', marginBottom: 20, whiteSpace: 'pre-wrap' }}>
            {message}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button 
              className="btn" 
              onClick={onCancel} 
              style={{ border: '1px solid var(--border-color)', background: 'var(--bg-white)' }}
            >
              Cancel
            </button>
            <button 
              className="btn btn-primary" 
              onClick={onConfirm} 
              style={{ background: confirmColor }}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
