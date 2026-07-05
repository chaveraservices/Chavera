import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

// Decode JWT payload without verifying signature (client-side expiry pre-check only).
function decodeTokenPayload(token) {
  try {
    const base64 = token.split('.')[1];
    // Make the base64 string URL-safe before decoding
    const padded = base64.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

// Reads the persisted token and immediately discards it if it is expired.
function readValidToken() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;

    const payload = decodeTokenPayload(token);
    if (!payload) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return null;
    }

    // payload.exp is in seconds; Date.now() is in ms
    const isExpired = payload.exp && Date.now() >= payload.exp * 1000;
    if (isExpired) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return null;
    }

    return token;
  } catch {
    return null;
  }
}

// Reads the persisted user once at startup.
function readStoredUser() {
  try {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(readValidToken);
  const [user, setUser] = useState(() => {
    // Only restore user if the token is still valid
    return token ? readStoredUser() : null;
  });

  const login = useCallback((authToken, userData) => {
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(authToken);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  const value = {
    user,
    token,
    isAuthenticated: !!token,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
