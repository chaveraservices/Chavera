import { useState, useEffect } from 'react';
import { Lock, CheckCircle, X } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import UserAccessPanel from '../components/UserAccessPanel';
import ProductManager from '../components/ProductManager';

function Section({ title, action, children }) {
  return (
    <div className="form-section" style={{ marginBottom: 24 }}>
      <div className="form-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span>{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const profile = user || { name: '', email: '' };
  // Sessions predating roles carry none; treat those as admin (matches the API).
  const isAdmin = (user?.role || 'admin') === 'admin';
  const [pwData, setPwData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [showPwModal, setShowPwModal] = useState(false);

  const [dbStats, setDbStats] = useState(null);
  const [dbStatsLoading, setDbStatsLoading] = useState(false);
  const [dbStatsError, setDbStatsError] = useState('');

  const [keepAliveEnabled, setKeepAliveEnabled] = useState(false);
  const [keepAliveLoading, setKeepAliveLoading] = useState(false);

  useEffect(() => {
    // These are admin-only endpoints; staff would get a 403. Only the admin
    // sees the DB-stats and keep-alive panels, so only the admin fetches them.
    if (!isAdmin) return;
    fetchDbStats();
    fetchKeepAliveStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const fetchKeepAliveStatus = async () => {
    try {
      const res = await api.post('/admin/keep-alive-status');
      setKeepAliveEnabled(res.data.data.keepAliveEnabled);
    } catch (err) {
      console.error('Failed to load keep-alive status', err);
    }
  };

  const toggleKeepAlive = async () => {
    setKeepAliveLoading(true);
    try {
      const res = await api.post('/admin/toggle-keep-alive');
      setKeepAliveEnabled(res.data.data.keepAliveEnabled);
    } catch (err) {
      console.error('Failed to toggle keep-alive', err);
    } finally {
      setKeepAliveLoading(false);
    }
  };

  const fetchDbStats = async () => {
    setDbStatsLoading(true);
    setDbStatsError('');
    try {
      const res = await api.post('/admin/db-stats');
      setDbStats(res.data.data);
    } catch (err) {
      setDbStatsError(err.response?.data?.message || 'Failed to load DB stats');
    } finally {
      setDbStatsLoading(false);
    }
  };

  const formatMB = (bytes) => {
    if (!bytes) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return mb > 1024 ? (mb / 1024).toFixed(2) + ' GB' : mb.toFixed(2) + ' MB';
  };

  const handlePwChange = e => setPwData({ ...pwData, [e.target.name]: e.target.value });

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError(''); setPwSuccess('');
    if (pwData.newPassword !== pwData.confirmPassword) { setPwError('New passwords do not match.'); return; }
    if (pwData.newPassword.length < 6) { setPwError('New password must be at least 6 characters.'); return; }
    setPwLoading(true);
    try {
      await api.post('/user/change-password', { currentPassword: pwData.currentPassword, newPassword: pwData.newPassword });
      setPwSuccess('Password changed successfully!');
      setPwData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => { setShowPwModal(false); setPwSuccess(''); }, 1200);
    } catch (err) {
      setPwError(err.response?.data?.message || 'Failed to change password. Check your current password.');
    } finally { setPwLoading(false); }
  };


  return (
    <div className="page-container settings-page" style={{ paddingTop: 20, maxWidth: 1320 }}>
      <div className="form-header-flex" style={{ marginBottom: 12 }}>
        <h1>Settings</h1>
      </div>

      {/* One page, three columns so everything packs onto a single screen
          without tabs or page scroll. The long lists (users, products) scroll
          inside their own panels, so they can't stretch the page. */}
      <div className="settings-cols">
      <div className="settings-col">
      {/* Profile holds identity plus the two account actions (password change,
          keep-alive) so the whole left column is one compact card. */}
      <Section title="PROFILE">
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--primary-accent), #f59e0b)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: '1.5rem', fontWeight: 700,
          }}>
            {profile.name ? profile.name[0].toUpperCase() : '?'}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-dark)' }}>{profile.name || '—'}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', wordBreak: 'break-all' }}>{profile.email || '—'}</div>
            <span className={`role-badge ${isAdmin ? 'is-admin' : ''}`} style={{ display: 'inline-block', marginTop: 8 }}>
              {isAdmin ? 'Super Admin' : 'Staff'}
            </span>
          </div>
        </div>

        {/* Password */}
        <div className="profile-row">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-dark)', marginBottom: 3 }}>Password</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Change your account password.</div>
          </div>
          <button type="button" className="btn btn-primary" style={{ flexShrink: 0 }}
            onClick={() => { setShowPwModal(true); setPwError(''); setPwSuccess(''); }}>
            <Lock size={16} /> Change
          </button>
        </div>

        {/* 14-Minute Keep-Alive (admin only) */}
        {isAdmin && (
        <div className="profile-row">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-dark)', marginBottom: 3 }}>14-Minute Keep-Alive</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Keeps the server awake during inactivity. (Always ON in Production)</div>
          </div>
          <button
            type="button"
            onClick={toggleKeepAlive}
            disabled={keepAliveLoading}
            style={{
              position: 'relative', width: 44, height: 24, borderRadius: 12, border: 'none', flexShrink: 0, cursor: keepAliveLoading ? 'wait' : 'pointer',
              background: keepAliveEnabled ? '#10b981' : '#cbd5e1', transition: 'background 0.3s'
            }}
          >
            <div style={{
              position: 'absolute', top: 2, left: keepAliveEnabled ? 22 : 2, width: 20, height: 20,
              background: 'var(--bg-white)', borderRadius: '50%', transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
            }} />
          </button>
        </div>
        )}
      </Section>

      {/* Database Storage sits right under the profile in the left column. */}
      {isAdmin && (
      <Section
        title="DATABASE STORAGE"
        action={
          <button className="btn" onClick={fetchDbStats} disabled={dbStatsLoading}
            style={{ padding: '5px 10px', fontSize: '0.8rem', fontWeight: 600, textTransform: 'none', letterSpacing: 'normal', border: '1px solid var(--border-color)', background: 'var(--bg-white)' }}>
            {dbStatsLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        }
      >
        {dbStatsError &&<div style={{ padding: '8px 12px', background: '#3B1A1A', color: 'var(--danger)', borderRadius: 8, marginBottom: 12, fontSize: '0.85rem' }}>{dbStatsError}</div>}

        {dbStats && (() => {
          const maxBytes = 512 * 1024 * 1024;
          const usedBytes = dbStats.storageSize !== undefined ? (dbStats.storageSize + (dbStats.indexSize || 0)) : 0;
          const usedPercent = Math.min(100, (usedBytes / maxBytes) * 100);
          const getProgressColor = (percent) => {
            if (percent > 90) return 'linear-gradient(90deg, #ef4444, #f87171)';
            if (percent > 75) return 'linear-gradient(90deg, #f59e0b, #fbbf24)';
            return 'linear-gradient(90deg, #10b981, #34d399)';
          };
          const metrics = [
            ['Database', dbStats.dbName],
            ['Collections', dbStats.collections],
            ['Documents', dbStats.objects],
            ['Data Size', formatMB(dbStats.dataSize)],
            ['Storage Size', formatMB(dbStats.storageSize)],
            ['Index Size', formatMB(dbStats.indexSize)],
          ];

          return (
            <>
              {dbStats.storageSize !== undefined && (
                <div style={{ padding: 14, background: 'var(--bg-main)', borderRadius: 10, border: '1px solid var(--border-color)', marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-dark)' }}>Atlas Free Tier</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{formatMB(usedBytes)} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/ 512 MB</span></span>
                  </div>
                  <div style={{ width: '100%', height: 10, background: '#232322', borderRadius: 5, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${usedPercent}%`, background: getProgressColor(usedPercent), borderRadius: 5, transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{usedPercent.toFixed(1)}% used</span>
                    <span style={{ color: '#34D399', fontWeight: 600 }}>{formatMB(maxBytes - usedBytes)} free</span>
                  </div>
                </div>
              )}

              <div className="db-metric-grid">
                {metrics.map(([label, value]) => (
                  <div key={label} className="db-metric">
                    <span className="db-metric-label">{label}</span>
                    <span className="db-metric-value">{value}</span>
                  </div>
                ))}
              </div>
            </>
          );
        })()}
      </Section>
      )}
      </div>

      {/* Middle column — user access. */}
      {isAdmin && (
      <div className="settings-col">
      <Section title="USER ACCESS &amp; ROLES">
        <UserAccessPanel />
      </Section>
      </div>
      )}

      {/* Right column — products. */}
      {isAdmin && (
      <div className="settings-col">
      <Section title="PRODUCTS">
        <ProductManager />
      </Section>
      </div>
      )}
      </div>

      {/* Change Password modal */}
      {showPwModal && (
        <div className="modal-overlay" style={{ zIndex: 320 }} onClick={() => setShowPwModal(false)}>
          <div className="entry-modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="entry-modal-head">
              <div style={{ flex: 1 }}>
                <div className="entry-modal-name">Change password</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 3 }}>You stay signed in after changing it.</div>
              </div>
              <button type="button" className="entry-icon-btn" onClick={() => setShowPwModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleChangePassword} style={{ padding: 20 }}>
              {pwError && <div style={{ padding: '10px 14px', background: '#3B1A1A', color: 'var(--danger)', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem' }}>{pwError}</div>}
              {pwSuccess && (
                <div style={{ padding: '10px 14px', background: '#12301F', color: '#34D399', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle size={16} /> {pwSuccess}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label>Current Password</label>
                  <input type="password" name="currentPassword" value={pwData.currentPassword} onChange={handlePwChange} className="input-field" placeholder="Enter current password" autoFocus required />
                </div>
                <div className="form-group">
                  <label>New Password</label>
                  <input type="password" name="newPassword" value={pwData.newPassword} onChange={handlePwChange} className="input-field" placeholder="Min. 6 characters" required />
                </div>
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input type="password" name="confirmPassword" value={pwData.confirmPassword} onChange={handlePwChange} className="input-field" placeholder="Re-enter new password" required />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                <button type="button" className="btn" onClick={() => setShowPwModal(false)}
                  style={{ flex: 1, justifyContent: 'center', border: '1px solid var(--border-color)', background: 'var(--bg-white)', color: 'var(--text-dark)' }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={pwLoading}>
                  <Lock size={16} /> {pwLoading ? 'Updating…' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
