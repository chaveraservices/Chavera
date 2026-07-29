import axios from 'axios';

// API base URL comes from the VITE_API_URL env var in production
// (set it to "https://<your-backend>/api"). Falls back to local dev.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout only when the token itself is missing/expired (401). A 403 means
// the token is valid but the action isn't allowed for this role (e.g. staff
// hitting an admin endpoint) — that must NOT end the session, or a staff user
// would be logged out just for opening a page with an admin-only widget.
api.interceptors.response.use(
  response => response,
  error => {
    const status = error.response?.status;
    if (status === 401) {
      // Avoid wiping session for failed login/register attempts.
      const url = error.config?.url || '';
      const isAuthRoute = url.includes('/login') || url.includes('/register');
      if (!isAuthRoute && localStorage.getItem('token')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Hard redirect so all in-memory app state resets to the login gate.
        if (window.location.pathname !== '/') {
          window.location.assign('/');
        } else {
          window.location.reload();
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
