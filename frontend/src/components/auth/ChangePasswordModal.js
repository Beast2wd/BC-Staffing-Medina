import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { Lock, Eye, EyeOff, AlertTriangle, ShieldCheck, ShieldAlert, Shield } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';

// Password strength calculation
const calculatePasswordStrength = (password) => {
  if (!password) return { score: 0, label: '', color: '', tips: [] };
  
  let score = 0;
  const tips = [];
  
  // Length checks
  if (password.length >= 6) score += 1;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  
  // Character variety checks
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  
  // Tips for improvement
  if (password.length < 8) tips.push('Use 8+ characters');
  if (!/[A-Z]/.test(password)) tips.push('Add uppercase letter');
  if (!/[0-9]/.test(password)) tips.push('Add a number');
  if (!/[^a-zA-Z0-9]/.test(password)) tips.push('Add special character');
  
  // Determine strength level
  if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500', textColor: 'text-red-500', tips };
  if (score <= 4) return { score, label: 'Fair', color: 'bg-yellow-500', textColor: 'text-yellow-500', tips };
  if (score <= 5) return { score, label: 'Good', color: 'bg-blue-500', textColor: 'text-blue-500', tips };
  return { score, label: 'Strong', color: 'bg-green-500', textColor: 'text-green-500', tips: [] };
};

export const ChangePasswordModal = ({ isOpen, onClose, isRequired = false }) => {
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Calculate password strength
  const passwordStrength = useMemo(() => calculatePasswordStrength(newPassword), [newPassword]);

  const handleClose = () => {
    if (!isRequired) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      onClose();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    // Allow users to use any password, including previous passwords
    // No restriction on password reuse

    setLoading(true);
    const result = await changePassword(currentPassword, newPassword);
    setLoading(false);

    if (result.success) {
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onClose();
    } else {
      setError(result.error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent 
        className="max-w-md" 
        onInteractOutside={isRequired ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={isRequired ? (e) => e.preventDefault() : undefined}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading uppercase">
            <Lock className="h-5 w-5" />
            Change Password
          </DialogTitle>
          <DialogDescription>
            {isRequired 
              ? 'You must change your temporary password before continuing.'
              : 'Enter your current password and choose a new password.'}
          </DialogDescription>
        </DialogHeader>

        {isRequired && (
          <Alert className="border-yellow-500/50 bg-yellow-500/10">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <AlertDescription className="text-yellow-500">
              This is required for your first login. You cannot skip this step.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Current Password</Label>
            <div className="relative">
              <Input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                required
                data-testid="current-password-input"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>New Password</Label>
            <div className="relative">
              <Input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)"
                required
                minLength={6}
                data-testid="new-password-input"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            
            {/* Password Strength Indicator */}
            {newPassword && (
              <div className="space-y-2" data-testid="password-strength-indicator">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                      style={{ width: `${Math.min((passwordStrength.score / 7) * 100, 100)}%` }}
                    />
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-medium ${passwordStrength.textColor}`}>
                    {passwordStrength.label === 'Weak' && <ShieldAlert className="h-3.5 w-3.5" />}
                    {passwordStrength.label === 'Fair' && <Shield className="h-3.5 w-3.5" />}
                    {(passwordStrength.label === 'Good' || passwordStrength.label === 'Strong') && <ShieldCheck className="h-3.5 w-3.5" />}
                    {passwordStrength.label}
                  </div>
                </div>
                {passwordStrength.tips.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Tips: {passwordStrength.tips.join(' • ')}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Confirm New Password</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
              data-testid="confirm-password-input"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" disabled={loading} data-testid="change-password-btn">
              {loading ? 'Changing...' : 'Change Password'}
            </Button>
            {!isRequired && (
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
