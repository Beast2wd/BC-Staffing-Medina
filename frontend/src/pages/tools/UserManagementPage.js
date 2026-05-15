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
import { Plus, Save, Edit2, Trash2, Search, Key, Phone, Mail } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';

export const UserManagementPage = () => {
  const { api } = useAuth();
  const { stations, fetchAllData } = useStaffing();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [forcePasswordChange, setForcePasswordChange] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [formData, setFormData] = useState({
    payroll_number: '',
    password: '',
    name: '',
    rank: 'Firefighter',
    role: 'firefighter',
    station_id: '',
    shift: 'A',
    email: '',
    phone_number: ''
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    rank: '',
    role: '',
    station_id: '',
    shift: '',
    is_active: true,
    email: '',
    phone_number: ''
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
      setFormData({ payroll_number: '', password: '', name: '', rank: 'Firefighter', role: 'firefighter', station_id: '', shift: 'A', email: '', phone_number: '' });
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

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setEditFormData({
      name: user.name,
      rank: user.rank || 'Firefighter',
      role: user.role,
      station_id: user.station_id || '',
      shift: user.shift || 'A',
      is_active: user.is_active,
      email: user.email || '',
      phone_number: user.phone_number || ''
    });
    setShowEditDialog(true);
  };

  const handleEditUser = async () => {
    if (!editingUser) return;
    
    setLoading(true);
    try {
      await api.put(`/users/${editingUser.id}`, editFormData);
      toast.success('User updated');
      setShowEditDialog(false);
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenResetPassword = (user) => {
    setResetPasswordUser(user);
    setNewPassword('');
    setForcePasswordChange(false);
    setShowResetPasswordDialog(true);
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUser || !newPassword) {
      toast.error('Please enter a new password');
      return;
    }
    
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    try {
      await api.post(`/users/${resetPasswordUser.id}/reset-password`, {
        new_password: newPassword,
        force_change: forcePasswordChange
      });
      toast.success('Password reset successfully');
      setShowResetPasswordDialog(false);
      setResetPasswordUser(null);
      setNewPassword('');
      setForcePasswordChange(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reset password');
    } finally {
      setLoading(false);
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
                  <Label>Employee Number *</Label>
                  <Input
                    value={formData.payroll_number}
                    onChange={(e) => setFormData({...formData, payroll_number: e.target.value})}
                    placeholder="Enter employee number"
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
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      placeholder="email@example.com"
                      data-testid="email-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input
                      value={formData.phone_number}
                      onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                      placeholder="(555) 123-4567"
                      data-testid="phone-input"
                    />
                  </div>
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
                      value={formData.station_id || "none"} 
                      onValueChange={(v) => setFormData({...formData, station_id: v === "none" ? "" : v})}
                    >
                      <SelectTrigger data-testid="station-select">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
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
                    placeholder="Search by name or employee #..."
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
                  <TableHead>Emp #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
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
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map(user => (
                    <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                      <TableCell className="font-mono">{user.payroll_number}</TableCell>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm">
                          {user.phone_number && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="h-3 w-3" /> {user.phone_number}
                            </span>
                          )}
                          {user.email && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Mail className="h-3 w-3" /> {user.email}
                            </span>
                          )}
                          {!user.phone_number && !user.email && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
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
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleOpenEdit(user)}
                            title="Edit User"
                            data-testid={`edit-${user.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-blue-500"
                            onClick={() => handleOpenResetPassword(user)}
                            title="Reset Password"
                            data-testid={`reset-password-${user.id}`}
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-500"
                            onClick={() => handleDeleteUser(user.id)}
                            title="Deactivate User"
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

        {/* Edit User Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading uppercase">Edit User</DialogTitle>
            </DialogHeader>
            {editingUser && (
              <div className="space-y-4 py-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">Employee #: {editingUser.payroll_number}</p>
                </div>

                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                    placeholder="Enter full name"
                    data-testid="edit-name-input"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={editFormData.email}
                      onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                      placeholder="email@example.com"
                      data-testid="edit-email-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input
                      value={editFormData.phone_number}
                      onChange={(e) => setEditFormData({...editFormData, phone_number: e.target.value})}
                      placeholder="(555) 123-4567"
                      data-testid="edit-phone-input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Rank</Label>
                    <Select 
                      value={editFormData.rank} 
                      onValueChange={(v) => setEditFormData({...editFormData, rank: v})}
                    >
                      <SelectTrigger data-testid="edit-rank-select">
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
                    <Label>Role</Label>
                    <Select 
                      value={editFormData.role} 
                      onValueChange={(v) => setEditFormData({...editFormData, role: v})}
                    >
                      <SelectTrigger data-testid="edit-role-select">
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
                      value={editFormData.station_id || "none"} 
                      onValueChange={(v) => setEditFormData({...editFormData, station_id: v === "none" ? "" : v})}
                    >
                      <SelectTrigger data-testid="edit-station-select">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
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
                      value={editFormData.shift} 
                      onValueChange={(v) => setEditFormData({...editFormData, shift: v})}
                    >
                      <SelectTrigger data-testid="edit-shift-select">
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

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select 
                    value={editFormData.is_active ? "active" : "inactive"} 
                    onValueChange={(v) => setEditFormData({...editFormData, is_active: v === "active"})}
                  >
                    <SelectTrigger data-testid="edit-status-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={handleEditUser} disabled={loading} className="w-full" data-testid="save-edit-btn">
                  <Save className="h-4 w-4 mr-2" /> Save Changes
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Reset Password Dialog */}
        <Dialog open={showResetPasswordDialog} onOpenChange={setShowResetPasswordDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading uppercase">Reset Password</DialogTitle>
            </DialogHeader>
            {resetPasswordUser && (
              <div className="space-y-4 py-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">{resetPasswordUser.name}</p>
                  <p className="text-xs text-muted-foreground">Employee #: {resetPasswordUser.payroll_number}</p>
                </div>

                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-sm text-yellow-500">
                    <strong>Note:</strong> This will reset the user's password. They will need to use the new password to log in.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>New Password</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 6 characters)"
                    data-testid="new-password-input"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="force-change"
                    checked={forcePasswordChange}
                    onCheckedChange={setForcePasswordChange}
                    data-testid="force-change-checkbox"
                  />
                  <Label htmlFor="force-change" className="text-sm cursor-pointer">
                    Force password change on first login
                  </Label>
                </div>

                <Button onClick={handleResetPassword} disabled={loading} className="w-full" data-testid="reset-password-btn">
                  <Key className="h-4 w-4 mr-2" /> Reset Password
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};
