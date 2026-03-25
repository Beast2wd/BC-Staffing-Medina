import { useEffect, useState } from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useAuth } from '../../context/AuthContext';
import { useStaffing } from '../../context/StaffingContext';
import { toast } from 'sonner';
import { Plus, Save, Edit2, Trash2, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';

export const UserManagementPage = () => {
  const { api } = useAuth();
  const { stations, fetchAllData } = useStaffing();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [formData, setFormData] = useState({
    payroll_number: '',
    password: '',
    name: '',
    rank: 'Firefighter',
    role: 'firefighter',
    station_id: '',
    shift: 'A'
  });

  const roles = [
    { value: 'admin', label: 'Admin' },
    { value: 'battalion_chief', label: 'Battalion Chief' },
    { value: 'captain', label: 'Captain' },
    { value: 'lieutenant', label: 'Lieutenant' },
    { value: 'firefighter', label: 'Firefighter' }
  ];

  const ranks = ['Chief', 'Deputy Chief', 'Battalion Chief', 'Captain', 'Lieutenant', 'Firefighter', 'Engineer', 'Paramedic'];

  useEffect(() => {
    fetchAllData();
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleAddUser = async () => {
    if (!formData.payroll_number || !formData.password || !formData.name) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    try {
      await api.post('/auth/register', formData);
      toast.success('User created');
      setShowAddDialog(false);
      fetchUsers();
      setFormData({ payroll_number: '', password: '', name: '', rank: 'Firefighter', role: 'firefighter', station_id: '', shift: 'A' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to deactivate this user?')) return;
    
    try {
      await api.delete(`/users/${userId}`);
      toast.success('User deactivated');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to deactivate user');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.payroll_number.includes(searchTerm);
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const getStationName = (stationId) => {
    if (!stationId) return '-';
    const station = stations.find(s => s.id === stationId);
    return station ? `Station ${station.station_number}` : stationId;
  };

  const getRoleBadge = (role) => {
    const colors = {
      'admin': 'bg-purple-500',
      'battalion_chief': 'bg-red-500',
      'captain': 'bg-yellow-500',
      'lieutenant': 'bg-blue-500',
      'firefighter': 'bg-green-500'
    };
    return <Badge className={colors[role] || 'bg-gray-500'}>{role.replace('_', ' ')}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background" data-testid="user-management-page">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-3xl uppercase tracking-wider font-bold">
              User Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage system users and access levels
            </p>
          </div>
          
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button data-testid="add-user-btn">
                <Plus className="h-4 w-4 mr-2" /> Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="font-heading uppercase">Add New User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Payroll Number *</Label>
                  <Input
                    value={formData.payroll_number}
                    onChange={(e) => setFormData({...formData, payroll_number: e.target.value})}
                    placeholder="Enter payroll number"
                    data-testid="payroll-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Password *</Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    placeholder="Enter password"
                    data-testid="password-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Enter full name"
                    data-testid="name-input"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Rank</Label>
                    <Select 
                      value={formData.rank} 
                      onValueChange={(v) => setFormData({...formData, rank: v})}
                    >
                      <SelectTrigger data-testid="rank-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ranks.map(rank => (
                          <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Role *</Label>
                    <Select 
                      value={formData.role} 
                      onValueChange={(v) => setFormData({...formData, role: v})}
                    >
                      <SelectTrigger data-testid="role-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map(role => (
                          <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Station</Label>
                    <Select 
                      value={formData.station_id} 
                      onValueChange={(v) => setFormData({...formData, station_id: v})}
                    >
                      <SelectTrigger data-testid="station-select">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {stations.map(station => (
                          <SelectItem key={station.id} value={station.id}>
                            Station {station.station_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Shift</Label>
                    <Select 
                      value={formData.shift} 
                      onValueChange={(v) => setFormData({...formData, shift: v})}
                    >
                      <SelectTrigger data-testid="shift-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">A Shift</SelectItem>
                        <SelectItem value="B">B Shift</SelectItem>
                        <SelectItem value="C">C Shift</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button onClick={handleAddUser} disabled={loading} className="w-full" data-testid="save-user-btn">
                  <Save className="h-4 w-4 mr-2" /> Create User
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or payroll..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="search-input"
                  />
                </div>
              </div>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="w-40" data-testid="filter-role">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {roles.map(role => (
                    <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card data-testid="users-table-card">
          <CardHeader>
            <CardTitle className="font-heading uppercase">
              System Users ({filteredUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payroll #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Rank</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map(user => (
                    <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                      <TableCell className="font-mono">{user.payroll_number}</TableCell>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.rank}</TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>{getStationName(user.station_id)}</TableCell>
                      <TableCell>
                        {user.shift ? (
                          <span className={`px-2 py-1 rounded text-xs ${
                            user.shift === 'A' ? 'bg-red-500/20 text-red-500' :
                            user.shift === 'B' ? 'bg-green-500/20 text-green-500' :
                            'bg-blue-500/20 text-blue-500'
                          }`}>
                            {user.shift}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={user.is_active ? 'bg-green-500' : 'bg-red-500'}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" data-testid={`edit-${user.id}`}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-500"
                            onClick={() => handleDeleteUser(user.id)}
                            data-testid={`delete-${user.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
