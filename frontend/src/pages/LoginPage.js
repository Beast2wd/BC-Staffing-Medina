import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { toast } from 'sonner';
import { Shield, Eye, EyeOff } from 'lucide-react';

const LOGO_URL = '/medina-logo.png';

export const LoginPage = () => {
  const [payrollNumber, setPayrollNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await login(payrollNumber, password);
    
    if (result.success) {
      toast.success('Login successful');
      navigate('/dashboard');
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
            <img 
              src={LOGO_URL} 
              alt="Medina County Fire/EMS" 
              className="h-28 w-auto drop-shadow-2xl"
              data-testid="login-logo"
            />
          </div>
          <div>
            <CardTitle className="text-3xl font-heading uppercase tracking-wider text-white">
              Medina County BC Staffing
            </CardTitle>
            <CardDescription className="text-zinc-300 mt-2">
              Battalion Chief Daily Staffing System
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="payroll" className="text-zinc-200">
                Payroll Number
              </Label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                <Input
                  id="payroll"
                  type="text"
                  placeholder="Enter your payroll number"
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
              If your payroll number is less than 6 digits, add leading zeros.
              <br />
              Example: 12345 becomes 012345
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
