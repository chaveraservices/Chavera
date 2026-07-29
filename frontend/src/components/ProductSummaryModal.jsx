import { useEffect } from 'react';
import { X, ArrowRight, Package } from 'lucide-react';
import useBodyScrollLock from '../utils/useBodyScrollLock';

/**
 * Summary popover shown when a product slice/bar is clicked on the dashboard.
 * Gives the headline numbers first, then a button to open the full filtered
 * list — the "see all data" step the client asked for, instead of jumping
 * straight to the Directory.
 *
 * product: { label, count, pct } | null
 */
export default function ProductSummaryModal({ product, totalSelections, onClose, onSeeAll }) {
  useBodyScrollLock(!!product);

  useEffect(() => {
    if (!product) return;
    const k = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter') onSeeAll(product.label);
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [product, onClose, onSeeAll]);

  if (!product) return null;

  const share = product.pct != null
    ? product.pct
    : (totalSelections ? (product.count / totalSelections) * 100 : 0);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 320 }}>
      <div className="entry-modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`${product.label} summary`}>
        <div className="entry-modal-head">
          <div className="entry-avatar"><Package size={20} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="entry-modal-name">{product.label}</div>
            <div className="entry-modal-sub">
              <span className="entry-chip">Product</span>
            </div>
          </div>
          <button type="button" className="entry-icon-btn" onClick={onClose} title="Close (Esc)"><X size={18} /></button>
        </div>

        <div style={{ padding: '18px 20px', display: 'flex', gap: 14 }}>
          <div className="prod-stat">
            <div className="prod-stat-value">{product.count}</div>
            <div className="prod-stat-label">Selections</div>
          </div>
          <div className="prod-stat">
            <div className="prod-stat-value">{share.toFixed(1)}%</div>
            <div className="prod-stat-label">Of all product demand</div>
          </div>
        </div>

        <p style={{ padding: '0 20px 6px', color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.5 }}>
          {product.count} {product.count === 1 ? 'entry has' : 'entries have'} chosen <strong style={{ color: 'var(--text-dark)' }}>{product.label}</strong>.
          Open the full list to see who they are, call them, or print labels.
        </p>

        <div className="entry-modal-actions" style={{ gridAutoColumns: '1fr' }}>
          <button type="button" className="entry-action is-primary" onClick={() => onSeeAll(product.label)}>
            <ArrowRight size={17} /><span>See all {product.label} entries</span>
          </button>
        </div>
      </div>
    </div>
  );
}
