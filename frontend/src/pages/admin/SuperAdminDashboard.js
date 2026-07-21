import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { 
  Building2, 
  Plus, 
  Users, 
  Building, 
  Loader2, 
  Shield,
  Globe,
  BarChart3,
  Power,
  PowerOff,
  Eye,
  UserCog,
  LogIn,
  ArrowLeft,
  AlertTriangle,
  Database,
  Calendar,
  Clock,
  LogOut,
  Home
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import TenantOnboardingWizard from '../../components/admin/TenantOnboardingWizard';
import { clearManualSubdomain } from '../../utils/tenantUtils';

// BC Staffing Logo - Dark background version
const BC_STAFFING_LOGO = "https://static.prod-images.emergentagent.com/jobs/d18b2c49-9504-43b5-8217-508d80db16bb/images/9f780126d6ba8f80b79e7ee69875a12fdb7babce775a898ff9bf1bf43fcc3e36.jpeg";

const SuperAdminDashboard = () => {
  const { api, login, user, logout } = useAuth();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  const [showDataPreview, setShowDataPreview] = useState(false);
  const [showImpersonateDialog, setShowImpersonateDialog] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [tenantStats, setTenantStats] = useState(null);
  const [tenantPreviewData, setTenantPreviewData] = useState(null);
  const [impersonationMode, setImpersonationMode] = useState('view');
  const [loadingPreview, setLoadingPreview] = useState(false);

  const fetchTenants = async () => {
    try {
      const response = await api.get('/tenants');
      setTenants(response.data);
    } catch (error) {
      toast.error('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  const fetchTenantStats = async (tenantId) => {
    try {
      const response = await api.get(`/tenants/${tenantId}/stats`);
      setTenantStats(response.data);
      setShowStatsDialog(true);
    } catch (error) {
      toast.error('Failed to load tenant stats');
    }
  };

  const handleToggleTenant = async (tenant) => {
    try {
      if (tenant.is_active) {
        await api.delete(`/tenants/${tenant.id}`);
        toast.success('Tenant deactivated');
      } else {
        await api.post(`/tenants/${tenant.id}/activate`);
        toast.success('Tenant activated');
      }
      fetchTenants();
    } catch (error) {
      toast.error('Failed to update tenant status');
    }
  };

  const fetchTenantDataPreview = async (tenantId) => {
    setLoadingPreview(true);
    try {
      const response = await api.get(`/tenants/${tenantId}/data-preview`);
      setTenantPreviewData(response.data);
      setShowDataPreview(true);
    } catch (error) {
      toast.error('Failed to load tenant data preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleImpersonate = async () => {
    if (!selectedTenant) return;
    
    try {
      const response = await api.post(`/tenants/${selectedTenant.id}/impersonate?mode=${impersonationMode}`);
      
      // Store the original token to restore later
      const originalToken = localStorage.getItem('token');
      localStorage.setItem('original_super_admin_token', originalToken);
      localStorage.setItem('impersonation_info', JSON.stringify(response.data.impersonation));
      
      // Set the new impersonation token
      localStorage.setItem('token', response.data.access_token);
      
      // Set the tenant subdomain for routing context
      localStorage.setItem('tenant_subdomain', selectedTenant.subdomain);
      
      toast.success(`Now ${impersonationMode === 'view' ? 'viewing' : 'impersonating'} ${selectedTenant.name}`);
      setShowImpersonateDialog(false);
      
      // Redirect to dashboard (tenant context is now set)
      window.location.href = '/dashboard';
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to impersonate tenant');
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const getStatusBadge = (status, isActive) => {
    if (!isActive) {
      return <Badge variant="destructive">Suspended</Badge>;
    }
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Active</Badge>;
      case 'trial':
        return <Badge className="bg-yellow-500">Trial</Badge>;
      case 'suspended':
        return <Badge variant="destructive">Suspended</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleLogout = () => {
    logout();
    clearManualSubdomain();
    localStorage.removeItem('impersonation_info');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Custom BC Staffing Header for Super Admin */}
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Brand */}
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/')}
                className="text-slate-400 hover:text-white"
              >
                <Home className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
              <div className="h-8 w-px bg-slate-600" />
              <a href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer">
                <div className="w-10 h-10">
                  <img
                    src={BC_STAFFING_LOGO}
                    alt="BC Staffing"
                    className="w-full h-full object-contain rounded-lg"
                  />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">BC STAFFING</h1>
                  <p className="text-xs text-slate-400">Super Admin Portal</p>
                </div>
              </a>
            </div>

            {/* User Info and Logout */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-white">{user?.first_name} {user?.last_name}</p>
                <p className="text-xs text-slate-400">Super Administrator</p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleLogout}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Super Admin Dashboard</h1>
              <p className="text-slate-400">Manage all tenants across the platform</p>
            </div>
          </div>
          <Button 
            onClick={() => setShowOnboardingWizard(true)} 
            data-testid="add-tenant-btn"
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Plus className="h-4 w-4 mr-2" /> New Tenant
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Building2 className="h-8 w-8 text-blue-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{tenants.length}</p>
                  <p className="text-sm text-slate-400">Total Tenants</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Power className="h-8 w-8 text-green-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{tenants.filter(t => t.is_active).length}</p>
                  <p className="text-sm text-slate-400">Active Tenants</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Users className="h-8 w-8 text-purple-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{tenants.reduce((acc, t) => acc + (t.user_count || 0), 0)}</p>
                  <p className="text-sm text-slate-400">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Building className="h-8 w-8 text-orange-400" />
                <div>
                  <p className="text-2xl font-bold text-white">{tenants.reduce((acc, t) => acc + (t.station_count || 0), 0)}</p>
                  <p className="text-sm text-slate-400">Total Stations</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tenants Table */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">All Tenants</CardTitle>
            <CardDescription className="text-slate-400">Manage fire departments using the platform</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : tenants.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No tenants yet. Create your first tenant to get started.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-slate-700/50">
                    <TableHead className="text-slate-300">Organization</TableHead>
                    <TableHead className="text-slate-300">Subdomain</TableHead>
                    <TableHead className="text-slate-300">Status</TableHead>
                    <TableHead className="text-slate-300">Users</TableHead>
                    <TableHead className="text-slate-300">Stations</TableHead>
                    <TableHead className="text-slate-300">Created</TableHead>
                    <TableHead className="text-right text-slate-300">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((tenant) => (
                    <TableRow key={tenant.id} className="border-slate-700 hover:bg-slate-700/50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-slate-400" />
                          <span className="font-medium text-white">{tenant.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-slate-400">
                          <Globe className="h-3 w-3" />
                          <span>{tenant.subdomain}.app.com</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(tenant.status, tenant.is_active)}
                      </TableCell>
                      <TableCell className="text-white">{tenant.user_count || 0}</TableCell>
                      <TableCell className="text-white">{tenant.station_count || 0}</TableCell>
                      <TableCell className="text-slate-400">
                        {new Date(tenant.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedTenant(tenant);
                              fetchTenantStats(tenant.id);
                            }}
                            title="View Statistics"
                            className="text-slate-400 hover:text-white hover:bg-slate-600"
                          >
                            <BarChart3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedTenant(tenant);
                              fetchTenantDataPreview(tenant.id);
                            }}
                            title="View Data Preview"
                            disabled={!tenant.is_active}
                            className="text-slate-400 hover:text-white hover:bg-slate-600"
                          >
                            <Database className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedTenant(tenant);
                              setShowImpersonateDialog(true);
                            }}
                            title="Access Tenant Portal"
                            disabled={!tenant.is_active}
                            className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30"
                          >
                            <LogIn className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleTenant(tenant)}
                            className={tenant.is_active ? 'text-red-400 hover:text-red-300 hover:bg-red-900/30' : 'text-green-400 hover:text-green-300 hover:bg-green-900/30'}
                            title={tenant.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {tenant.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Tenant Onboarding Wizard */}
        <TenantOnboardingWizard
          isOpen={showOnboardingWizard}
          onClose={() => setShowOnboardingWizard(false)}
          onSuccess={() => fetchTenants()}
          existingTenants={tenants}
        />

        {/* Tenant Stats Dialog */}
        <Dialog open={showStatsDialog} onOpenChange={setShowStatsDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                {selectedTenant?.name} Statistics
              </DialogTitle>
            </DialogHeader>
            {tenantStats && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{tenantStats.counts?.users || 0}</p>
                    <p className="text-sm text-muted-foreground">Total Users</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{tenantStats.counts?.active_users || 0}</p>
                    <p className="text-sm text-muted-foreground">Active Users</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{tenantStats.counts?.personnel || 0}</p>
                    <p className="text-sm text-muted-foreground">Personnel</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{tenantStats.counts?.stations || 0}</p>
                    <p className="text-sm text-muted-foreground">Stations</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{tenantStats.counts?.battalions || 0}</p>
                    <p className="text-sm text-muted-foreground">Battalions</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{tenantStats.counts?.staffing_records || 0}</p>
                    <p className="text-sm text-muted-foreground">Staffing Records</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{tenantStats.counts?.overtime_records || 0}</p>
                    <p className="text-sm text-muted-foreground">Overtime Records</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{tenantStats.counts?.deployments || 0}</p>
                    <p className="text-sm text-muted-foreground">Deployments</p>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Tenant Data Preview Dialog */}
        <Dialog open={showDataPreview} onOpenChange={setShowDataPreview}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                {selectedTenant?.name} - Data Preview
                <Badge variant="secondary" className="ml-2">View Only</Badge>
              </DialogTitle>
              <DialogDescription>
                Read-only preview of tenant data for support and testing
              </DialogDescription>
            </DialogHeader>
            {loadingPreview ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : tenantPreviewData && (
              <Tabs defaultValue="users" className="mt-4">
                <TabsList className="grid grid-cols-5 w-full">
                  <TabsTrigger value="users">Users ({tenantPreviewData.users?.length || 0})</TabsTrigger>
                  <TabsTrigger value="personnel">Personnel ({tenantPreviewData.personnel?.length || 0})</TabsTrigger>
                  <TabsTrigger value="stations">Stations ({tenantPreviewData.stations?.length || 0})</TabsTrigger>
                  <TabsTrigger value="staffing">Staffing</TabsTrigger>
                  <TabsTrigger value="overtime">Overtime</TabsTrigger>
                </TabsList>
                
                <TabsContent value="users" className="mt-4">
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Payroll #</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tenantPreviewData.users?.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.name}</TableCell>
                            <TableCell>{user.payroll_number}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{user.role}</Badge>
                            </TableCell>
                            <TableCell>
                              {user.is_active ? (
                                <Badge className="bg-green-500">Active</Badge>
                              ) : (
                                <Badge variant="destructive">Inactive</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="personnel" className="mt-4">
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Rank</TableHead>
                          <TableHead>Station</TableHead>
                          <TableHead>Shift</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tenantPreviewData.personnel?.map((person) => (
                          <TableRow key={person.id}>
                            <TableCell className="font-medium">{person.name}</TableCell>
                            <TableCell>{person.rank}</TableCell>
                            <TableCell>{person.station_id}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{person.shift}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="stations" className="mt-4">
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Station #</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Battalion</TableHead>
                          <TableHead>Min Staffing</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tenantPreviewData.stations?.map((station) => (
                          <TableRow key={station.id}>
                            <TableCell className="font-medium">{station.station_number}</TableCell>
                            <TableCell>{station.name}</TableCell>
                            <TableCell>{station.battalion_id}</TableCell>
                            <TableCell>{station.minimum_staffing}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="staffing" className="mt-4">
                  <p className="text-sm text-muted-foreground mb-4">Recent staffing records (last 5)</p>
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Station</TableHead>
                          <TableHead>Personnel Assigned</TableHead>
                          <TableHead>Modified By</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tenantPreviewData.recent_staffing?.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell>{record.date}</TableCell>
                            <TableCell>{record.station_id}</TableCell>
                            <TableCell>{record.personnel_assigned?.length || 0}</TableCell>
                            <TableCell>{record.last_modified_by || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="overtime" className="mt-4">
                  <p className="text-sm text-muted-foreground mb-4">Recent overtime records (last 5)</p>
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Personnel</TableHead>
                          <TableHead>Hours</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tenantPreviewData.recent_overtime?.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell>{record.date}</TableCell>
                            <TableCell>{record.personnel_name}</TableCell>
                            <TableCell>{record.hours}</TableCell>
                            <TableCell>
                              <Badge variant={record.status === 'assigned' ? 'default' : 'secondary'}>
                                {record.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

        {/* Impersonation Dialog */}
        <Dialog open={showImpersonateDialog} onOpenChange={setShowImpersonateDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5" />
                Access Tenant
              </DialogTitle>
              <DialogDescription>
                Access {selectedTenant?.name} for support or testing
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <Building2 className="h-5 w-5 text-primary" />
                  <span className="font-medium">{selectedTenant?.name}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Subdomain: {selectedTenant?.subdomain}.app.com
                </p>
              </div>

              <div className="space-y-4">
                <Label>Access Mode</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div 
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      impersonationMode === 'view' 
                        ? 'border-primary bg-primary/5' 
                        : 'hover:border-muted-foreground'
                    }`}
                    onClick={() => setImpersonationMode('view')}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Eye className="h-4 w-4" />
                      <span className="font-medium">View Only</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Read-only access to view data without making changes
                    </p>
                  </div>
                  <div 
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      impersonationMode === 'full' 
                        ? 'border-primary bg-primary/5' 
                        : 'hover:border-muted-foreground'
                    }`}
                    onClick={() => setImpersonationMode('full')}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <UserCog className="h-4 w-4" />
                      <span className="font-medium">Full Access</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Full admin access for testing and troubleshooting
                    </p>
                  </div>
                </div>
              </div>

              {impersonationMode === 'full' && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-yellow-600">Full access mode</p>
                      <p className="text-muted-foreground">
                        Changes you make will affect the tenant&apos;s live data. Use with caution.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setShowImpersonateDialog(false)}
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1"
                  onClick={handleImpersonate}
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  {impersonationMode === 'view' ? 'View Tenant' : 'Access Tenant'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default SuperAdminDashboard;
