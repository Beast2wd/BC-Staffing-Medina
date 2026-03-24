import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const api = axios.create({
    baseURL: `${API_URL}/api`,
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  const login = async (payrollNumber, password) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        payroll_number: payrollNumber,
        password: password
      });
      
      const { access_token, user: userData } = response.data;
      localStorage.setItem('token', access_token);
      setToken(access_token);
      setUser(userData);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Login failed' 
      };
    }
  };

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }, []);

  const checkAuth = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
    } catch (error) {
      logout();
    } finally {
      setLoading(false);
    }
  }, [token, logout]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const isAdmin = user?.role === 'admin';
  const isBattalionChief = user?.role === 'battalion_chief';
  const isCaptain = user?.role === 'captain';
  const isLieutenant = user?.role === 'lieutenant';
  const isFirefighter = user?.role === 'firefighter';
  
  const canEdit = isAdmin || isBattalionChief || isCaptain || isLieutenant;

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      logout,
      api,
      isAdmin,
      isBattalionChief,
      isCaptain,
      isLieutenant,
      isFirefighter,
      canEdit
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
