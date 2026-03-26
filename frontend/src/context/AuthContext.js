import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

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
      
      const { access_token, user: userData, must_change_password } = response.data;
      localStorage.setItem('token', access_token);
      setToken(access_token);
      setUser(userData);
      setMustChangePassword(must_change_password || false);
      return { success: true, mustChangePassword: must_change_password };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Login failed' 
      };
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword
      });
      setMustChangePassword(false);
      if (user) {
        setUser({ ...user, must_change_password: false });
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Failed to change password'
      };
    }
  };

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setMustChangePassword(false);
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
      setMustChangePassword(response.data.must_change_password || false);
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
      changePassword,
      api,
      isAdmin,
      isBattalionChief,
      isCaptain,
      isLieutenant,
      isFirefighter,
      canEdit,
      mustChangePassword
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
