import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Check, X, Pencil } from 'lucide-react';
import api from '../utils/api';

// Admin panel for the product catalogue that feeds the entry form and filter.
// Removing a product is a soft delete on the server, so contacts that already
// list it keep a valid value — it just stops being offered on new entries.
export default function ProductManager() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');

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

  const add = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    setError('');
    try {
      await api.post('/product/create', { name: newName.trim() });
      setNewName('');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not add the product.');
    } finally {
      setAdding(false);
    }
  };

  const saveEdit = async (p) => {
    if (!editName.trim() || editName.trim() === p.name) { setEditId(null); return; }
    setBusyId(p.id);
    setError('');
    try {
      await api.post('/product/update', { id: p.id, name: editName.trim() });
      setEditId(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not rename the product.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Remove "${p.name}" from the product list? Existing entries that already have it are unaffected.`)) return;
    setBusyId(p.id);
    setError('');
    try {
      await api.post('/product/remove', { id: p.id });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not remove the product.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 14 }}>
        The products offered on the entry form and in the filter. Changes apply everywhere immediately.
      </p>

      {error && (
        <div style={{ padding: '10px 14px', background: '#3B1A1A', color: 'var(--danger)', borderRadius: 8, marginBottom: 12, fontSize: '0.88rem' }}>
          {error}
        </div>
      )}

      <form onSubmit={add} className="prodmgr-add">
        <input
          className="input-field"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="New product name"
          maxLength={60}
        />
        <button type="submit" className="btn btn-primary" disabled={adding || !newName.trim()}>
          <Plus size={16} /> {adding ? 'Adding…' : 'Add'}
        </button>
      </form>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {[0, 1, 2].map(i => <div key={i} className="shimmer-block" style={{ height: 44, borderRadius: 9 }} />)}
        </div>
      ) : products.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem', padding: '16px 0' }}>
          No products yet. Add the first one above.
        </div>
      ) : (
        <div className="prodmgr-list">
          {products.map(p => (
            <div key={p.id} className="prodmgr-row">
              {editId === p.id ? (
                <>
                  <input
                    className="input-field"
                    value={editName}
                    autoFocus
                    maxLength={60}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveEdit(p); } if (e.key === 'Escape') setEditId(null); }}
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="entry-icon-btn" onClick={() => saveEdit(p)} title="Save" disabled={busyId === p.id}>
                    <Check size={16} />
                  </button>
                  <button type="button" className="entry-icon-btn" onClick={() => setEditId(null)} title="Cancel">
                    <X size={16} />
                  </button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: '0.92rem', color: 'var(--text-dark)' }}>{p.name}</span>
                  <button type="button" className="entry-icon-btn" onClick={() => { setEditId(p.id); setEditName(p.name); }} title="Rename" disabled={busyId === p.id}>
                    <Pencil size={15} />
                  </button>
                  <button type="button" className="entry-icon-btn" onClick={() => remove(p)} title="Remove" disabled={busyId === p.id} style={{ color: 'var(--danger)' }}>
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
