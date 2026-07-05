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

  useEffect(() => {
    const savedPrefs = localStorage.getItem('chavera_prefs');
    if (savedPrefs) { try { setPrefs(JSON.parse(savedPrefs)); } catch { /* ignore */ } }
  }, []);

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
    <div className="page-container" style={{ paddingTop: 32, maxWidth: 720 }}>
      <div className="form-header-flex">
        <h1>Settings</h1>
      </div>

      {/* Profile */}
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

      {/* About */}
      <Section title="ABOUT">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {[
            ['Application', 'Chavera Contact Directory'],
            ['Version', '1.0.0'],
            ['Database', <span key="db" style={{ color: '#059669', fontWeight: 600 }}>● MongoDB Connected</span>],
            ['Stack', 'React + Express + MongoDB'],
          ].map(([label, val], i, arr) => (
            <div key={label} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '12px 0',
              borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : 'none'
            }}>
              <span>{label}</span>
              <span style={{ color: 'var(--text-dark)', fontWeight: 600 }}>{val}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
