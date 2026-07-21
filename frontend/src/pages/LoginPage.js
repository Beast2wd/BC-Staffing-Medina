import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { toast } from 'sonner';
import { Shield, Eye, EyeOff, Building2, Loader2 } from 'lucide-react';
import { getSubdomain } from '../utils/tenantUtils';

// BC Staffing main logo - Original with white background for light backgrounds
const BC_STAFFING_LOGO = "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/bllwfuej_IMG_9529.jpeg";
// Tenant-specific logo fallback
const TENANT_LOGO = '/medina-logo.png';

export const LoginPage = () => {
  const [payrollNumber, setPayrollNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login, tenant, tenantLoading } = useAuth();
  const navigate = useNavigate();
  
  const subdomain = getSubdomain();
  const isSubdomainContext = subdomain !== null;
  const displayName = isSubdomainContext && tenant ? tenant.name : 'BC Staffing';
  
  // Use BC Staffing logo for main platform, tenant logo for tenant-specific login
  const logoUrl = isSubdomainContext && tenant?.settings?.logo_url 
    ? tenant.settings.logo_url 
    : (isSubdomainContext ? TENANT_LOGO : BC_STAFFING_LOGO);

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
    <div className="min-h-screen login-bg flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" />
      
      <Card className="relative z-10 w-full max-w-md glass animate-fade-in">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-32 w-32 flex items-center justify-center">
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
                <CardTitle className="text-3xl font-heading uppercase tracking-wider text-white">
                  {displayName}
                </CardTitle>
                <CardDescription className="text-zinc-300 mt-2">
                  {isSubdomainContext && tenant ? (
                    <span className="flex items-center justify-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Battalion Chief Daily Staffing System
                    </span>
                  ) : (
                    'Battalion Chief Daily Staffing System'
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
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 transition-all duration-200 hover:scale-[1.02]"
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

          <div className="mt-4 p-3 bg-zinc-800/50 rounded-lg">
            <p className="text-xs text-zinc-400 text-center">
              <strong className="text-zinc-300">Demo Credentials:</strong>
              <br />
              Admin: 100001 / admin123
              <br />
              Battalion Chief: 100002 / bc123
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
