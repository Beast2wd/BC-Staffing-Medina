import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { toast } from 'sonner';
import { Eye, EyeOff, Building2, Loader2 } from 'lucide-react';
import axios from 'axios';
import { setManualSubdomain } from '../utils/tenantUtils';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Medina County tenant subdomain
const MEDINA_COUNTY_SUBDOMAIN = 'medina';

// Default BC Staffing branding
const DEFAULT_LOGO = "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/agzarcqg_IMG_0147.webp";
const DEFAULT_BACKGROUND = "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/47tmgavx_IMG_9619.jpeg";

export const MedinaCountyLoginPage = () => {
  const [payrollNumber, setPayrollNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tenant, setTenant] = useState(null);
  const [loadingTenant, setLoadingTenant] = useState(true);
  
  const { user, login } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // Fetch Medina County tenant info
  useEffect(() => {
    const fetchTenant = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/auth/tenant-by-subdomain/${MEDINA_COUNTY_SUBDOMAIN}`);
        setTenant(response.data);
        // Set the subdomain context for login
        setManualSubdomain(MEDINA_COUNTY_SUBDOMAIN);
      } catch (error) {
        console.error('Failed to fetch tenant:', error);
        toast.error('Failed to load department information');
      } finally {
        setLoadingTenant(false);
      }
    };
    fetchTenant();
  }, []);

  // Get tenant branding
  const getTenantBranding = () => {
    if (!tenant) {
      return {
        logo: DEFAULT_LOGO,
        background: DEFAULT_BACKGROUND,
        primaryColor: '#dc2626',
        name: 'Medina County BC Staffing'
      };
    }
    
    const settings = tenant.settings || {};
    return {
      logo: settings.logo_url || DEFAULT_LOGO,
      background: settings.login_background_url || DEFAULT_BACKGROUND,
      primaryColor: settings.primary_color || '#dc2626',
      name: tenant.name
    };
  };

  const branding = getTenantBranding();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    // Ensure subdomain is set for login
    setManualSubdomain(MEDINA_COUNTY_SUBDOMAIN);

    const result = await login(payrollNumber, password);
    
    if (result.success) {
      toast.success('Login successful');
      if (result.user?.role === 'volunteer') {
        navigate('/on-duty');
      } else {
        navigate('/dashboard');
      }
    } else {
      toast.error(result.error);
    }
    
    setIsLoading(false);
  };

  if (loadingTenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${branding.background})` }}
    >
      <div className="absolute inset-0 bg-black/60" />
      
      <Card className="relative z-10 w-full max-w-md glass animate-fade-in">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-32 w-32 flex items-center justify-center">
              <img 
                src={branding.logo} 
                alt={branding.name} 
                className="w-full h-full object-contain"
                data-testid="medina-login-logo"
              />
            </div>
          </div>
          <div>
            <CardTitle className="text-3xl font-heading uppercase tracking-wider text-white">
              {branding.name}
            </CardTitle>
            <CardDescription className="text-zinc-300 mt-2 text-base">
              <span className="flex items-center justify-center gap-2">
                <Building2 className="h-4 w-4" />
                Staff Portal
              </span>
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="payroll" className="text-zinc-200">
                Employee Number or Email
              </Label>
              <Input
                id="payroll"
                type="text"
                placeholder="Employee # or volunteer email"
                value={payrollNumber}
                onChange={(e) => setPayrollNumber(e.target.value)}
                className="bg-zinc-900/50 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-red-500"
                data-testid="medina-payroll-input"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-200">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10 bg-zinc-900/50 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-red-500"
                  data-testid="medina-password-input"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors"
                  data-testid="medina-toggle-password"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full text-white font-semibold py-3 transition-all duration-200 hover:scale-[1.02]"
              style={{ 
                backgroundColor: branding.primaryColor,
                '--tw-shadow-color': branding.primaryColor
              }}
              disabled={isLoading}
              data-testid="medina-login-button"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-zinc-700">
            <p className="text-xs text-zinc-400 text-center">
              <strong className="text-zinc-300">Staff:</strong> Use employee number (add leading zeros if less than 6 digits)
              <br />
              <strong className="text-zinc-300">Volunteers:</strong> Use your email address
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MedinaCountyLoginPage;
