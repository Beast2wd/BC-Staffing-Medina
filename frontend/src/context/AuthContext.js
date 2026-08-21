import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getSubdomain } from '../utils/tenantUtils';

const AuthContext = createContext(null);

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [tenant, setTenant] = useState(null);
  const [tenantLoading, setTenantLoading] = useState(true);

  const api = axios.create({
    baseURL: `${API_URL}/api`,
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  // Detect tenant from subdomain on mount
  useEffect(() => {
    const detectTenant = async () => {
      const subdomain = getSubdomain();
      
      if (subdomain) {
        try {
          const response = await axios.get(`${API_URL}/api/auth/tenant-by-subdomain/${subdomain}`);
          setTenant(response.data);
        } catch (error) {
          console.error('Failed to detect tenant from subdomain:', error);
          setTenant(null);
        }
      }
      setTenantLoading(false);
    };
    
    detectTenant();
  }, []);

  const login = async (payrollNumber, password) => {
    try {
      // Include subdomain if in subdomain context
      const subdomain = getSubdomain();
      
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        payroll_number: payrollNumber,
        password: password,
        subdomain: subdomain // Will be null if not in subdomain context
      });
      
      const { access_token, user: userData, must_change_password } = response.data;
      localStorage.setItem('token', access_token);
      setToken(access_token);
      setUser(userData);
      setMustChangePassword(must_change_password || false);
      return { success: true, mustChangePassword: must_change_password, user: userData };
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
  const isEngineer = user?.role === 'engineer' || user?.rank?.toLowerCase().includes('engineer') || user?.rank?.toLowerCase().includes('driver');
  const isFirefighter = user?.role === 'firefighter' || (user?.rank?.toLowerCase() === 'firefighter' && !user?.role);
  const isPartTime = user?.role === 'part_time' || user?.rank?.toLowerCase().includes('part-time') || user?.rank?.toLowerCase().includes('part time');
  const isVolunteer = user?.role === 'volunteer' || user?.rank?.toLowerCase().includes('volunteer');
  const isSuperAdmin = user?.is_super_admin === true;
  
  const canEdit = isAdmin || isBattalionChief || isCaptain || isLieutenant;
  // View-only users can see worksheet but not remarks and cannot edit
  const isViewOnly = (isFirefighter || isVolunteer || isPartTime || isEngineer) && !canEdit;

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
      isEngineer,
      isFirefighter,
      isPartTime,
      isVolunteer,
      isSuperAdmin,
      canEdit,
      isViewOnly,
      mustChangePassword,
      tenant,
      tenantLoading
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
