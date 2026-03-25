import { useEffect, useState } from 'react';
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
import { Plus, Save, Edit2, Trash2, Search, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';

export const PersonnelManagementPage = () => {
  const { api } = useAuth();
  const { personnel, stations, fetchPersonnel, selectedBattalion, fetchAllData } = useStaffing();
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterShift, setFilterShift] = useState('all');
  const [filterStation, setFilterStation] = useState('all');
  const [certInput, setCertInput] = useState('');
  const [formData, setFormData] = useState({
    payroll_number: '',
    name: '',
    rank: 'Firefighter',
    station_id: '',
    shift: 'A',
    certifications: [],
    contact_phone: '',
    contact_email: ''
  });

  const ranks = [
    'Fire Chief', 
    'Asst. Chief', 
    'Deputy Chief', 
    'Battalion Chief', 
    'Captain', 
    'Lieutenant', 
    'Driver Operator', 
    'Paramedic',
    'Firefighter'
  ];

  const commonCertifications = [
    'EMT-B', 'EMT-P', 'AEMT', 'Firefighter I', 'Firefighter II', 
    'Fire Officer I', 'Fire Officer II', 'Hazmat Ops', 'Hazmat Tech',
    'Rescue Tech', 'Swift Water', 'Rope Rescue', 'Confined Space',
    'TCFP Structure', 'TCFP Wildland', 'ACLS', 'PALS', 'PHTLS'
  ];

  useEffect(() => {
    fetchAllData();
  }, [selectedBattalion]);

  const resetForm = () => {
    setFormData({
      payroll_number: '',
      name: '',
      rank: 'Firefighter',
      station_id: '',
      shift: 'A',
      certifications: [],
      contact_phone: '',
      contact_email: ''
    });
    setCertInput('');
    setEditingPerson(null);
  };

  const handleAddPersonnel = async () => {
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
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add personnel');
    } finally {
      setLoading(false);
    }
  };

  const handleEditPersonnel = async () => {
    if (!editingPerson) return;
    
    setLoading(true);
    try {
      await api.put(`/personnel/${editingPerson.id}`, {
        name: formData.name,
        rank: formData.rank,
        station_id: formData.station_id,
        shift: formData.shift,
        certifications: formData.certifications,
        contact_phone: formData.contact_phone,
        contact_email: formData.contact_email
      });
      toast.success('Personnel updated');
      setShowEditDialog(false);
      fetchPersonnel();
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update personnel');
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (person) => {
    setEditingPerson(person);
    setFormData({
      payroll_number: person.payroll_number,
      name: person.name,
      rank: person.rank,
      station_id: person.station_id,
      shift: person.shift,
      certifications: person.certifications || [],
      contact_phone: person.contact_phone || '',
      contact_email: person.contact_email || ''
    });
    setShowEditDialog(true);
  };

  const handleDeletePersonnel = async (personnelId) => {
    if (!confirm('Are you sure you want to deactivate this personnel?')) return;
    
    try {
      await api.delete(`/personnel/${personnelId}`);
      toast.success('Personnel deactivated');
      fetchPersonnel();
    } catch (error) {
      toast.error('Failed to deactivate personnel');
    }
  };

  const addCertification = (cert) => {
    if (cert && !formData.certifications.includes(cert)) {
      setFormData({...formData, certifications: [...formData.certifications, cert]});
    }
    setCertInput('');
  };

  const removeCertification = (cert) => {
    setFormData({...formData, certifications: formData.certifications.filter(c => c !== cert)});
  };

  const filteredPersonnel = personnel.filter(person => {
    const matchesSearch = person.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         person.payroll_number.includes(searchTerm);
    const matchesShift = filterShift === 'all' || person.shift === filterShift;
    const matchesStation = filterStation === 'all' || person.station_id === filterStation;
    return matchesSearch && matchesShift && matchesStation;
  });

  const getStationName = (stationId) => {
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

  const PersonnelForm = ({ isEdit = false }) => (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>Payroll Number *</Label>
        <Input
          value={formData.payroll_number}
          onChange={(e) => setFormData({...formData, payroll_number: e.target.value})}
          placeholder="Enter payroll number"
          disabled={isEdit}
          data-testid="payroll-input"
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

      <div className="space-y-2">
        <Label>Rank *</Label>
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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Station *</Label>
          <Select 
            value={formData.station_id || "none"} 
            onValueChange={(v) => setFormData({...formData, station_id: v === "none" ? "" : v})}
          >
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

      <div className="space-y-2">
        <Label>Phone Number</Label>
        <Input
          value={formData.contact_phone}
          onChange={(e) => setFormData({...formData, contact_phone: e.target.value})}
          placeholder="(555) 555-5555"
          data-testid="phone-input"
        />
      </div>

      <div className="space-y-2">
        <Label>Certifications</Label>
        <div className="flex gap-2">
          <Select value={certInput} onValueChange={(v) => { setCertInput(v); addCertification(v); }}>
            <SelectTrigger className="flex-1" data-testid="cert-select">
              <SelectValue placeholder="Select or type certification" />
            </SelectTrigger>
            <SelectContent>
              {commonCertifications.filter(c => !formData.certifications.includes(c)).map(cert => (
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
          {formData.certifications.map((cert, idx) => (
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
    </div>
  );

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
            <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button data-testid="add-personnel-btn">
                  <Plus className="h-4 w-4 mr-2" /> Add Personnel
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-heading uppercase">Add New Personnel</DialogTitle>
                </DialogHeader>
                <PersonnelForm isEdit={false} />
                <Button onClick={handleAddPersonnel} disabled={loading} className="w-full" data-testid="save-personnel-btn">
                  <Save className="h-4 w-4 mr-2" /> Save Personnel
                </Button>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={(open) => { setShowEditDialog(open); if (!open) resetForm(); }}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading uppercase">Edit Personnel</DialogTitle>
            </DialogHeader>
            <PersonnelForm isEdit={true} />
            <Button onClick={handleEditPersonnel} disabled={loading} className="w-full" data-testid="update-personnel-btn">
              <Save className="h-4 w-4 mr-2" /> Update Personnel
            </Button>
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
                    placeholder="Search by name or payroll..."
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

        {/* Personnel Table */}
        <Card data-testid="personnel-table-card">
          <CardHeader>
            <CardTitle className="font-heading uppercase">
              Personnel ({filteredPersonnel.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payroll #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Rank</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Certifications</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPersonnel.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No personnel found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPersonnel.map(person => (
                    <TableRow key={person.id} data-testid={`personnel-row-${person.id}`}>
                      <TableCell className="font-mono">{person.payroll_number}</TableCell>
                      <TableCell className="font-medium">{person.name}</TableCell>
                      <TableCell>{person.rank}</TableCell>
                      <TableCell>{getStationName(person.station_id)}</TableCell>
                      <TableCell>{getShiftBadge(person.shift)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {person.certifications?.map((cert, idx) => (
                            <span key={idx} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {cert}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => openEditDialog(person)}
                            data-testid={`edit-${person.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-500"
                            onClick={() => handleDeletePersonnel(person.id)}
                            data-testid={`delete-${person.id}`}
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
