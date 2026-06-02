import { createContext, useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';

const API = 'http://localhost:5000';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const setAxiosToken = useCallback((t) => {
    if (t) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, []);

  // Verify token on mount
  useEffect(() => {
    const verify = async () => {
      const stored = localStorage.getItem('token');
      if (!stored) { setLoading(false); return; }
      setAxiosToken(stored);
      try {
        const res = await axios.get(`${API}/api/auth/me`);
        setUser(res.data.user || res.data);
        setToken(stored);
      } catch {
        localStorage.removeItem('token');
        setAxiosToken(null);
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    verify();
  }, [setAxiosToken]);

  const login = async (loginId, password) => {
    const res = await axios.post(`${API}/api/auth/login`, { login: loginId, password });
    const { user: u, token: t } = res.data;
    localStorage.setItem('token', t);
    setAxiosToken(t);
    setToken(t);
    setUser(u);
    return u;
  };

  const register = async (username, email, password) => {
    const res = await axios.post(`${API}/api/auth/register`, { username, email, password });
    const { user: u, token: t } = res.data;
    localStorage.setItem('token', t);
    setAxiosToken(t);
    setToken(t);
    setUser(u);
    return u;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setAxiosToken(null);
    setToken(null);
    setUser(null);
  };

  const changePassword = async (currentPassword, newPassword) => {
    await axios.post(`${API}/api/auth/change-password`, {
      current_password: currentPassword,
      new_password: newPassword,
    });
  };

  const isAuthenticated = () => !!token && !!user;
  const isAdmin = () => user?.is_admin === true;

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      login, register, logout, changePassword,
      isAuthenticated, isAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default AuthContext;
