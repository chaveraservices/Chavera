import { useState, useEffect } from 'react';
import { Lock, Save, CheckCircle } from 'lucide-react';
import CustomSelect from '../components/CustomSelect';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

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
  const [pwData, setPwData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [prefs, setPrefs] = useState({ defaultCategory: '' });
  const [prefSaved, setPrefSaved] = useState(false);

  const [dbStats, setDbStats] = useState(null);
  const [dbStatsLoading, setDbStatsLoading] = useState(false);
  const [dbStatsError, setDbStatsError] = useState('');

  const [keepAliveEnabled, setKeepAliveEnabled] = useState(false);
  const [keepAliveLoading, setKeepAliveLoading] = useState(false);

  useEffect(() => {
    const savedPrefs = localStorage.getItem('chavera_prefs');
    if (savedPrefs) { try { setPrefs(JSON.parse(savedPrefs)); } catch { /* ignore */ } }
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

  const handleSavePrefs = () => {
    localStorage.setItem('chavera_prefs', JSON.stringify(prefs));
    setPrefSaved(true);
    setTimeout(() => setPrefSaved(false), 2500);
  };

  return (
    <div className="page-container" style={{ paddingTop: 32, maxWidth: 1200 }}>
      <div className="form-header-flex">
        <h1>Settings</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Section title="PROFILE">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary-accent), #f59e0b)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: '1.6rem', fontWeight: 700,
          }}>
            {profile.name ? profile.name[0].toUpperCase() : '?'}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-dark)' }}>{profile.name || '—'}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{profile.email || '—'}</div>
          </div>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label>Name</label>
            <input className="input-field" value={profile.name} disabled style={{ background: '#F8FAFC', cursor: 'not-allowed' }} />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input className="input-field" value={profile.email} disabled style={{ background: '#F8FAFC', cursor: 'not-allowed' }} />
          </div>
        </div>
      </Section>

      {/* Change Password */}
      <Section title="SECURITY — CHANGE PASSWORD">
        <form onSubmit={handleChangePassword}>
          {pwError && <div style={{ padding: '10px 14px', background: '#FEE2E2', color: '#DC2626', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem' }}>{pwError}</div>}
          {pwSuccess && (
            <div style={{ padding: '10px 14px', background: '#D1FAE5', color: '#059669', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={16} /> {pwSuccess}
            </div>
          )}
          <div className="form-grid">
            <div className="form-group">
              <label>Current Password</label>
              <input type="password" name="currentPassword" value={pwData.currentPassword} onChange={handlePwChange} className="input-field" placeholder="Enter current password" required />
            </div>
            <div />
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

      {/* App Preferences */}
      <Section title="APP PREFERENCES">
        <div className="form-grid">
          <div className="form-group">
            <label>Default Category</label>
            <CustomSelect 
              value={prefs.defaultCategory} 
              onChange={e => setPrefs({ ...prefs, defaultCategory: e.target.value })}
              options={[
                { label: 'None', value: '' },
                { label: 'DEALER', value: 'DEALER' },
                { label: 'CUSTOMER', value: 'CUSTOMER' }
              ]}
              placeholder="Select Category"
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pre-filled when adding contacts</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleSavePrefs} style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          {prefSaved ? <CheckCircle size={16} /> : <Save size={16} />}
          {prefSaved ? 'Saved!' : 'Save Preferences'}
        </button>
      </Section>

      {/* Server Preferences */}
      <Section title="SERVER SETTINGS (UAT ONLY)">
        <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', padding: 16, borderRadius: 8, border: '1px solid var(--border-color)' }}>
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
              background: 'white', borderRadius: '50%', transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
            }} />
          </button>
        </div>
      </Section>
      </div>

      {/* Right Column */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Database Monitoring */}
      <Section title="DATABASE STORAGE MONITORING">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Real-time MongoDB storage metrics</span>
          <button className="btn" onClick={fetchDbStats} disabled={dbStatsLoading} style={{ padding: '6px 12px', fontSize: '0.85rem', border: '1px solid var(--border-color)', background: 'white' }}>
            {dbStatsLoading ? 'Refreshing...' : 'Refresh Stats'}
          </button>
        </div>
        
        {dbStatsError && <div style={{ padding: '10px 14px', background: '#FEE2E2', color: '#DC2626', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem' }}>{dbStatsError}</div>}
        
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
                <div className="form-group" style={{ background: '#F8FAFC', padding: 16, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <label style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Database Name</label>
                  <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-dark)' }}>{dbStats.dbName}</div>
                </div>
                <div className="form-group" style={{ background: '#F8FAFC', padding: 16, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <label style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Total Collections</label>
                  <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-dark)' }}>{dbStats.collections}</div>
                </div>
                <div className="form-group" style={{ background: '#F8FAFC', padding: 16, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <label style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Total Documents</label>
                  <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-dark)' }}>{dbStats.objects}</div>
                </div>
                <div className="form-group" style={{ background: '#F8FAFC', padding: 16, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <label style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Data Size</label>
                  <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-dark)' }}>{formatMB(dbStats.dataSize)}</div>
                </div>
                <div className="form-group" style={{ background: '#F8FAFC', padding: 16, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <label style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Storage Size</label>
                  <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-dark)' }}>{formatMB(dbStats.storageSize)}</div>
                </div>
                <div className="form-group" style={{ background: '#F8FAFC', padding: 16, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <label style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Index Size</label>
                  <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-dark)' }}>{formatMB(dbStats.indexSize)}</div>
                </div>
              </div>

              {dbStats.storageSize !== undefined && (
                <div style={{ marginTop: 16, padding: '20px 24px', background: 'white', borderRadius: 12, border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-dark)' }}>Atlas Free Tier Usage</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{formatMB(usedBytes)} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/ 512 MB</span></span>
                  </div>
                  
                  <div style={{ width: '100%', height: 12, background: '#F1F5F9', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
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
                    <span style={{ color: '#059669', fontWeight: 600 }}>{formatMB(maxBytes - usedBytes)} Available</span>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </Section>


      </div>

      </div>
    </div>
  );
}
