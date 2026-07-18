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
import { Plus, Save, Edit2, Trash2, Search, Key, Phone, Mail, Eye, EyeOff, UserX, AlertTriangle } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [formData, setFormData] = useState({
    payroll_number: '',
    password: '',
    first_name: '',
    last_name: '',
    rank: 'Firefighter',
    role: 'firefighter',
    station_id: '',
    shift: 'A',
    email: '',
    phone_number: ''
  });
  const [editFormData, setEditFormData] = useState({
    first_name: '',
    last_name: '',
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

  const ranks = ['Fire Chief', 'Asst. Chief', 'Deputy Chief', 'Battalion Chief', 'Captain', 'Lieutenant', 'Firefighter', 'Engineer', 'Paramedic'];
  
  // Define rank order for sorting (lower number = higher rank)
  // Includes common aliases to ensure consistent sorting
  const rankOrder = {
    'Fire Chief': 1,
    'Chief': 1,
    'Asst. Chief': 2,
    'Assistant Chief': 2,
    'Deputy Chief': 3,
    'Battalion Chief': 4,
    'Captain': 5,
    'Lieutenant': 6,
    'Engineer': 7,
    'Driver Operator': 7,
    'Paramedic': 8,
    'Firefighter': 9,
    'Firefighter/Paramedic': 9,
    'Part-Time Firefighter': 10,
    'Part-Time Paramedic': 10,
    'Volunteer Firefighter': 11,
    'Volunteer': 11,
    'Admin': 12
  };

  // Helper to extract last name from full name
  const getLastName = (fullName) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    return parts.length > 1 ? parts[parts.length - 1] : parts[0];
  };

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
    if (!formData.payroll_number || !formData.password || !formData.first_name || !formData.last_name) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    try {
      // Combine first and last name for storage (Last Name, First Name format for sorting)
      const fullName = `${formData.first_name} ${formData.last_name}`;
      
      // Use the new /users endpoint which also creates a personnel record
      await api.post('/users', {
        payroll_number: formData.payroll_number,
        password: formData.password,
        name: fullName,
        rank: formData.rank,
        role: formData.role,
        station_id: formData.station_id,
        shift: formData.shift,
        email: formData.email,
        phone_number: formData.phone_number,
        must_change_password: true  // Force password change on first login
      });
      toast.success('User created successfully. They will be prompted to change password on first login.');
      setShowAddDialog(false);
      setShowPassword(false);
      fetchUsers();
      setFormData({ payroll_number: '', password: '', first_name: '', last_name: '', rank: 'Firefighter', role: 'firefighter', station_id: '', shift: 'A', email: '', phone_number: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivateUser = async (userId) => {
    if (!confirm('Are you sure you want to deactivate this user? They will no longer be able to log in, but their data will be preserved.')) return;
    
    try {
      await api.delete(`/users/${userId}`);
      toast.success('User deactivated');
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to deactivate user');
    }
  };

  const handlePermanentDeleteUser = async (userId, userName) => {
    // Double confirmation for permanent delete
    const firstConfirm = confirm(`⚠️ WARNING: You are about to PERMANENTLY DELETE "${userName}".\n\nThis action CANNOT be undone. All user data will be removed from the system.\n\nAre you sure you want to continue?`);
    if (!firstConfirm) return;
    
    const secondConfirm = confirm(`Final confirmation: Type "DELETE" mentally and click OK to permanently remove "${userName}" from the system.`);
    if (!secondConfirm) return;
    
    try {
      await api.delete(`/users/${userId}/permanent`);
      toast.success('User permanently deleted');
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete user');
    }
  };

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    // Parse full name into first and last name
    const nameParts = (user.name || '').trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    setEditFormData({
      first_name: firstName,
      last_name: lastName,
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
      // Combine first and last name
      const fullName = `${editFormData.first_name} ${editFormData.last_name}`.trim();
      
      await api.put(`/users/${editingUser.id}`, {
        name: fullName,
        rank: editFormData.rank,
        role: editFormData.role,
        station_id: editFormData.station_id,
        shift: editFormData.shift,
        is_active: editFormData.is_active,
        email: editFormData.email,
        phone_number: editFormData.phone_number
      });
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

  const filteredUsers = users
    .filter(user => {
      const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           user.payroll_number.includes(searchTerm);
      const matchesRole = filterRole === 'all' || user.role === filterRole;
      return matchesSearch && matchesRole;
    })
    .sort((a, b) => {
      // First sort by rank
      const rankA = rankOrder[a.rank] || 999;
      const rankB = rankOrder[b.rank] || 999;
      if (rankA !== rankB) return rankA - rankB;
      
      // Then sort alphabetically by last name
      const lastNameA = getLastName(a.name).toLowerCase();
      const lastNameB = getLastName(b.name).toLowerCase();
      return lastNameA.localeCompare(lastNameB);
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
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      placeholder="Enter password"
                      className="pr-10"
                      data-testid="password-input"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      data-testid="toggle-password-visibility"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name *</Label>
                    <Input
                      value={formData.first_name}
                      onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                      placeholder="First name"
                      data-testid="first-name-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name *</Label>
                    <Input
                      value={formData.last_name}
                      onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                      placeholder="Last name"
                      data-testid="last-name-input"
                    />
                  </div>
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

                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm">
                  <p className="font-medium text-green-600 dark:text-green-400">Note:</p>
                  <p className="text-muted-foreground">
                    A personnel record will be automatically created if station is assigned.
                  </p>
                  <p className="text-muted-foreground">User will be prompted to change password on first login.</p>
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
                          {user.is_active ? (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-yellow-600"
                              onClick={() => handleDeactivateUser(user.id)}
                              title="Deactivate User"
                              data-testid={`deactivate-${user.id}`}
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                          ) : null}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-500"
                            onClick={() => handlePermanentDeleteUser(user.id, user.name)}
                            title="Permanently Delete User"
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input
                      value={editFormData.first_name}
                      onChange={(e) => setEditFormData({...editFormData, first_name: e.target.value})}
                      placeholder="First name"
                      data-testid="edit-first-name-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input
                      value={editFormData.last_name}
                      onChange={(e) => setEditFormData({...editFormData, last_name: e.target.value})}
                      placeholder="Last name"
                      data-testid="edit-last-name-input"
                    />
                  </div>
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
                    <strong>Note:</strong> This will reset the user&apos;s password. They will need to use the new password to log in.
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
