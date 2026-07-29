import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Trash2, KeyRound, ShieldCheck, User as UserIcon, X, Mail, Clock, Calendar } from 'lucide-react';
import api from '../utils/api';
import CustomSelect from './CustomSelect';
import ConfirmModal from './ConfirmModal';
import { useAuth } from '../context/AuthContext';

const ROLE_LABEL = { admin: 'Admin', staff: 'Staff' };

// "3 hours ago" style, falling back to a date once it's old enough to matter.
const timeAgo = (d) => {
  if (!d) return 'No activity yet';
  const then = new Date(d).getTime();
  if (Number.isNaN(then)) return 'No activity yet';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
  return new Date(d).toLocaleDateString('en-GB');
};

const fmtDateTime = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime())
    ? '—'
    : dt.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// What each role can do — shown to the admin so the choice is informed rather
// than a guess from the label alone.
const ROLE_HELP = {
  admin: 'Full access: entries, import, export, delete, settings and user access.',
  staff: 'Can create and edit entries and print labels. No delete, import, export or settings.',
};

export default function UserAccessPanel() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);

  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({ name: '', email: '', password: '', role: 'staff' });
  const [saving, setSaving] = useState(false);

  const [resetFor, setResetFor] = useState(null);
  const [resetPw, setResetPw] = useState('');

  const [removeTarget, setRemoveTarget] = useState(null);
  const [detailUser, setDetailUser] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/user/list');
      if (res.data.success) setUsers(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Clear the transient success line after a few seconds.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const run = async (id, fn, okMsg) => {
    setBusyId(id);
    setError('');
    try {
      await fn();
      setNotice(okMsg);
      await load();
      return true;
    } catch (err) {
      // The server owns the rules (last admin, self-demotion); surface its text.
      setError(err.response?.data?.message || 'That action failed.');
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const changeRole = (u, role) =>
    run(u._id, () => api.post('/user/update-role', { id: u._id, role }), `${u.name} is now ${ROLE_LABEL[role]}.`);

  const confirmRemove = async () => {
    const u = removeTarget;
    if (!u) return;
    await run(u._id, () => api.post('/user/remove', { id: u._id }), `${u.name} was removed.`);
    setRemoveTarget(null);
  };

  const addUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/user/create', draft);
      setNotice(`${draft.name} was added as ${ROLE_LABEL[draft.role]}.`);
      setDraft({ name: '', email: '', password: '', role: 'staff' });
      setShowAdd(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create the user.');
    } finally {
      setSaving(false);
    }
  };

  const submitReset = async (e) => {
    e.preventDefault();
    const ok = await run(resetFor._id,
      () => api.post('/user/reset-password', { id: resetFor._id, newPassword: resetPw }),
      `Password reset for ${resetFor.name}.`);
    if (ok) { setResetFor(null); setResetPw(''); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Who can use the system, and what they are allowed to do.
        </p>
        <button className="btn btn-primary" onClick={() => { setShowAdd(true); setError(''); }} style={{ flexShrink: 0 }}>
          <UserPlus size={16} /> Add User
        </button>
      </div>

      {error && !showAdd && (
        <div style={{ padding: '10px 14px', background: '#3B1A1A', color: 'var(--danger)', borderRadius: 8, margin: '12px 0', fontSize: '0.88rem' }}>
          {error}
        </div>
      )}
      {notice && (
        <div style={{ padding: '10px 14px', background: '#12301F', color: '#34D399', borderRadius: 8, margin: '12px 0', fontSize: '0.88rem' }}>
          {notice}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {[0, 1].map(i => <div key={i} className="shimmer-block" style={{ height: 58, borderRadius: 10 }} />)}
        </div>
      ) : (
        <div className="access-list">
          {users.map(u => {
            const isMe = String(u._id) === String(me?.id);
            const isAdmin = (u.role || 'admin') === 'admin';
            return (
              <div key={u._id} className="access-row">
                <span className={`access-avatar ${isAdmin ? 'is-admin' : ''}`}>
                  {isAdmin ? <ShieldCheck size={16} /> : <UserIcon size={16} />}
                </span>

                <button type="button" className="access-identity" onClick={() => setDetailUser(u)} title="View details">
                  <div className="access-name">
                    <span className="access-name-text">{u.name}</span>
                    {isMe && <span className="access-you">You</span>}
                  </div>
                  <div className="access-email">{u.email}</div>
                </button>

                <div className="access-actions">
                  <div className="access-role-select">
                    <CustomSelect
                      value={u.role || 'admin'}
                      onChange={e => changeRole(u, e.target.value)}
                      options={[{ label: 'Staff', value: 'staff' }, { label: 'Admin', value: 'admin' }]}
                      searchable={false}
                      advanceOnSelect={false}
                      disabled={isMe || busyId === u._id}
                    />
                  </div>

                  <button type="button" className="entry-icon-btn" title="Reset password"
                    onClick={() => { setResetFor(u); setResetPw(''); setError(''); }} disabled={busyId === u._id}>
                    <KeyRound size={16} />
                  </button>
                  <button type="button" className="entry-icon-btn" title={isMe ? 'You cannot remove yourself' : 'Remove user'}
                    onClick={() => { setRemoveTarget(u); setError(''); }} disabled={isMe || busyId === u._id}
                    style={{ color: isMe ? '#5A5A57' : 'var(--danger)' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="access-legend">
        <div><strong>Admin</strong> — {ROLE_HELP.admin}</div>
        <div><strong>Staff</strong> — {ROLE_HELP.staff}</div>
      </div>

      {showAdd && (
        <div className="modal-overlay" style={{ zIndex: 320 }} onClick={() => setShowAdd(false)}>
          <div className="entry-modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="entry-modal-head">
              <div style={{ flex: 1 }}>
                <div className="entry-modal-name">Add user</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 3 }}>They can sign in as soon as you save.</div>
              </div>
              <button type="button" className="entry-icon-btn" onClick={() => setShowAdd(false)}><X size={18} /></button>
            </div>
            <form onSubmit={addUser} style={{ padding: 20 }}>
              {error && (
                <div style={{ padding: '10px 14px', background: '#3B1A1A', color: 'var(--danger)', borderRadius: 8, marginBottom: 14, fontSize: '0.88rem' }}>
                  {error}
                </div>
              )}
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label>Name</label>
                <input className="input-field" value={draft.name} required autoFocus
                  onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Full name" />
              </div>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label>Email</label>
                <input className="input-field" type="email" value={draft.email} required
                  onChange={e => setDraft(d => ({ ...d, email: e.target.value }))} placeholder="name@example.com" />
              </div>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label>Password</label>
                <input className="input-field" type="password" value={draft.password} required minLength={6}
                  onChange={e => setDraft(d => ({ ...d, password: e.target.value }))} placeholder="Min. 6 characters" />
              </div>
              <div className="form-group">
                <label>Role</label>
                <CustomSelect
                  value={draft.role}
                  onChange={e => setDraft(d => ({ ...d, role: e.target.value }))}
                  options={[{ label: 'Staff', value: 'staff' }, { label: 'Admin', value: 'admin' }]}
                  searchable={false}
                />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 8 }}>{ROLE_HELP[draft.role]}</p>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                <button type="button" className="btn" onClick={() => setShowAdd(false)}
                  style={{ flex: 1, justifyContent: 'center', border: '1px solid var(--border-color)', background: 'var(--bg-white)', color: 'var(--text-dark)' }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={saving}>
                  {saving ? 'Adding…' : 'Add User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailUser && (() => {
        const isAdmin = (detailUser.role || 'admin') === 'admin';
        return (
          <div className="modal-overlay" style={{ zIndex: 320 }} onClick={() => setDetailUser(null)}>
            <div className="entry-modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
              <div className="entry-modal-head">
                <span className={`access-avatar ${isAdmin ? 'is-admin' : ''}`} style={{ width: 44, height: 44, borderRadius: '50%' }}>
                  {isAdmin ? <ShieldCheck size={20} /> : <UserIcon size={20} />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="entry-modal-name">{detailUser.name}</div>
                  <span className={`role-badge ${isAdmin ? 'is-admin' : ''}`} style={{ marginTop: 4, display: 'inline-block' }}>
                    {ROLE_LABEL[detailUser.role || 'admin']}
                  </span>
                </div>
                <button type="button" className="entry-icon-btn" onClick={() => setDetailUser(null)}><X size={18} /></button>
              </div>
              <div className="entry-modal-body">
                <div className="entry-row">
                  <span className="entry-row-label"><Mail size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />Email</span>
                  <span className="entry-row-value" style={{ wordBreak: 'break-all' }}>{detailUser.email}</span>
                </div>
                <div className="entry-row">
                  <span className="entry-row-label"><Clock size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />Last active</span>
                  <span className="entry-row-value">
                    {timeAgo(detailUser.lastActivityAt)}
                    {detailUser.lastActivityAt && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{fmtDateTime(detailUser.lastActivityAt)}</div>
                    )}
                  </span>
                </div>
                <div className="entry-row">
                  <span className="entry-row-label"><Calendar size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />Member since</span>
                  <span className="entry-row-value">{fmtDateTime(detailUser.createdAt)}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <ConfirmModal
        isOpen={!!removeTarget}
        title="Remove user"
        message={removeTarget ? `Remove ${removeTarget.name} (${removeTarget.email})?\nThey will lose access immediately.` : ''}
        confirmText="Remove"
        onConfirm={confirmRemove}
        onCancel={() => setRemoveTarget(null)}
      />

      {resetFor && (
        <div className="modal-overlay" style={{ zIndex: 320 }} onClick={() => setResetFor(null)}>
          <div className="entry-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="entry-modal-head">
              <div style={{ flex: 1 }}>
                <div className="entry-modal-name">Reset password</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 3 }}>{resetFor.email}</div>
              </div>
              <button type="button" className="entry-icon-btn" onClick={() => setResetFor(null)}><X size={18} /></button>
            </div>
            <form onSubmit={submitReset} style={{ padding: 20 }}>
              <div className="form-group">
                <label>New password</label>
                <input className="input-field" type="password" value={resetPw} required minLength={6} autoFocus
                  onChange={e => setResetPw(e.target.value)} placeholder="Min. 6 characters" />
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 10 }}>
                Tell them the new password directly — it is not emailed.
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button type="button" className="btn" onClick={() => setResetFor(null)}
                  style={{ flex: 1, justifyContent: 'center', border: '1px solid var(--border-color)', background: 'var(--bg-white)', color: 'var(--text-dark)' }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={busyId === resetFor._id}>
                  {busyId === resetFor._id ? 'Saving…' : 'Reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
