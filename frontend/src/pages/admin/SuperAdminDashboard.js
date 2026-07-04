import { useState, useEffect } from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
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
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';

const SuperAdminDashboard = () => {
  const { api } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [tenantStats, setTenantStats] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    subdomain: '',
    admin_email: '',
    admin_name: 'Admin User',
    admin_payroll: '100001'
  });

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

  const handleCreateTenant = async () => {
    if (!formData.name || !formData.subdomain) {
      toast.error('Name and subdomain are required');
      return;
    }

    try {
      await api.post('/tenants', formData);
      toast.success('Tenant created successfully');
      setShowAddDialog(false);
      setFormData({ name: '', subdomain: '', admin_email: '', admin_name: 'Admin User', admin_payroll: '100001' });
      fetchTenants();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create tenant');
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Super Admin Dashboard</h1>
              <p className="text-muted-foreground">Manage all tenants across the platform</p>
            </div>
          </div>
          <Button onClick={() => setShowAddDialog(true)} data-testid="add-tenant-btn">
            <Plus className="h-4 w-4 mr-2" /> New Tenant
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Building2 className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{tenants.length}</p>
                  <p className="text-sm text-muted-foreground">Total Tenants</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Power className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{tenants.filter(t => t.is_active).length}</p>
                  <p className="text-sm text-muted-foreground">Active Tenants</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Users className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{tenants.reduce((acc, t) => acc + (t.user_count || 0), 0)}</p>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Building className="h-8 w-8 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{tenants.reduce((acc, t) => acc + (t.station_count || 0), 0)}</p>
                  <p className="text-sm text-muted-foreground">Total Stations</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tenants Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Tenants</CardTitle>
            <CardDescription>Manage fire departments using the platform</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : tenants.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No tenants yet. Create your first tenant to get started.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Subdomain</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Stations</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{tenant.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Globe className="h-3 w-3" />
                          <span>{tenant.subdomain}.app.com</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(tenant.status, tenant.is_active)}
                      </TableCell>
                      <TableCell>{tenant.user_count || 0}</TableCell>
                      <TableCell>{tenant.station_count || 0}</TableCell>
                      <TableCell className="text-muted-foreground">
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
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleTenant(tenant)}
                            className={tenant.is_active ? 'text-destructive hover:text-destructive' : 'text-green-600 hover:text-green-600'}
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

        {/* Add Tenant Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Tenant</DialogTitle>
              <DialogDescription>
                Set up a new fire department on the platform
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Organization Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g., Lakewood Fire Department"
                  data-testid="tenant-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Subdomain *</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={formData.subdomain}
                    onChange={(e) => setFormData({...formData, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')})}
                    placeholder="lakewood"
                    data-testid="tenant-subdomain-input"
                  />
                  <span className="text-muted-foreground whitespace-nowrap">.app.com</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Admin Email</Label>
                <Input
                  type="email"
                  value={formData.admin_email}
                  onChange={(e) => setFormData({...formData, admin_email: e.target.value})}
                  placeholder="admin@department.gov"
                />
              </div>
              <div className="space-y-2">
                <Label>Admin Name</Label>
                <Input
                  value={formData.admin_name}
                  onChange={(e) => setFormData({...formData, admin_name: e.target.value})}
                  placeholder="Admin User"
                />
              </div>
              <div className="space-y-2">
                <Label>Admin Payroll Number</Label>
                <Input
                  value={formData.admin_payroll}
                  onChange={(e) => setFormData({...formData, admin_payroll: e.target.value})}
                  placeholder="100001"
                />
              </div>
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm">
                <p className="font-medium text-blue-600 dark:text-blue-400">Note:</p>
                <p className="text-muted-foreground">
                  An admin user will be created with default password: <code className="bg-muted px-1 rounded">changeme123</code>
                </p>
              </div>
              <Button onClick={handleCreateTenant} className="w-full" data-testid="create-tenant-btn">
                <Building2 className="h-4 w-4 mr-2" /> Create Tenant
              </Button>
            </div>
          </DialogContent>
        </Dialog>

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
      </main>
    </div>
  );
};

export default SuperAdminDashboard;
