import { useState } from 'react';
import api from '../utils/api';
import AlertModal from '../components/AlertModal';

export default function LoginPage({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [alertConfig, setAlertConfig] = useState({ isOpen: false, message: '', type: 'success' });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isRegister) {
        const res = await api.post('/register', formData);
        if (res.data.success) {
          setIsRegister(false);
          setFormData({ name: '', email: '', password: '' });
          setAlertConfig({ isOpen: true, message: 'Registration successful! Please log in.', type: 'success' });
        }
      } else {
        const res = await api.post('/login', { email: formData.email, password: formData.password });
        if (res.data.success) {
          onLogin(res.data.data.token, res.data.data.user);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)' }}>
      <div style={{ width: 400, background: 'var(--bg-white)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '0.5rem', color: 'var(--text-dark)' }}>{isRegister ? 'Create an Account' : 'Welcome Back'}</h2>
        <p style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{isRegister ? 'Enter your details to register' : 'Enter your credentials to login'}</p>
        
        {error && <div style={{ padding: '12px', background: '#FEE2E2', color: '#DC2626', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {isRegister && (
            <div className="form-group">
              <label>Name</label>
              <input name="name" value={formData.name} onChange={handleChange} className="input-field" required />
            </div>
          )}
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} className="input-field" required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" name="password" value={formData.password} onChange={handleChange} className="input-field" required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem', width: '100%' }} disabled={loading}>
            {loading ? 'Processing...' : isRegister ? 'Register' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {isRegister ? 'Already have an account? ' : "Don't have an account? "}
          <span style={{ color: 'var(--primary-accent)', cursor: 'pointer', fontWeight: 600 }} onClick={() => setIsRegister(!isRegister)}>
            {isRegister ? 'Login here' : 'Register here'}
          </span>
        </p>
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
