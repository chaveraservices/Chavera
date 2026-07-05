import { useState, Suspense, lazy } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Users, Upload, Settings, LogOut, MapPin, Building2 } from 'lucide-react';

// Lazy loaded pages
const ContactsPage = lazy(() => import('./pages/ContactsPage'));
const ContactForm = lazy(() => import('./components/ContactForm'));
const ImportPage = lazy(() => import('./pages/ImportPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const LocationsPage = lazy(() => import('./pages/LocationsPage'));
const CitiesPage = lazy(() => import('./pages/CitiesPage'));

function App() {
  const { isAuthenticated, user, login, logout } = useAuth();
  const [editingContact, setEditingContact] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = (token, userData) => {
    login(token, userData);
    navigate('/');
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!isAuthenticated) return (
    <Suspense fallback={<div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}><div className="shimmer-block" style={{ width: 400, height: 340, borderRadius: 16 }} /></div>}>
      <LoginPage onLogin={handleLogin} />
    </Suspense>
  );

  const navItems = [
    { path: '/',         icon: <Users size={18} />,   label: 'Directory'  },
    { path: '/import',   icon: <Upload size={18} />,   label: 'Import'     },
    { path: '/locations',icon: <MapPin size={18} />,   label: 'States & Districts' },
    { path: '/cities',   icon: <Building2 size={18} />,label: 'Cities'     },
    { path: '/settings', icon: <Settings size={18} />, label: 'Settings'   },
  ];

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/' || location.pathname === '/form';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Contact Directory</h2>
          <p>Enterprise Management</p>
        </div>

        <nav className="sidebar-nav" style={{ flex: 1 }}>
          {navItems.map(item => (
            <div
              key={item.path}
              className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => {
                if (item.path === '/') setEditingContact(null);
                navigate(item.path);
              }}
            >
              {item.icon} {item.label}
            </div>
          ))}
        </nav>

        <div className="sidebar-nav" style={{ borderTop: '1px solid var(--border-color)' }}>
          {user && (
            <div style={{ padding: '8px 16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{user.name}</div>
              <div>{user.email}</div>
            </div>
          )}
          <div className="nav-item" onClick={handleLogout} style={{ color: 'var(--danger, #DC2626)' }}>
            <LogOut size={18} /> Logout
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <Suspense fallback={<div style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="shimmer-block" style={{ width: '30%', height: '40px', borderRadius: '8px' }}></div>
          <div className="shimmer-block" style={{ width: '100%', height: '80px', borderRadius: '8px' }}></div>
          <div className="shimmer-block" style={{ width: '100%', height: '400px', borderRadius: '8px' }}></div>
        </div>}>
          <Routes>
            <Route path="/" element={
              <ContactsPage
                onAdd={() => { setEditingContact(null); navigate('/form'); }}
                onEdit={(contact) => { setEditingContact(contact); navigate('/form'); }}
              />
            } />
            <Route path="/form" element={
              <ContactForm
                contact={editingContact}
                onCancel={() => navigate('/')}
                onSave={() => navigate('/')}
              />
            } />
            <Route path="/import" element={
              <ImportPage onComplete={() => navigate('/')} />
            } />
            <Route path="/locations" element={<LocationsPage />} />
            <Route path="/cities" element={<CitiesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

export default App;
