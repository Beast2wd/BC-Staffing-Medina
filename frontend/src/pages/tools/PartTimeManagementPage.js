import { useEffect, useState } from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Search, X, Phone, Mail, UserCog } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';

const COMMON_CERTIFICATIONS = [
  'EMT-B', 'EMT-P', 'AEMT', 'Firefighter I', 'Firefighter II', 
  'Hazmat Ops', 'Hazmat Tech', 'Rescue Tech', 'Swift Water', 
  'Rope Rescue', 'Confined Space', 'CPR', 'First Aid', 'ACLS', 'PALS'
];

const PART_TIME_RANKS = [
  'Part-Time Firefighter',
  'Part-Time EMT',
  'Part-Time Paramedic',
  'Part-Time Engineer',
  'Part-Time Lieutenant'
];

export const PartTimeManagementPage = () => {
  const { api } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRank, setFilterRank] = useState('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  
  // Form states
  const [formData, setFormData] = useState({
    employee_number: '',
    name: '',
    rank: '',
    certifications: [],
    contact_phone: '',
    contact_email: '',
    notes: ''
  });
  const [certInput, setCertInput] = useState('');

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const response = await api.get('/part-time-employees');
      setEmployees(response.data);
    } catch (error) {
      console.error('Error fetching part-time employees:', error);
      toast.error('Failed to load part-time employees');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      employee_number: '',
      name: '',
      rank: '',
      certifications: [],
      contact_phone: '',
      contact_email: '',
      notes: ''
    });
    setCertInput('');
  };

  const handleAddEmployee = async () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!formData.employee_number.trim()) {
      toast.error('Employee number is required');
      return;
    }

    try {
      await api.post('/part-time-employees', formData);
      toast.success('Part-time employee added successfully');
      setShowAddDialog(false);
      resetForm();
      fetchEmployees();
    } catch (error) {
      if (error.response?.data?.detail) {
        toast.error(error.response.data.detail);
      } else {
        toast.error('Failed to add part-time employee');
      }
      console.error(error);
    }
  };

  const handleEditEmployee = async () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!formData.employee_number.trim()) {
      toast.error('Employee number is required');
      return;
    }

    try {
      await api.put(`/part-time-employees/${editingEmployee.id}`, formData);
      toast.success('Part-time employee updated successfully');
      setShowEditDialog(false);
      setEditingEmployee(null);
      resetForm();
      fetchEmployees();
    } catch (error) {
      if (error.response?.data?.detail) {
        toast.error(error.response.data.detail);
      } else {
        toast.error('Failed to update part-time employee');
      }
      console.error(error);
    }
  };

  const handleDeleteEmployee = async (id) => {
    if (!window.confirm('Are you sure you want to remove this part-time employee?')) return;
    
    try {
      await api.delete(`/part-time-employees/${id}`);
      toast.success('Part-time employee removed');
      fetchEmployees();
    } catch (error) {
      toast.error('Failed to remove part-time employee');
      console.error(error);
    }
  };

  const openEditDialog = (employee) => {
    setEditingEmployee(employee);
    setFormData({
      employee_number: employee.employee_number || '',
      name: employee.name || '',
      rank: employee.rank || '',
      certifications: employee.certifications || [],
      contact_phone: employee.contact_phone || '',
      contact_email: employee.contact_email || '',
      notes: employee.notes || ''
    });
    setShowEditDialog(true);
  };

  const addCertification = (cert) => {
    if (cert && !formData.certifications.includes(cert)) {
      setFormData(prev => ({
        ...prev,
        certifications: [...prev.certifications, cert]
      }));
    }
    setCertInput('');
  };

  const removeCertification = (cert) => {
    setFormData(prev => ({
      ...prev,
      certifications: prev.certifications.filter(c => c !== cert)
    }));
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.employee_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (emp.contact_phone || '').includes(searchTerm);
    const matchesRank = filterRank === 'all' || emp.rank === filterRank;
    return matchesSearch && matchesRank;
  });

  // Get unique ranks from employees for filter
  const uniqueRanks = [...new Set(employees.map(e => e.rank).filter(Boolean))];

  const EmployeeForm = ({ onSave, buttonText }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="employee_number">Employee Number *</Label>
          <Input
            id="employee_number"
            value={formData.employee_number}
            onChange={(e) => setFormData(prev => ({ ...prev, employee_number: e.target.value }))}
            placeholder="e.g., PT-001"
            data-testid="pt-employee-number-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Full Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Enter full name"
            data-testid="pt-name-input"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Rank</Label>
        <Select
          value={formData.rank || 'none'}
          onValueChange={(value) => setFormData(prev => ({ ...prev, rank: value === 'none' ? '' : value }))}
        >
          <SelectTrigger data-testid="pt-rank-select">
            <SelectValue placeholder="Select rank" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Rank</SelectItem>
            {PART_TIME_RANKS.map(rank => (
              <SelectItem key={rank} value={rank}>{rank}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            value={formData.contact_phone}
            onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
            placeholder="(555) 123-4567"
            data-testid="pt-phone-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.contact_email}
            onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
            placeholder="email@example.com"
            data-testid="pt-email-input"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Certifications</Label>
        <div className="flex gap-2">
          <Select value={certInput} onValueChange={addCertification}>
            <SelectTrigger className="flex-1" data-testid="pt-cert-select">
              <SelectValue placeholder="Add certification" />
            </SelectTrigger>
            <SelectContent>
              {COMMON_CERTIFICATIONS.filter(c => !formData.certifications.includes(c)).map(cert => (
                <SelectItem key={cert} value={cert}>{cert}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {formData.certifications.map(cert => (
            <Badge key={cert} variant="secondary" className="flex items-center gap-1">
              {cert}
              <X className="h-3 w-3 cursor-pointer" onClick={() => removeCertification(cert)} />
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Input
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="Additional notes..."
          data-testid="pt-notes-input"
        />
      </div>

      <Button onClick={onSave} className="w-full" data-testid="save-pt-employee-btn">
        {buttonText}
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-3xl uppercase tracking-wider font-bold flex items-center gap-3">
              <UserCog className="h-8 w-8 text-primary" />
              Part-Time Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage part-time employees - sorted alphabetically
            </p>
          </div>
          
          <Dialog open={showAddDialog} onOpenChange={(open) => {
            setShowAddDialog(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button data-testid="add-pt-employee-btn">
                <Plus className="h-4 w-4 mr-2" /> Add Part-Time Employee
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Part-Time Employee</DialogTitle>
              </DialogHeader>
              <EmployeeForm onSave={handleAddEmployee} buttonText="Add Employee" />
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, employee number, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="search-pt-employees"
                />
              </div>
              <Select value={filterRank} onValueChange={setFilterRank}>
                <SelectTrigger className="w-48" data-testid="filter-rank">
                  <SelectValue placeholder="Filter by rank" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ranks</SelectItem>
                  {uniqueRanks.map(rank => (
                    <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Employees List */}
        <Card data-testid="pt-employees-table-card">
          <CardHeader>
            <CardTitle className="font-heading uppercase">
              Part-Time Employees ({filteredEmployees.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Emp #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Rank</TableHead>
                  <TableHead>Certifications</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Loading part-time employees...
                    </TableCell>
                  </TableRow>
                ) : filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No part-time employees found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map(employee => (
                    <TableRow key={employee.id} data-testid={`pt-employee-row-${employee.id}`}>
                      <TableCell className="font-mono font-semibold text-primary">
                        {employee.employee_number}
                      </TableCell>
                      <TableCell className="font-medium">{employee.name}</TableCell>
                      <TableCell>
                        {employee.rank ? (
                          <Badge variant="outline">{employee.rank}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {employee.certifications?.slice(0, 3).map((cert, idx) => (
                            <span key={idx} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {cert}
                            </span>
                          ))}
                          {employee.certifications?.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{employee.certifications.length - 3}
                            </span>
                          )}
                          {(!employee.certifications || employee.certifications.length === 0) && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm">
                          {employee.contact_phone && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="h-3 w-3" /> {employee.contact_phone}
                            </span>
                          )}
                          {employee.contact_email && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Mail className="h-3 w-3" /> {employee.contact_email}
                            </span>
                          )}
                          {!employee.contact_phone && !employee.contact_email && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                        {employee.notes || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => openEditDialog(employee)}
                            title="Edit Employee"
                            data-testid={`edit-pt-employee-${employee.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-500"
                            onClick={() => handleDeleteEmployee(employee.id)}
                            title="Remove Employee"
                            data-testid={`delete-pt-employee-${employee.id}`}
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

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={(open) => {
          setShowEditDialog(open);
          if (!open) {
            setEditingEmployee(null);
            resetForm();
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Part-Time Employee</DialogTitle>
            </DialogHeader>
            <EmployeeForm onSave={handleEditEmployee} buttonText="Save Changes" />
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};
