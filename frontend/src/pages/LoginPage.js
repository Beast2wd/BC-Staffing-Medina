import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { toast } from 'sonner';
import { Shield, Eye, EyeOff, Building2, Loader2, Home } from 'lucide-react';
import { getSubdomain } from '../utils/tenantUtils';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Default BC Staffing branding (fallback only)
const DEFAULT_LOGO = "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/1pvs2bmb_IMG_9603.png";
const DEFAULT_BACKGROUND = "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/47tmgavx_IMG_9619.jpeg";

export const LoginPage = () => {
  const [payrollNumber, setPayrollNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [platformSettings, setPlatformSettings] = useState(null);
  const { login, tenant, tenantLoading } = useAuth();
  const { logoUrl: brandingLogo, loginBackgroundUrl, tenantName, primaryColor } = useBranding();
  const navigate = useNavigate();
  
  const subdomain = getSubdomain();
  const isSubdomainContext = subdomain !== null;
  
  // Fetch platform settings for main BC Staffing login (non-tenant context)
  useEffect(() => {
    if (!isSubdomainContext) {
      const fetchPlatformSettings = async () => {
        try {
          const response = await axios.get(`${API_URL}/api/platform/settings/public`);
          setPlatformSettings(response.data);
        } catch (error) {
          console.error('Failed to fetch platform settings:', error);
        }
      };
      fetchPlatformSettings();
    }
  }, [isSubdomainContext]);

  const displayName = isSubdomainContext && tenant ? tenant.name : (platformSettings?.hero_title || tenantName || 'BC Staffing');
  
  // Use tenant branding if in tenant context, platform settings for main login, or defaults
  const logoUrl = isSubdomainContext && tenant?.settings?.logo_url 
    ? tenant.settings.logo_url 
    : (platformSettings?.logo_url || brandingLogo || DEFAULT_LOGO);
    
  const backgroundUrl = isSubdomainContext && tenant?.settings?.login_background_url
    ? tenant.settings.login_background_url
    : (platformSettings?.login_background_url || loginBackgroundUrl || DEFAULT_BACKGROUND);
    
  const buttonColor = isSubdomainContext && tenant?.settings?.primary_color
    ? tenant.settings.primary_color
    : (platformSettings?.primary_color || primaryColor || '#dc2626');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await login(payrollNumber, password);
    
    if (result.success) {
      toast.success('Login successful');
      // Redirect based on user role
      if (result.user?.is_super_admin) {
        // Super Admins go to landing page to access tenant switcher
        navigate('/');
      } else if (result.user?.role === 'volunteer') {
        navigate('/on-duty');
      } else {
        navigate('/dashboard');
      }
    } else {
      toast.error(result.error);
    }
    
    setIsLoading(false);
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${backgroundUrl})` }}
    >
      <div className="absolute inset-0 bg-black/60" />
      
      {/* Home Button - Only shown on main BC Staffing login (not tenant context) */}
      {!isSubdomainContext && (
        <Link 
          to="/"
          className="absolute top-4 left-4 z-20"
          data-testid="login-home-button"
        >
          <Button 
            variant="outline" 
            className="bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20 hover:text-white"
          >
            <Home className="h-4 w-4 mr-2" />
            Home
          </Button>
        </Link>
      )}
      
      <Card className="relative z-10 w-full max-w-md glass animate-fade-in">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-40 w-40 flex items-center justify-center">
              <img 
                src={logoUrl} 
                alt={displayName} 
                className="w-full h-full object-contain"
                data-testid="login-logo"
              />
            </div>
          </div>
          <div>
            {tenantLoading && isSubdomainContext ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-white" />
                <span className="text-zinc-300">Loading tenant...</span>
              </div>
            ) : (
              <>
                <CardTitle className="text-4xl font-heading uppercase tracking-wider text-white">
                  {displayName}
                </CardTitle>
                <CardDescription className="text-zinc-300 mt-2 text-base">
                  {isSubdomainContext && tenant ? (
                    <span className="flex items-center justify-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Fire &amp; EMS Staffing Solutions
                    </span>
                  ) : (
                    'Fire & EMS Staffing Solutions'
                  )}
                </CardDescription>
              </>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="payroll" className="text-zinc-200">
                Employee Number or Email
              </Label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                <Input
                  id="payroll"
                  type="text"
                  placeholder="Employee # or volunteer email"
                  value={payrollNumber}
                  onChange={(e) => setPayrollNumber(e.target.value)}
                  className="pl-10 bg-zinc-900/50 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-red-500"
                  data-testid="payroll-input"
                  required
                />
              </div>
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
                  data-testid="password-input"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors"
                  data-testid="toggle-password"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full text-white font-semibold py-3 transition-all duration-200 hover:scale-[1.02]"
              style={{ 
                backgroundColor: buttonColor,
                '--tw-shadow-color': buttonColor
              }}
              disabled={isLoading}
              data-testid="login-button"
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

          {/* Platform Settings Link - Only shown on main BC Staffing login (not tenant context) */}
          {!isSubdomainContext && (
            <div className="mt-4 text-center">
              <a 
                href="/platform-settings"
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors underline"
                data-testid="platform-settings-link"
              >
                Website Settings (Super Admin)
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
