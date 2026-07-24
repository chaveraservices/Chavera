import { useState, useEffect } from 'react';
import { Lock, CheckCircle } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import UserAccessPanel from '../components/UserAccessPanel';
import ProductManager from '../components/ProductManager';

function Section({ title, children }) {
  return (
    <div className="form-section" style={{ marginBottom: 24 }}>
      <div className="form-section-title">{title}</div>
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

  const [dbStats, setDbStats] = useState(null);
  const [dbStatsLoading, setDbStatsLoading] = useState(false);
  const [dbStatsError, setDbStatsError] = useState('');

  const [keepAliveEnabled, setKeepAliveEnabled] = useState(false);
  const [keepAliveLoading, setKeepAliveLoading] = useState(false);

  useEffect(() => {
    fetchDbStats();
    fetchKeepAliveStatus();
  }, []);

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
    } catch (err) {
      setPwError(err.response?.data?.message || 'Failed to change password. Check your current password.');
    } finally { setPwLoading(false); }
  };


  return (
    <div className="page-container" style={{ paddingTop: 32, maxWidth: 1200 }}>
      <div className="form-header-flex">
        <h1>Settings</h1>
      </div>

      {/* One page, two columns so it packs onto ~one screen without tabs. The
          long lists (users, products) scroll inside their own panels, so they
          can't stretch the page into a long scroll. */}
      <div className="settings-cols">
      <div className="settings-col">
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
      </Section>

      {/* Change Password */}
      <Section title="SECURITY — CHANGE PASSWORD">
        <form onSubmit={handleChangePassword}>
          {pwError && <div style={{ padding: '10px 14px', background: '#3B1A1A', color: 'var(--danger)', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem' }}>{pwError}</div>}
          {pwSuccess && (
            <div style={{ padding: '10px 14px', background: '#12301F', color: '#34D399', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={16} /> {pwSuccess}
            </div>
          )}
          {/* Single column so the three fields read top-to-bottom in the order
              you fill them, instead of scattering across a 2-col grid. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label>Current Password</label>
              <input type="password" name="currentPassword" value={pwData.currentPassword} onChange={handlePwChange} className="input-field" placeholder="Enter current password" required />
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
          <button type="submit" className="btn btn-primary" style={{ marginTop: 20 }} disabled={pwLoading}>
            <Lock size={16} /> {pwLoading ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </Section>

      {/* Server Preferences */}
      {isAdmin && (
      <Section title="SERVER SETTINGS">
        <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: 16, borderRadius: 8, border: '1px solid var(--border-color)' }}>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-dark)', marginBottom: 4 }}>14-Minute Keep-Alive</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Prevent the server from sleeping due to inactivity. (Always ON in Production)</div>
          </div>
          <button 
            type="button"
            onClick={toggleKeepAlive} 
            disabled={keepAliveLoading}
            style={{
              position: 'relative', width: 44, height: 24, borderRadius: 12, border: 'none', cursor: keepAliveLoading ? 'wait' : 'pointer',
              background: keepAliveEnabled ? '#10b981' : '#cbd5e1', transition: 'background 0.3s'
            }}
          >
            <div style={{
              position: 'absolute', top: 2, left: keepAliveEnabled ? 22 : 2, width: 20, height: 20,
              background: 'var(--bg-white)', borderRadius: '50%', transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
            }} />
          </button>
        </div>
      </Section>
      )}
      </div>

      {/* Right column — the taller admin panels. */}
      {isAdmin && (
      <div className="settings-col">
      <Section title="USER ACCESS &amp; ROLES">
        <UserAccessPanel />
      </Section>

      <Section title="PRODUCTS">
        <ProductManager />
      </Section>

      {/* Database Monitoring */}
      <Section title="DATABASE STORAGE MONITORING">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Real-time MongoDB storage metrics</span>
          <button className="btn" onClick={fetchDbStats} disabled={dbStatsLoading} style={{ padding: '6px 12px', fontSize: '0.85rem', border: '1px solid var(--border-color)', background: 'var(--bg-white)' }}>
            {dbStatsLoading ? 'Refreshing...' : 'Refresh Stats'}
          </button>
        </div>
        
        {dbStatsError && <div style={{ padding: '10px 14px', background: '#3B1A1A', color: 'var(--danger)', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem' }}>{dbStatsError}</div>}
        
        {dbStats && (() => {
          const maxBytes = 512 * 1024 * 1024;
          const usedBytes = dbStats.storageSize !== undefined ? (dbStats.storageSize + (dbStats.indexSize || 0)) : 0;
          const usedPercent = Math.min(100, (usedBytes / maxBytes) * 100);
          const getProgressColor = (percent) => {
            if (percent > 90) return 'linear-gradient(90deg, #ef4444, #f87171)';
            if (percent > 75) return 'linear-gradient(90deg, #f59e0b, #fbbf24)';
            return 'linear-gradient(90deg, #10b981, #34d399)';
          };

          return (
            <>
              <div className="form-grid">
                <div className="form-group" style={{ background: 'var(--bg-main)', padding: 16, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <label style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Database Name</label>
                  <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-dark)' }}>{dbStats.dbName}</div>
                </div>
                <div className="form-group" style={{ background: 'var(--bg-main)', padding: 16, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <label style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Total Collections</label>
                  <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-dark)' }}>{dbStats.collections}</div>
                </div>
                <div className="form-group" style={{ background: 'var(--bg-main)', padding: 16, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <label style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Total Documents</label>
                  <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-dark)' }}>{dbStats.objects}</div>
                </div>
                <div className="form-group" style={{ background: 'var(--bg-main)', padding: 16, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <label style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Data Size</label>
                  <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-dark)' }}>{formatMB(dbStats.dataSize)}</div>
                </div>
                <div className="form-group" style={{ background: 'var(--bg-main)', padding: 16, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <label style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Storage Size</label>
                  <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-dark)' }}>{formatMB(dbStats.storageSize)}</div>
                </div>
                <div className="form-group" style={{ background: 'var(--bg-main)', padding: 16, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <label style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Index Size</label>
                  <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-dark)' }}>{formatMB(dbStats.indexSize)}</div>
                </div>
              </div>

              {dbStats.storageSize !== undefined && (
                <div style={{ marginTop: 16, padding: '20px 24px', background: 'var(--bg-white)', borderRadius: 12, border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-dark)' }}>Atlas Free Tier Usage</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{formatMB(usedBytes)} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/ 512 MB</span></span>
                  </div>
                  
                  <div style={{ width: '100%', height: 12, background: '#232322', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ 
                      position: 'absolute',
                      top: 0, left: 0, bottom: 0,
                      width: `${usedPercent}%`, 
                      background: getProgressColor(usedPercent),
                      borderRadius: 6,
                      transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
                    }} />
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{usedPercent.toFixed(2)}% Used</span>
                    <span style={{ color: '#34D399', fontWeight: 600 }}>{formatMB(maxBytes - usedBytes)} Available</span>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </Section>
      </div>
      )}
      </div>
    </div>
  );
}
