import { useEffect, useState, useCallback, memo } from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useAuth } from '../../context/AuthContext';
import { useStaffing } from '../../context/StaffingContext';
import { BattalionSelector } from '../../components/dashboard/BattalionSelector';
import { toast } from 'sonner';
import { Plus, Save, Edit2, Trash2, Search, X, Key, UserCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';

const RANKS = [
  'Fire Chief', 
  'Asst. Chief', 
  'Deputy Chief', 
  'Battalion Chief', 
  'Captain', 
  'Lieutenant', 
  'Driver Operator', 
  'Paramedic',
  'Firefighter',
  'Volunteer Firefighter'
];

const COMMON_CERTIFICATIONS = [
  'EMT-B', 'EMT-P', 'AEMT', 'Firefighter I', 'Firefighter II', 
  'Fire Officer I', 'Fire Officer II', 'Hazmat Ops', 'Hazmat Tech',
  'Rescue Tech', 'Swift Water', 'Rope Rescue', 'Confined Space',
  'TCFP Structure', 'TCFP Wildland', 'ACLS', 'PALS', 'PHTLS'
];

// Separate form component to prevent re-renders
const PersonnelFormDialog = memo(({ 
  isOpen, 
  onClose, 
  onSave, 
  initialData, 
  stations, 
  isEdit, 
  loading 
}) => {
  const [payrollNumber, setPayrollNumber] = useState('');
  const [name, setName] = useState('');
  const [rank, setRank] = useState('Firefighter');
  const [stationId, setStationId] = useState('');
  const [shift, setShift] = useState('A');
  const [contactPhone, setContactPhone] = useState('');
  const [certifications, setCertifications] = useState([]);
  const [certInput, setCertInput] = useState('');

  // Reset form when dialog opens with new data
  useEffect(() => {
    if (isOpen && initialData) {
      setPayrollNumber(initialData.payroll_number || '');
      setName(initialData.name || '');
      setRank(initialData.rank || 'Firefighter');
      setStationId(initialData.station_id || '');
      setShift(initialData.shift || 'A');
      setContactPhone(initialData.contact_phone || '');
      setCertifications(initialData.certifications || []);
    } else if (isOpen && !initialData) {
      // Reset for add mode
      setPayrollNumber('');
      setName('');
      setRank('Firefighter');
      setStationId('');
      setShift('A');
      setContactPhone('');
      setCertifications([]);
    }
    setCertInput('');
  }, [isOpen, initialData]);

  const addCertification = (cert) => {
    if (cert && !certifications.includes(cert)) {
      setCertifications([...certifications, cert]);
    }
    setCertInput('');
  };

  const removeCertification = (cert) => {
    setCertifications(certifications.filter(c => c !== cert));
  };

  const handleSave = () => {
    onSave({
      payroll_number: payrollNumber,
      name,
      rank,
      station_id: stationId,
      shift,
      contact_phone: contactPhone,
      certifications
    });
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading uppercase">
            {isEdit ? 'Edit Personnel' : 'Add New Personnel'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Employee Number *</Label>
            <Input
              value={payrollNumber}
              onChange={(e) => setPayrollNumber(e.target.value)}
              placeholder="Enter employee number"
              data-testid="payroll-input"
            />
          </div>

          <div className="space-y-2">
            <Label>Full Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter full name"
              data-testid="name-input"
            />
          </div>

          <div className="space-y-2">
            <Label>Rank *</Label>
            <Select value={rank} onValueChange={setRank}>
              <SelectTrigger data-testid="rank-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANKS.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Station *</Label>
              <Select value={stationId || "none"} onValueChange={(v) => setStationId(v === "none" ? "" : v)}>
                <SelectTrigger data-testid="station-select">
                  <SelectValue placeholder="Select Station" />
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
              <Label>Shift *</Label>
              <Select value={shift} onValueChange={setShift}>
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

          <div className="space-y-2">
            <Label>Phone Number</Label>
            <Input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="(555) 555-5555"
              data-testid="phone-input"
            />
          </div>

          <div className="space-y-2">
            <Label>Certifications</Label>
            <div className="flex gap-2">
              <Select 
                value="" 
                onValueChange={(v) => { if (v) addCertification(v); }}
              >
                <SelectTrigger className="flex-1" data-testid="cert-select">
                  <SelectValue placeholder="Select certification" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_CERTIFICATIONS.filter(c => !certifications.includes(c)).map(cert => (
                    <SelectItem key={cert} value={cert}>{cert}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={certInput}
                onChange={(e) => setCertInput(e.target.value)}
                placeholder="Or type custom"
                className="w-32"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCertification(certInput);
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={() => addCertification(certInput)}>
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {certifications.map((cert, idx) => (
                <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                  {cert}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-red-500" 
                    onClick={() => removeCertification(cert)}
                  />
                </Badge>
              ))}
            </div>
          </div>

          <Button 
            onClick={handleSave} 
            disabled={loading} 
            className="w-full" 
            data-testid={isEdit ? "update-personnel-btn" : "save-personnel-btn"}
          >
            <Save className="h-4 w-4 mr-2" /> {isEdit ? 'Update' : 'Save'} Personnel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
});

PersonnelFormDialog.displayName = 'PersonnelFormDialog';

export const PersonnelManagementPage = () => {
  const { api } = useAuth();
  const { personnel, stations, fetchPersonnel, selectedBattalion, fetchAllData } = useStaffing();
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [passwordPerson, setPasswordPerson] = useState(null);
  const [tempPassword, setTempPassword] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterShift, setFilterShift] = useState('all');
  const [filterStation, setFilterStation] = useState('all');

  useEffect(() => {
    fetchAllData();
  }, [selectedBattalion]);

  const handleAddPersonnel = useCallback(async (formData) => {
    if (!formData.payroll_number || !formData.name || !formData.station_id) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    try {
      await api.post('/personnel', {
        ...formData,
        battalion_id: selectedBattalion
      });
      toast.success('Personnel added');
      setShowAddDialog(false);
      fetchPersonnel();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add personnel');
    } finally {
      setLoading(false);
    }
  }, [api, selectedBattalion, fetchPersonnel]);

  const handleEditPersonnel = useCallback(async (formData) => {
    if (!editingPerson) return;
    
    setLoading(true);
    try {
      await api.put(`/personnel/${editingPerson.id}`, {
        payroll_number: formData.payroll_number,
        name: formData.name,
        rank: formData.rank,
        station_id: formData.station_id,
        shift: formData.shift,
        certifications: formData.certifications,
        contact_phone: formData.contact_phone
      });
      toast.success('Personnel updated');
      setShowEditDialog(false);
      setEditingPerson(null);
      fetchPersonnel();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update personnel');
    } finally {
      setLoading(false);
    }
  }, [api, editingPerson, fetchPersonnel]);

  const openEditDialog = useCallback((person) => {
    setEditingPerson(person);
    setShowEditDialog(true);
  }, []);

  const handleDeletePersonnel = useCallback(async (personnelId) => {
    if (!confirm('Are you sure you want to deactivate this personnel?')) return;
    
    try {
      await api.delete(`/personnel/${personnelId}`);
      toast.success('Personnel deactivated');
      fetchPersonnel();
    } catch (error) {
      toast.error('Failed to deactivate personnel');
    }
  }, [api, fetchPersonnel]);

  const openPasswordDialog = useCallback((person) => {
    setPasswordPerson(person);
    setTempPassword('');
    setShowPasswordDialog(true);
  }, []);

  const handleSetPassword = useCallback(async () => {
    if (!passwordPerson || !tempPassword) {
      toast.error('Please enter a temporary password');
      return;
    }
    
    if (tempPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.post('/auth/set-temporary-password', {
        personnel_id: passwordPerson.id,
        temporary_password: tempPassword
      });
      toast.success(response.data.message);
      setShowPasswordDialog(false);
      setPasswordPerson(null);
      setTempPassword('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to set password');
    } finally {
      setLoading(false);
    }
  }, [api, passwordPerson, tempPassword]);

  const filteredPersonnel = personnel.filter(person => {
    const matchesSearch = person.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         person.payroll_number.includes(searchTerm);
    const matchesShift = filterShift === 'all' || person.shift === filterShift;
    const matchesStation = filterStation === 'all' || person.station_id === filterStation;
    return matchesSearch && matchesShift && matchesStation;
  });

  // Group personnel by station and shift
  const groupedPersonnel = filteredPersonnel.reduce((acc, person) => {
    const stationId = person.station_id || 'unassigned';
    const shift = person.shift || 'Unknown';
    
    if (!acc[stationId]) {
      acc[stationId] = { A: [], B: [], C: [] };
    }
    if (!acc[stationId][shift]) {
      acc[stationId][shift] = [];
    }
    acc[stationId][shift].push(person);
    return acc;
  }, {});

  // Sort stations by station number
  const sortedStations = Object.keys(groupedPersonnel).sort((a, b) => {
    if (a === 'unassigned') return 1;
    if (b === 'unassigned') return -1;
    const stationA = stations.find(s => s.id === a);
    const stationB = stations.find(s => s.id === b);
    return (stationA?.station_number || 999) - (stationB?.station_number || 999);
  });

  const getStationName = (stationId) => {
    if (stationId === 'unassigned') return 'Unassigned';
    const station = stations.find(s => s.id === stationId);
    return station ? `Station ${station.station_number}` : stationId;
  };

  const getShiftBadge = (shift) => {
    const colors = {
      'A': 'bg-red-500',
      'B': 'bg-green-500',
      'C': 'bg-blue-500'
    };
    return <Badge className={colors[shift] || 'bg-gray-500'}>{shift} Shift</Badge>;
  };

  const getShiftBorderColor = (shift) => {
    const colors = {
      'A': 'border-l-red-500',
      'B': 'border-l-green-500',
      'C': 'border-l-blue-500'
    };
    return colors[shift] || 'border-l-gray-500';
  };

  const getShiftBgColor = (shift) => {
    const colors = {
      'A': 'bg-red-500/5',
      'B': 'bg-green-500/5',
      'C': 'bg-blue-500/5'
    };
    return colors[shift] || 'bg-gray-500/5';
  };

  return (
    <div className="min-h-screen bg-background" data-testid="personnel-management-page">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-3xl uppercase tracking-wider font-bold">
              Personnel Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage fire department personnel
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <BattalionSelector />
            <Button onClick={() => setShowAddDialog(true)} data-testid="add-personnel-btn">
              <Plus className="h-4 w-4 mr-2" /> Add Personnel
            </Button>
          </div>
        </div>

        {/* Add Dialog */}
        <PersonnelFormDialog
          isOpen={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          onSave={handleAddPersonnel}
          initialData={null}
          stations={stations}
          isEdit={false}
          loading={loading}
        />

        {/* Edit Dialog */}
        <PersonnelFormDialog
          isOpen={showEditDialog}
          onClose={() => { setShowEditDialog(false); setEditingPerson(null); }}
          onSave={handleEditPersonnel}
          initialData={editingPerson}
          stations={stations}
          isEdit={true}
          loading={loading}
        />

        {/* Set Password Dialog */}
        <Dialog open={showPasswordDialog} onOpenChange={(open) => { setShowPasswordDialog(open); if (!open) { setPasswordPerson(null); setTempPassword(''); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-heading uppercase">
                <Key className="h-5 w-5" />
                Set Temporary Password
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {passwordPerson && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium">{passwordPerson.rank} {passwordPerson.name}</p>
                  <p className="text-sm text-muted-foreground">Employee #: {passwordPerson.payroll_number}</p>
                </div>
              )}
              
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <UserCheck className="h-5 w-5 text-yellow-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-500">First Login Requirement</p>
                    <p className="text-muted-foreground">
                      The user will be prompted to change this password on their first login.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Temporary Password *</Label>
                <Input
                  type="text"
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  placeholder="Enter temporary password (min 6 chars)"
                  data-testid="temp-password-input"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum 6 characters. Share this password with the personnel member securely.
                </p>
              </div>

              <Button 
                onClick={handleSetPassword} 
                disabled={loading || !tempPassword} 
                className="w-full"
                data-testid="set-password-btn"
              >
                <Key className="h-4 w-4 mr-2" />
                {loading ? 'Setting...' : 'Set Password & Create Account'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

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
              <Select value={filterShift} onValueChange={setFilterShift}>
                <SelectTrigger className="w-32" data-testid="filter-shift">
                  <SelectValue placeholder="Shift" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Shifts</SelectItem>
                  <SelectItem value="A">A Shift</SelectItem>
                  <SelectItem value="B">B Shift</SelectItem>
                  <SelectItem value="C">C Shift</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStation} onValueChange={setFilterStation}>
                <SelectTrigger className="w-40" data-testid="filter-station">
                  <SelectValue placeholder="Station" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stations</SelectItem>
                  {stations.map(station => (
                    <SelectItem key={station.id} value={station.id}>
                      Station {station.station_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Personnel Grouped by Station and Shift */}
        <div className="space-y-6" data-testid="personnel-grouped">
          {sortedStations.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No personnel found
              </CardContent>
            </Card>
          ) : (
            sortedStations.map(stationId => (
              <Card key={stationId} data-testid={`station-card-${stationId}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="font-heading uppercase flex items-center justify-between">
                    <span>{getStationName(stationId)}</span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {Object.values(groupedPersonnel[stationId]).flat().length} personnel
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {['A', 'B', 'C'].map(shift => {
                    const shiftPersonnel = groupedPersonnel[stationId][shift] || [];
                    if (shiftPersonnel.length === 0 && filterShift !== 'all') return null;
                    if (shiftPersonnel.length === 0) return null;
                    
                    return (
                      <div 
                        key={shift} 
                        className={`border-l-4 ${getShiftBorderColor(shift)} ${getShiftBgColor(shift)} rounded-r-lg`}
                        data-testid={`shift-group-${stationId}-${shift}`}
                      >
                        <div className="p-3">
                          <div className="flex items-center gap-2 mb-3">
                            {getShiftBadge(shift)}
                            <span className="text-sm text-muted-foreground">
                              ({shiftPersonnel.length} personnel)
                            </span>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-24">Emp #</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Rank</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Certifications</TableHead>
                                <TableHead className="w-24">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {shiftPersonnel.map(person => (
                                <TableRow key={person.id} data-testid={`personnel-row-${person.id}`}>
                                  <TableCell className="font-mono text-sm">{person.payroll_number}</TableCell>
                                  <TableCell className="font-medium">{person.name}</TableCell>
                                  <TableCell className="text-sm">{person.rank}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">{person.contact_phone || '-'}</TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                      {person.certifications?.slice(0, 3).map((cert, idx) => (
                                        <span key={idx} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                          {cert}
                                        </span>
                                      ))}
                                      {person.certifications?.length > 3 && (
                                        <span className="text-xs text-muted-foreground">
                                          +{person.certifications.length - 3}
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex gap-1">
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => openEditDialog(person)}
                                        title="Edit Personnel"
                                        data-testid={`edit-${person.id}`}
                                      >
                                        <Edit2 className="h-4 w-4" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => openPasswordDialog(person)}
                                        title="Set Password"
                                        className="text-blue-500"
                                        data-testid={`password-${person.id}`}
                                      >
                                        <Key className="h-4 w-4" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="text-red-500"
                                        onClick={() => handleDeletePersonnel(person.id)}
                                        title="Deactivate"
                                        data-testid={`delete-${person.id}`}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
};
