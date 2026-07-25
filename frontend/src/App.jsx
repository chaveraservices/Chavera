import { useState, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Users, Settings, LogOut, LayoutDashboard, ChevronDown } from 'lucide-react';

// Lazy loaded pages
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ContactsPage = lazy(() => import('./pages/ContactsPage'));
const ImportPage = lazy(() => import('./pages/ImportPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const LocationsPage = lazy(() => import('./pages/LocationsPage'));
const CitiesPage = lazy(() => import('./pages/CitiesPage'));

// Gate for admin-only pages. Staff are redirected to the Entry list rather than
// shown a page whose actions they can't perform. This is a UX guard, not the
// security boundary — the backend requireRole middleware is that.
function RequireAdmin({ isAdmin, children }) {
  return isAdmin ? children : <Navigate to="/" replace />;
}

function App() {
  const { isAuthenticated, user, login, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Tokens issued before roles existed carry no role; treat those as admin so
  // the upgrade never locks the existing owner out of their own tools.
  const role = user?.role || 'admin';
  const isAdmin = role === 'admin';
  // Friendly role label for display. The system has two roles; admins get the
  // "Super Admin" title since it's the top level of access.
  const roleLabel = isAdmin ? 'Super Admin' : 'Staff';

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

  // Settings lives only in the header user dropdown now, not the nav. Import is
  // reached from the Entry toolbar. The Dashboard (analytics, DB usage) is an
  // admin tool, so staff only get the Entry screen in the nav.
  const navItems = [
    ...(isAdmin ? [{ path: '/dashboard', icon: <LayoutDashboard size={17} />, label: 'Dashboard' }] : []),
    { path: '/', icon: <Users size={17} />, label: 'Entry' },
  ];

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="app-shell">
      {/* Top navigation bar (replaces the former left sidebar) */}
      <header className="navbar">
        <div className="navbar-user">
          <button type="button" className="navbar-user-btn" onClick={() => setMenuOpen(o => !o)} aria-expanded={menuOpen}>
            <span className="navbar-avatar">{(user?.name || '?').charAt(0).toUpperCase()}</span>
            <span className="navbar-user-meta">
              <span className="navbar-user-name">{user?.name}</span>
              <span className="navbar-user-role">{roleLabel}</span>
            </span>
            <ChevronDown size={14} />
          </button>

          {menuOpen && (
            <>
              {/* Click-catcher so the menu closes on any outside click. */}
              <div className="navbar-menu-scrim" onClick={() => setMenuOpen(false)} />
              <div className="navbar-menu">
                <div className="navbar-menu-head">
                  <div className="navbar-user-name">{user?.name}</div>
                  <div className="navbar-user-email">{user?.email}</div>
                  <span className={`role-badge ${isAdmin ? 'is-admin' : ''}`}>{roleLabel}</span>
                </div>
                <button type="button" className="navbar-menu-item" onClick={() => { setMenuOpen(false); navigate('/settings'); }}>
                  <Settings size={15} /> Settings
                </button>
                <button type="button" className="navbar-menu-item is-danger" onClick={() => { setMenuOpen(false); handleLogout(); }}>
                  <LogOut size={15} /> Logout
                </button>
              </div>
            </>
          )}
        </div>
        <nav className="navbar-nav">
          {navItems.map(item => (
            <button
              key={item.path}
              type="button"
              className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.icon} <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="navbar-brand" onClick={() => navigate(isAdmin ? '/dashboard' : '/')} title="Chavera">
          <img src="/chavera-logo.png" alt="Chavera" className="navbar-logo" />
        </div>

      </header>

      {/* Main Content */}
      <main className="main-content">
        <Suspense fallback={<div style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="shimmer-block" style={{ width: '30%', height: '40px', borderRadius: '8px' }}></div>
          <div className="shimmer-block" style={{ width: '100%', height: '80px', borderRadius: '8px' }}></div>
          <div className="shimmer-block" style={{ width: '100%', height: '400px', borderRadius: '8px' }}></div>
        </div>}>
          <Routes>
            {/* The entry form is now a modal hosted inside ContactsPage — no
                separate /form route to navigate to. */}
            <Route path="/" element={<ContactsPage />} />
            {/* Dashboard is admin-only — staff typing the URL bounce to Entry. */}
            <Route path="/dashboard" element={
              <RequireAdmin isAdmin={isAdmin}><DashboardPage /></RequireAdmin>
            } />
            {/* Settings is open to staff — it self-gates the admin-only tabs and
                staff still need it to change their own password. */}
            <Route path="/settings" element={<SettingsPage />} />

            {/* Admin-only pages. The backend already 403s the privileged actions;
                this stops a staff user reaching the page at all (e.g. by typing
                the URL) and bounces them to the Entry list. */}
            <Route path="/import" element={
              <RequireAdmin isAdmin={isAdmin}>
                <ImportPage onComplete={() => navigate('/')} />
              </RequireAdmin>
            } />
            <Route path="/locations" element={
              <RequireAdmin isAdmin={isAdmin}><LocationsPage /></RequireAdmin>
            } />
            <Route path="/cities" element={
              <RequireAdmin isAdmin={isAdmin}><CitiesPage /></RequireAdmin>
            } />

            {/* Unknown path → Entry list, so a stale bookmark never dead-ends. */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

export default App;
