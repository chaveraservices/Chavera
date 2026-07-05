import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api'
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout when the token is missing/expired or access is denied.
api.interceptors.response.use(
  response => response,
  error => {
    const status = error.response?.status;
    if (status === 401 || status === 403) {
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
