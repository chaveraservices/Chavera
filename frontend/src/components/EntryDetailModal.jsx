import { useEffect } from 'react';
import { X, Pencil, Tags, Trash2, Phone, MapPin } from 'lucide-react';
import { printLabels } from '../utils/printLabels';
import useBodyScrollLock from '../utils/useBodyScrollLock';

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()}`;
};

function Row({ label, value, accent }) {
  const empty = value == null || value === '' || (Array.isArray(value) && value.length === 0);
  return (
    <div className="entry-row">
      <span className="entry-row-label">{label}</span>
      <span className={`entry-row-value ${accent ? 'is-accent' : ''} ${empty ? 'is-empty' : ''}`}>
        {empty ? '—' : (Array.isArray(value) ? value.join(', ') : value)}
      </span>
    </div>
  );
}

/**
 * Full detail for one entry. The Entry table shows only five columns, so this
 * is where every other field lives — opened by clicking a row.
 *
 * onEdit / onDelete are optional: staff get neither, so the buttons simply
 * don't render for them.
 */
export default function EntryDetailModal({ contact, onClose, onEdit, onDelete, onNotify }) {
  // Freeze the page behind so the wheel only moves this list.
  useBodyScrollLock(!!contact);

  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);

  if (!contact) return null;

  const c = contact;
  const name = `${c.honorific ? c.honorific + ' ' : ''}${c.full_name || ''}`.trim();
  const address = [c.door_flat_no, c.street, c.landmark, c.village_town, c.mandal, c.district, c.state, c.pincode]
    .filter(Boolean).join(', ');

  const handleLabel = () => {
    const err = printLabels([c]);
    if (err) onNotify?.(err);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 300 }}>
      <div className="entry-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Entry ${c.entry_no ?? ''} ${name}`}>
        {/* Header carries identity: entry number, name, category */}
        <div className="entry-modal-head">
          <div className="entry-avatar">{(c.full_name || '?').charAt(0).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="entry-modal-name">{name || '—'}</div>
            <div className="entry-modal-sub">
              {c.entry_no != null && <span className="entry-chip">#{c.entry_no}</span>}
              {c.category && <span className={`badge ${String(c.category).toLowerCase() === 'dealer' ? 'dealer' : 'customer'}`}>{c.category}</span>}
              {c.customer_grade && <span className="entry-chip">{c.customer_grade}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {onEdit && (
              <button type="button" className="entry-icon-btn" onClick={() => onEdit(c)} title="Edit entry">
                <Pencil size={16} />
              </button>
            )}
            <button type="button" className="entry-icon-btn" onClick={onClose} title="Close (Esc)">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="entry-modal-body">
          <Row label="Entry No" value={c.entry_no != null ? `#${c.entry_no}` : null} />
          <Row label="Date" value={fmtDate(c.contact_date || c.createdAt)} />
          <Row label="Business" value={c.business_name} />
          <Row label="Products" value={c.products} accent />
          <Row label="Phone 1" value={c.phone_1} />
          <Row label="Phone 2" value={c.phone_2} />
          <Row label="Address" value={address} />
          <Row label="Village / Town" value={c.village_town} />
          <Row label="District" value={c.district} />
          <Row label="State" value={c.state} />
          <Row label="Pincode" value={c.pincode} />
          {c.age && <Row label="Age" value={c.age} />}
          <Row label="Type of House" value={c.house_type} />
          <Row label="Type of Purchase" value={c.purchase_type} />
          <Row label="Customer Grade" value={c.customer_grade} />
          <Row label="Instagram" value={c.instagram_id} />
          {c.notes && <Row label="Notes" value={c.notes} />}
        </div>

        {/* Actions. Print Label is the per-entry button asked for; it prints
            exactly this one contact at 75x50mm. */}
        <div className="entry-modal-actions">
          <a className="entry-action" href={`tel:${c.phone_1}`} title={`Call ${c.phone_1}`}>
            <Phone size={17} /><span>Call</span>
          </a>
          <a
            className="entry-action"
            href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
            target="_blank" rel="noreferrer"
            title="Open address in Maps"
          >
            <MapPin size={17} /><span>Map</span>
          </a>
          <button type="button" className="entry-action is-primary" onClick={handleLabel} title="Print a 75mm x 50mm label for this entry">
            <Tags size={17} /><span>Print Label</span>
          </button>
          {onDelete && (
            <button type="button" className="entry-action is-danger" onClick={() => onDelete(c)} title="Delete entry">
              <Trash2 size={17} /><span>Delete</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
