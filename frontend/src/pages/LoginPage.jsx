import { useState } from 'react';
import api from '../utils/api';
import AlertModal from '../components/AlertModal';

export default function LoginPage({ onLogin }) {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [alertConfig, setAlertConfig] = useState({ isOpen: false, message: '', type: 'success' });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.post('/login', { email: formData.email, password: formData.password });
      if (res.data.success) {
        onLogin(res.data.data.token, res.data.data.user);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)' }}>
      <div style={{ width: 400, background: 'var(--glass-bg-strong)', backdropFilter: 'var(--glass-blur-strong)', WebkitBackdropFilter: 'var(--glass-blur-strong)', padding: '2rem', borderRadius: '18px', border: '1px solid var(--glass-border-strong)', boxShadow: 'var(--glass-sheen), 0 24px 60px -12px rgba(0,0,0,0.7)', animation: 'modalPopIn 0.45s var(--ease-glass) both' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '0.5rem', color: 'var(--text-dark)' }}>Welcome Back</h2>
        <p style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Enter your credentials to login</p>
        
        {error && <div style={{ padding: '12px', background: '#3B1A1A', color: 'var(--danger)', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} className="input-field" required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" name="password" value={formData.password} onChange={handleChange} className="input-field" required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem', width: '100%', justifyContent: 'center', padding: '12px', fontSize: '1rem' }} disabled={loading}>
            {loading ? 'Processing...' : 'Sign In'}
          </button>
        </form>
      </div>

      <div style={{ marginTop: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '0.85rem' }}>Designed and Developed by</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <a href="https://www.zeeniith.in" target="_blank" rel="noopener noreferrer" style={{ display: 'flex' }}>
            <img src="/Header_logo_DarkMode.png" alt="Zeeniith Technology" style={{ height: '50px', objectFit: 'contain' }} />
          </a>
          <span>&</span>
          <a href="https://www.quikwink.com" target="_blank" rel="noopener noreferrer" style={{ display: 'flex' }}>
            <img src="/favicon.ico" alt="QuikWink" style={{ height: '70px', objectFit: 'contain' }} />
          </a>
        </div>
      </div>

      <AlertModal
        isOpen={alertConfig.isOpen}
        title={alertConfig.type === 'error' ? 'Error' : 'Success'}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig({ isOpen: false, message: '', type: 'error' })}
      />
    </div>
  );
}
