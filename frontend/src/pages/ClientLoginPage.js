import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Eye, EyeOff, Building2, Loader2, ArrowLeft, Search } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Default BC Staffing branding
const DEFAULT_LOGO = "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/1pvs2bmb_IMG_9603.png";
const DEFAULT_BACKGROUND = "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/47tmgavx_IMG_9619.jpeg";

export const ClientLoginPage = () => {
  const [step, setStep] = useState(1); // 1 = select department, 2 = login
  const [tenants, setTenants] = useState([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Login form state
  const [payrollNumber, setPayrollNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // Fetch available tenants
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/tenants/public/list`);
        setTenants(response.data);
      } catch (error) {
        console.error('Failed to fetch tenants:', error);
        toast.error('Failed to load departments');
      } finally {
        setLoadingTenants(false);
      }
    };
    fetchTenants();
  }, []);

  // Get tenant branding
  const getTenantBranding = () => {
    if (!selectedTenant) {
      return {
        logo: DEFAULT_LOGO,
        background: DEFAULT_BACKGROUND,
        primaryColor: '#dc2626',
        name: 'Select Department'
      };
    }
    
    const settings = selectedTenant.settings || {};
    return {
      logo: settings.logo_url || DEFAULT_LOGO,
      background: settings.login_background_url || DEFAULT_BACKGROUND,
      primaryColor: settings.primary_color || '#dc2626',
      name: selectedTenant.name
    };
  };

  const branding = getTenantBranding();

  // Filter tenants by search
  const filteredTenants = tenants.filter(tenant =>
    tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tenant.subdomain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTenantSelect = (tenantId) => {
    const tenant = tenants.find(t => t.id === tenantId);
    setSelectedTenant(tenant);
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
    setSelectedTenant(null);
    setPayrollNumber('');
    setPassword('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!selectedTenant) {
      toast.error('Please select a department first');
      return;
    }

    if (!payrollNumber || !password) {
      toast.error('Please enter your credentials');
      return;
    }

    setIsLoading(true);

    try {
      // Login with tenant context
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        payroll_number: payrollNumber,
        password: password,
        tenant_subdomain: selectedTenant.subdomain
      });

      const { access_token, user: userData } = response.data;

      // Store token and user data
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      
      // Set tenant subdomain for context (this persists after logout so user stays on tenant login)
      localStorage.setItem('tenant_subdomain', selectedTenant.subdomain);

      toast.success(`Welcome back, ${userData.first_name}!`);
      
      // Reload to apply auth context
      window.location.href = '/dashboard';
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Login failed';
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat transition-all duration-500"
      style={{ backgroundImage: `url(${branding.background})` }}
    >
      <div className="absolute inset-0 bg-black/60" />
      
      <Card className="relative z-10 w-full max-w-md glass animate-fade-in">
        {/* Step 1: Department Selection */}
        {step === 1 && (
          <>
            <CardHeader className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-40 w-40 flex items-center justify-center">
                  <img 
                    src={DEFAULT_LOGO} 
                    alt="BC Staffing" 
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
              <div>
                <CardTitle className="text-4xl font-heading uppercase tracking-wider text-white">
                  Client Portal
                </CardTitle>
                <CardDescription className="text-zinc-300 mt-2 text-base">
                  Select your department to continue
                </CardDescription>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input
                  type="text"
                  placeholder="Search departments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500"
                  data-testid="department-search"
                />
              </div>

              {/* Department List */}
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {loadingTenants ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                  </div>
                ) : filteredTenants.length === 0 ? (
                  <div className="text-center py-8 text-zinc-400">
                    {searchQuery ? 'No departments found' : 'No departments available'}
                  </div>
                ) : (
                  filteredTenants.map((tenant) => (
                    <button
                      key={tenant.id}
                      onClick={() => handleTenantSelect(tenant.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700 hover:border-zinc-600 transition-all text-left group"
                      data-testid={`tenant-${tenant.subdomain}`}
                    >
                      <div className="w-10 h-10 rounded-lg bg-zinc-700/50 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {tenant.settings?.logo_url ? (
                          <img 
                            src={tenant.settings.logo_url} 
                            alt={tenant.name}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <Building2 className="h-5 w-5 text-zinc-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate group-hover:text-zinc-100">
                          {tenant.name}
                        </p>
                        <p className="text-xs text-zinc-500 truncate">
                          {tenant.subdomain}.bcstaffing.com
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Back to Landing */}
              <div className="pt-4 border-t border-zinc-700">
                <Button
                  variant="ghost"
                  className="w-full text-zinc-400 hover:text-white"
                  onClick={() => navigate('/')}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {/* Step 2: Login Form */}
        {step === 2 && selectedTenant && (
          <>
            <CardHeader className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-40 w-40 flex items-center justify-center">
                  <img 
                    src={branding.logo} 
                    alt={branding.name} 
                    className="w-full h-full object-contain"
                    data-testid="tenant-logo"
                  />
                </div>
              </div>
              <div>
                <CardTitle className="text-4xl font-heading uppercase tracking-wider text-white">
                  {branding.name}
                </CardTitle>
                <CardDescription className="text-zinc-300 mt-2 text-base">
                  Sign in to your account
                </CardDescription>
              </div>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
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
                    className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500"
                    data-testid="payroll-input"
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
                      className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 pr-10"
                      data-testid="password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full text-white font-semibold py-3 transition-all duration-200 hover:scale-[1.02]"
                  style={{ backgroundColor: branding.primaryColor }}
                  disabled={isLoading}
                  data-testid="login-button"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>

              {/* Instructions */}
              <div className="mt-6 pt-6 border-t border-zinc-700">
                <p className="text-xs text-zinc-400 text-center">
                  <strong className="text-zinc-300">Staff:</strong> Use employee number (add leading zeros if less than 6 digits)
                  <br />
                  <strong className="text-zinc-300">Volunteers:</strong> Use your email address
                </p>
              </div>

              {/* Change Department */}
              <div className="mt-4">
                <Button
                  variant="ghost"
                  className="w-full text-zinc-400 hover:text-white"
                  onClick={handleBack}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Change Department
                </Button>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
};

export default ClientLoginPage;
