import { useEffect } from 'react';
import { X, Pencil, Tags, Trash2, MapPin, Building2, Ban, RotateCcw } from 'lucide-react';
import { printLabels } from '../utils/printLabels';
import { gradeWithSymbol } from '../utils/contactFields';
import { entryCode } from '../utils/series';
import useBodyScrollLock from '../utils/useBodyScrollLock';

// "Cot ×3, Sofa set" — append a quantity only when it's more than one.
const productsWithQty = (products, qtys) =>
  (Array.isArray(products) ? products : []).map(p => {
    const q = qtys && (qtys[p] ?? (typeof qtys.get === 'function' ? qtys.get(p) : undefined));
    return q && q > 1 ? `${p} ×${q}` : p;
  });

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
export default function EntryDetailModal({ contact, onClose, onEdit, onDelete, onCancel, onNotify, zIndex = 300 }) {
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
  // Treat the entry as a business when a business name is present and differs
  // from the person's name — then surface the business label in the header.
  const businessName = (c.business_name || '').trim();
  const isBusiness = businessName && businessName.toLowerCase() !== (c.full_name || '').trim().toLowerCase();
  const code = entryCode(c);   // e.g. "2026-1"

  const handleLabel = () => {
    const err = printLabels([c]);
    if (err) onNotify?.(err);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex }}>
      <div className="entry-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Entry ${code ?? ''} ${name}`}>
        {/* Header carries identity: entry number, name, category */}
        <div className="entry-modal-head">
          <div className="entry-avatar">{(c.full_name || '?').charAt(0).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="entry-modal-name">{name || '—'}</div>
            {/* When it's a business, show the business name right under the person. */}
            {isBusiness && (
              <div className="entry-modal-biz" title={businessName}>
                <Building2 size={13} /> {businessName}
              </div>
            )}
            <div className="entry-modal-sub">
              {code && <span className="entry-chip">{code}</span>}
              {c.series_code && <span className="entry-chip">Code {c.series_code}</span>}
              {c.cancelled && <span className="badge is-cancelled">Cancelled</span>}
              {isBusiness && <span className="badge dealer">Business</span>}
              {c.category && <span className={`badge ${String(c.category).toLowerCase() === 'dealer' ? 'dealer' : 'customer'}`}>{c.category}</span>}
              {c.customer_grade && <span className="entry-chip">{gradeWithSymbol(c.customer_grade)}</span>}
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
          <Row label="Entry No" value={code} />
          <Row label="Series Code" value={c.series_code} />
          <Row label="Date" value={fmtDate(c.contact_date || c.createdAt)} />
          <Row label="Entered by" value={c.created_by_name} />
          {c.cancelled && <Row label="Cancelled on" value={fmtDate(c.cancelled_at)} />}
          {c.cancelled && c.cancelled_reason && <Row label="Cancel reason" value={c.cancelled_reason} />}
          <Row label="Business" value={c.business_name} />
          <Row label="Products" value={productsWithQty(c.products, c.product_quantities)} accent />
          <Row label="Phone 1" value={c.phone_1 ? `+91 ${c.phone_1}` : null} />
          {/* Additional numbers: prefer the phones[] array, fall back to phone_2. */}
          {(Array.isArray(c.phones) && c.phones.length ? c.phones : (c.phone_2 ? [c.phone_2] : []))
            .map((num, i) => <Row key={i} label={`Phone ${i + 2}`} value={`+91 ${num}`} />)}
          <Row label="Address" value={address} />
          <Row label="Village / Town" value={c.village_town} />
          <Row label="District" value={c.district} />
          <Row label="State" value={c.state} />
          <Row label="Pincode" value={c.pincode} />
          {c.age && <Row label="Age" value={c.age} />}
          <Row label="Type of House" value={c.house_type} />
          <Row label="Type of Purchase" value={c.purchase_type} />
          <Row label="Customer Grade" value={c.customer_grade ? gradeWithSymbol(c.customer_grade) : null} />
          <Row label="Instagram" value={c.instagram_id} />
          {c.notes && <Row label="Notes" value={c.notes} />}
        </div>

        {/* Actions. Print Label is the per-entry button asked for; it prints
            exactly this one contact at 75x50mm. */}
        <div className="entry-modal-actions">
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
          {/* Cancel bill: mark the entry void (kept for records), or restore it. */}
          {onCancel && (
            c.cancelled ? (
              <button type="button" className="entry-action" onClick={() => onCancel(c, false)} title="Restore this entry">
                <RotateCcw size={17} /><span>Restore</span>
              </button>
            ) : (
              <button type="button" className="entry-action is-warn" onClick={() => onCancel(c, true)} title="Cancel this bill / entry">
                <Ban size={17} /><span>Cancel Bill</span>
              </button>
            )
          )}
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
