import { useState, useEffect } from 'react';
import { ArrowLeft, Eye, UserCog, Shield } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

const ImpersonationBanner = () => {
  const [impersonationInfo, setImpersonationInfo] = useState(null);

  useEffect(() => {
    const info = localStorage.getItem('impersonation_info');
    if (info) {
      try {
        setImpersonationInfo(JSON.parse(info));
      } catch (e) {
        console.error('Failed to parse impersonation info');
      }
    }
  }, []);

  const handleExitImpersonation = () => {
    // Restore the original super admin token
    const originalToken = localStorage.getItem('original_super_admin_token');
    if (originalToken) {
      localStorage.setItem('token', originalToken);
      localStorage.removeItem('original_super_admin_token');
      localStorage.removeItem('impersonation_info');
      window.location.href = '/super-admin';
    }
  };

  if (!impersonationInfo) return null;

  const isViewOnly = impersonationInfo.mode === 'view';

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 ${
      isViewOnly 
        ? 'bg-blue-600 text-white' 
        : 'bg-yellow-500 text-yellow-900'
    } py-2 px-4 flex items-center justify-between shadow-md`}>
      <div className="flex items-center gap-3">
        {isViewOnly ? (
          <Eye className="h-4 w-4" />
        ) : (
          <UserCog className="h-4 w-4" />
        )}
        <span className="font-medium">
          {isViewOnly ? 'Viewing' : 'Impersonating'}:
        </span>
        <span className="font-bold">{impersonationInfo.tenant_name}</span>
        <Badge variant={isViewOnly ? 'secondary' : 'destructive'} className="ml-2">
          {isViewOnly ? 'View Only' : 'Full Access'}
        </Badge>
        <span className="text-sm opacity-80 ml-2">
          as {impersonationInfo.impersonating_as}
        </span>
      </div>
      <Button 
        variant="secondary" 
        size="sm" 
        onClick={handleExitImpersonation}
        className={isViewOnly ? '' : 'bg-yellow-100 hover:bg-yellow-200 text-yellow-900'}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Exit to Super Admin
      </Button>
    </div>
  );
};

export default ImpersonationBanner;
