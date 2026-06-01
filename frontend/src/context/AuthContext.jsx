import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';
import { DEMO_MODE_KEY, isDemoMode } from '../api/demoData';

const AuthContext = createContext();

function getApiError(error, fallback) {
  const data = error.response?.data;
  if (typeof data === 'string') return data;
  return data?.error || data?.message || error.message || fallback;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(isDemoMode() ? demoUser() : null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(!isDemoMode());

  useEffect(() => {
    if (isDemoMode()) {
      setUser(demoUser());
      setLoading(false);
      return;
    }
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user', error);
      setToken(null);
      localStorage.removeItem('token');
      delete api.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
    }
  };

  const register = async (email, password, name) => {
    try {
      const response = await api.post('/auth/register', { email, password, name });
      return response.data;
    } catch (error) {
      throw getApiError(error, 'Registration failed');
    }
  };

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token: newToken, user: userData } = response.data;
      setToken(newToken);
      localStorage.setItem('token', newToken);
      setUser(userData);
      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      return userData;
    } catch (error) {
      throw getApiError(error, 'Login failed');
    }
  };

  const startDemo = () => {
    localStorage.setItem(DEMO_MODE_KEY, 'true');
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(demoUser());
    setLoading(false);
  };

  const logout = () => {
    localStorage.removeItem(DEMO_MODE_KEY);
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, register, login, logout, startDemo, isDemo: isDemoMode() }}>
      {children}
    </AuthContext.Provider>
  );
}

function demoUser() {
  return {
    id: 'demo',
    email: 'demo@deutschscene.ai',
    name: 'Demo User',
    demo: true
  };
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
