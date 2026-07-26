import ContactForm from './ContactForm';
import useBodyScrollLock from '../utils/useBodyScrollLock';

/**
 * Hosts the entry form in a modal on the same page, instead of navigating to a
 * separate route. Deliberately does NOT close on backdrop click or Escape —
 * a half-typed entry is easy to lose that way. Closing is only via the form's
 * own Cancel button or the header ✕ (both call onClose).
 */
export default function EntryFormModal({ open, contact, onClose, onSaved, onCancelBill }) {
  useBodyScrollLock(open);
  if (!open) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 310, alignItems: 'flex-start', padding: '4vh 16px' }}>
      <div className="entry-form-modal" role="dialog" aria-modal="true" aria-label={contact ? 'Edit entry' : 'New entry'}>
        <ContactForm contact={contact} onCancel={onClose} onSave={onSaved} onClose={onClose} onCancelBill={onCancelBill} />
      </div>
    </div>
  );
}
