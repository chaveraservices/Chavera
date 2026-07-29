import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, X, Pencil, GripVertical } from 'lucide-react';
import api from '../utils/api';
import ConfirmModal from './ConfirmModal';

// Admin panel for the product catalogue that feeds the entry form and filter.
// Removing a product is a soft delete on the server, so contacts that already
// list it keep a valid value — it just stops being offered on new entries.
//
// Add and rename both happen in a small modal so the panel itself stays a clean
// list that never grows the page.
export default function ProductManager() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  // editing === null: closed. { id: null } means "add new"; { id, name } edits.
  const [editing, setEditing] = useState(null);
  const [draftName, setDraftName] = useState('');
  const [saving, setSaving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/product/list', { includeInactive: false });
      if (res.data.success) setProducts(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load products.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing({ id: null }); setDraftName(''); setError(''); };
  const openEdit = (p) => { setEditing({ id: p.id }); setDraftName(p.name); setError(''); };
  const closeModal = () => { setEditing(null); setDraftName(''); };

  const save = async (e) => {
    e.preventDefault();
    const name = draftName.trim();
    if (!name) return;
    // Renaming to the same value is a no-op; just close.
    if (editing.id && name === products.find(p => p.id === editing.id)?.name) { closeModal(); return; }
    setSaving(true);
    setError('');
    try {
      if (editing.id) await api.post('/product/update', { id: editing.id, name });
      else await api.post('/product/create', { name });
      closeModal();
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save the product.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const p = removeTarget;
    if (!p) return;
    setBusyId(p.id);
    setError('');
    try {
      await api.post('/product/remove', { id: p.id });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not remove the product.');
    } finally {
      setBusyId(null);
      setRemoveTarget(null);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          The products offered on the entry form and in the filter. Changes apply everywhere immediately.
        </p>
        <button className="btn btn-primary" onClick={openAdd} style={{ flexShrink: 0 }}>
          <Plus size={16} /> Add
        </button>
      </div>

      {error && !editing && (
        <div style={{ padding: '10px 14px', background: '#3B1A1A', color: 'var(--danger)', borderRadius: 8, marginBottom: 12, fontSize: '0.88rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {[0, 1, 2].map(i => <div key={i} className="shimmer-block" style={{ height: 44, borderRadius: 9 }} />)}
        </div>
      ) : products.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem', padding: '16px 0' }}>
          No products yet. Use “Add” to create the first one.
        </div>
      ) : (
        <>
          <div className="prodmgr-head">Product Name</div>
          <div className="prodmgr-list">
            {products.map(p => (
              <div key={p.id} className="prodmgr-row">
                <GripVertical size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: '0.92rem', color: 'var(--text-dark)' }}>{p.name}</span>
                <button type="button" className="entry-icon-btn" onClick={() => openEdit(p)} title="Rename" disabled={busyId === p.id}>
                  <Pencil size={15} />
                </button>
                <button type="button" className="entry-icon-btn" onClick={() => setRemoveTarget(p)} title="Remove" disabled={busyId === p.id} style={{ color: 'var(--danger)' }}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {editing && (
        <div className="modal-overlay" style={{ zIndex: 320 }} onClick={closeModal}>
          <div className="entry-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="entry-modal-head">
              <div style={{ flex: 1 }}>
                <div className="entry-modal-name">{editing.id ? 'Rename product' : 'Add product'}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 3 }}>
                  {editing.id ? 'Applies everywhere immediately.' : 'It becomes available on new entries.'}
                </div>
              </div>
              <button type="button" className="entry-icon-btn" onClick={closeModal}><X size={18} /></button>
            </div>
            <form onSubmit={save} style={{ padding: 20 }}>
              {error && (
                <div style={{ padding: '10px 14px', background: '#3B1A1A', color: 'var(--danger)', borderRadius: 8, marginBottom: 14, fontSize: '0.88rem' }}>
                  {error}
                </div>
              )}
              <div className="form-group">
                <label>Product name</label>
                <input className="input-field" value={draftName} required autoFocus maxLength={60}
                  onChange={e => setDraftName(e.target.value)} placeholder="e.g. Sofa set" />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button type="button" className="btn" onClick={closeModal}
                  style={{ flex: 1, justifyContent: 'center', border: '1px solid var(--border-color)', background: 'var(--bg-white)', color: 'var(--text-dark)' }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={saving || !draftName.trim()}>
                  {saving ? 'Saving…' : (editing.id ? 'Save' : 'Add product')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!removeTarget}
        title="Remove product"
        message={removeTarget ? `Remove “${removeTarget.name}” from the product list?\nExisting entries that already have it are unaffected.` : ''}
        confirmText="Remove"
        onConfirm={remove}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}
