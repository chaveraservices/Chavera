import { useEffect, useRef } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import useBodyScrollLock from '../utils/useBodyScrollLock';

const fmtDate = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  const p = (n) => String(n).padStart(2, '0');
  return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()}`;
};

// Only the fields worth re-reading before committing. Blank ones are dropped
// rather than shown as dashes, so the summary stays scannable.
const FIELDS = [
  ['Name', c => `${c.honorific ? c.honorific + ' ' : ''}${c.full_name || ''}`.trim()],
  ['Business', c => c.business_name],
  ['Phone 1', c => c.phone_1],
  ['Phone 2', c => c.phone_2],
  ['Age', c => c.age],
  ['Category', c => c.category],
  ['Customer Grade', c => c.customer_grade],
  ['Type of House', c => c.house_type],
  ['Type of Purchase', c => c.purchase_type],
  ['Products', c => (Array.isArray(c.products) && c.products.length ? c.products.join(', ') : '')],
  ['Date', c => fmtDate(c.contact_date)],
  ['Address', c => [c.door_flat_no, c.street, c.landmark].filter(Boolean).join(', ')],
  ['Village / Town', c => c.village_town],
  ['Mandal', c => c.mandal],
  ['District', c => c.district],
  ['State', c => c.state],
  ['Pincode', c => c.pincode],
  ['Instagram', c => c.instagram_id],
  ['Notes', c => c.notes],
];

/**
 * Review step shown when the user hits Save. Displays exactly what will be
 * written, with a way back to fix it — so a typo is caught before it becomes
 * a record rather than after.
 *
 * Keyboard: Enter confirms, Esc goes back to editing.
 */
export default function ConfirmEntryModal({ isOpen, data, isEdit, saving, onConfirm, onEdit }) {
  const confirmRef = useRef(null);
  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    // Focus Confirm so Enter commits straight away — the keyboard-first path.
    confirmRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onEdit(); }
      if (e.key === 'Enter' && !saving) { e.preventDefault(); onConfirm(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, saving, onConfirm, onEdit]);

  if (!isOpen || !data) return null;

  const rows = FIELDS
    .map(([label, get]) => [label, get(data)])
    .filter(([, v]) => v != null && String(v).trim() !== '');

  return (
    <div className="modal-overlay" style={{ zIndex: 400 }}>
      <div className="entry-modal" role="dialog" aria-modal="true" aria-label="Confirm entry details">
        <div className="entry-modal-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="entry-modal-name">Confirm {isEdit ? 'changes' : 'new entry'}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 3 }}>
              Check the details below before saving.
            </div>
          </div>
          <button type="button" className="entry-icon-btn" onClick={onEdit} title="Back to editing (Esc)">
            <X size={18} />
          </button>
        </div>

        <div className="entry-modal-body">
          {rows.map(([label, value]) => (
            <div className="entry-row" key={label}>
              <span className="entry-row-label">{label}</span>
              <span className="entry-row-value">{value}</span>
            </div>
          ))}
        </div>

        <div className="entry-modal-actions" style={{ gridAutoColumns: '1fr 1.4fr' }}>
          <button type="button" className="entry-action" onClick={onEdit} disabled={saving}>
            <Pencil size={17} /><span>Edit</span>
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="entry-action is-primary"
            onClick={onConfirm}
            disabled={saving}
          >
            <Check size={17} /><span>{saving ? 'Saving…' : 'Confirm & Save'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
