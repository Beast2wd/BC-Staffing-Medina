import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { 
  Dialog,
  DialogContent, 
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '../ui/dialog';
import { toast } from 'sonner';
import { Building2, Settings, Trash2 } from 'lucide-react';
import { setManualSubdomain, clearManualSubdomain, getSubdomain } from '../../utils/tenantUtils';
import { useAuth } from '../../context/AuthContext';

/**
 * Development helper for testing subdomain-based tenant routing
 * This component allows manually setting a subdomain in development/preview environments
 * where actual subdomain routing is not available.
 * 
 * VISIBILITY: Only shown to Super Admins in dev/preview environments
 * 
 * Usage: Add <TenantSwitcher /> to your app for dev testing
 */
export const TenantSwitcher = () => {
  const { user, isSuperAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [subdomain, setSubdomain] = useState('');
  const [currentSubdomain, setCurrentSubdomain] = useState(getSubdomain());

  useEffect(() => {
    setCurrentSubdomain(getSubdomain());
  }, [isOpen]);

  const handleSetSubdomain = () => {
    if (!subdomain.trim()) {
      toast.error('Please enter a subdomain');
      return;
    }
    
    setManualSubdomain(subdomain.trim().toLowerCase());
    toast.success(`Subdomain set to "${subdomain}". Please refresh the page.`);
    setIsOpen(false);
    
    // Reload to apply new subdomain
    window.location.reload();
  };

  const handleClearSubdomain = () => {
    clearManualSubdomain();
    toast.success('Subdomain cleared. Please refresh the page.');
    setIsOpen(false);
    
    // Reload to clear subdomain
    window.location.reload();
  };

  // Only show in development/preview environments AND only for super admins
  const isDev = window.location.hostname.includes('localhost') || 
                window.location.hostname.includes('emergentagent.com');
  
  // Hide from regular users - only super admins can see this dev tool
  if (!isDev || !isSuperAdmin) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 z-50 bg-yellow-500/90 hover:bg-yellow-600 text-black border-yellow-600"
        data-testid="tenant-switcher-btn"
      >
        <Building2 className="h-4 w-4 mr-2" />
        {currentSubdomain ? `Tenant: ${currentSubdomain}` : 'Set Tenant'}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Tenant Subdomain Switcher
            </DialogTitle>
            <DialogDescription>
              This is a development tool for testing subdomain-based tenant routing.
              In production, the tenant is automatically detected from the URL subdomain.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {currentSubdomain && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-sm">
                  <strong>Current subdomain:</strong> {currentSubdomain}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="subdomain">Subdomain</Label>
              <Input
                id="subdomain"
                placeholder="e.g., medina"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value)}
                data-testid="subdomain-input"
              />
              <p className="text-xs text-muted-foreground">
                Enter the tenant subdomain (e.g., &quot;medina&quot; for medina.bcstaffing.com)
              </p>
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Common test subdomains:</p>
              <div className="flex flex-wrap gap-2">
                {['medina', 'springfield', 'metro'].map((sub) => (
                  <Button
                    key={sub}
                    variant="outline"
                    size="sm"
                    onClick={() => setSubdomain(sub)}
                  >
                    {sub}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            {currentSubdomain && (
              <Button
                variant="destructive"
                onClick={handleClearSubdomain}
                data-testid="clear-subdomain-btn"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Subdomain
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSetSubdomain} data-testid="set-subdomain-btn">
                Set Subdomain
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TenantSwitcher;
