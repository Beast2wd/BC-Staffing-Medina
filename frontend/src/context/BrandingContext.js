import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { getSubdomain } from '../utils/tenantUtils';

const BrandingContext = createContext(null);

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Default BC Staffing branding
const DEFAULT_BRANDING = {
  custom_branding: false,
  logo_url: "https://customer-assets.emergentagent.com/job_d18b2c49-9504-43b5-8217-508d80db16bb/artifacts/toicx4yx_Logo-1.png",
  login_background_url: "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/47tmgavx_IMG_9619.jpeg",
  primary_color: "#dc2626",
  secondary_color: "#1e3a5f", 
  accent_color: "#f59e0b",
  tenant_name: "BC Staffing"
};

export const BrandingProvider = ({ children }) => {
  const [branding, setBranding] = useState(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);

  // Fetch tenant branding on mount (for subdomain context)
  useEffect(() => {
    const fetchTenantBranding = async () => {
      const subdomain = getSubdomain();
      
      if (subdomain) {
        try {
          // Fetch tenant branding via public endpoint
          const response = await axios.get(`${API_URL}/api/auth/tenant-by-subdomain/${subdomain}`);
          const tenant = response.data;
          
          if (tenant && tenant.settings) {
            const settings = tenant.settings;
            setBranding({
              custom_branding: settings.custom_branding || false,
              logo_url: settings.logo_url || DEFAULT_BRANDING.logo_url,
              login_background_url: settings.login_background_url || DEFAULT_BRANDING.login_background_url,
              primary_color: settings.primary_color || DEFAULT_BRANDING.primary_color,
              secondary_color: settings.secondary_color || DEFAULT_BRANDING.secondary_color,
              accent_color: settings.accent_color || DEFAULT_BRANDING.accent_color,
              tenant_name: tenant.name || DEFAULT_BRANDING.tenant_name
            });
          }
        } catch (error) {
          console.error('Failed to fetch tenant branding:', error);
          // Keep defaults on error
        }
      }
      setLoading(false);
    };

    fetchTenantBranding();
  }, []);

  // Update branding (for use after login or when admin updates settings)
  const updateBranding = (newBranding) => {
    setBranding(prev => ({
      ...prev,
      ...newBranding
    }));
  };

  // Reset to defaults
  const resetBranding = () => {
    setBranding(DEFAULT_BRANDING);
  };

  // Generate CSS variables from branding colors
  const cssVariables = useMemo(() => ({
    '--brand-primary': branding.primary_color,
    '--brand-secondary': branding.secondary_color,
    '--brand-accent': branding.accent_color,
    // Generate lighter/darker variants
    '--brand-primary-hover': adjustColor(branding.primary_color, -15),
    '--brand-primary-light': adjustColor(branding.primary_color, 30),
  }), [branding]);

  // Apply CSS variables to document root
  useEffect(() => {
    const root = document.documentElement;
    Object.entries(cssVariables).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }, [cssVariables]);

  const value = {
    branding,
    loading,
    updateBranding,
    resetBranding,
    isCustomBranding: branding.custom_branding,
    // Convenience getters
    logoUrl: branding.logo_url,
    loginBackgroundUrl: branding.login_background_url,
    primaryColor: branding.primary_color,
    secondaryColor: branding.secondary_color,
    accentColor: branding.accent_color,
    tenantName: branding.tenant_name
  };

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
};

// Helper function to adjust color brightness
function adjustColor(hex, percent) {
  if (!hex || hex.length < 7) return hex;
  
  const num = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
  
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
};
