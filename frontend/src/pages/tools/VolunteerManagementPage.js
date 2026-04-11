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
import { Plus, Edit2, Trash2, Search, X, Phone, Mail } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';

const COMMON_CERTIFICATIONS = [
  'EMT-B', 'EMT-P', 'AEMT', 'Firefighter I', 'Firefighter II', 
  'Hazmat Ops', 'Hazmat Tech', 'Rescue Tech', 'Swift Water', 
  'Rope Rescue', 'Confined Space', 'CPR', 'First Aid'
];

export const VolunteerManagementPage = () => {
  const { api } = useAuth();
  const { stations, fetchStations } = useStaffing();
  const [volunteers, setVolunteers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStation, setFilterStation] = useState('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingVolunteer, setEditingVolunteer] = useState(null);
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    contact_phone: '',
    contact_email: '',
    station_id: '',
    certifications: [],
    notes: ''
  });
  const [certInput, setCertInput] = useState('');

  useEffect(() => {
    fetchVolunteers();
    fetchStations();
  }, []);

  const fetchVolunteers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/volunteers');
      setVolunteers(response.data);
    } catch (error) {
      console.error('Error fetching volunteers:', error);
      toast.error('Failed to load volunteers');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      contact_phone: '',
      contact_email: '',
      station_id: '',
      certifications: [],
      notes: ''
    });
    setCertInput('');
  };

  const handleAddVolunteer = async () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    try {
      await api.post('/volunteers', formData);
      toast.success('Volunteer added successfully');
      setShowAddDialog(false);
      resetForm();
      fetchVolunteers();
    } catch (error) {
      toast.error('Failed to add volunteer');
      console.error(error);
    }
  };

  const handleEditVolunteer = async () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    try {
      await api.put(`/volunteers/${editingVolunteer.id}`, formData);
      toast.success('Volunteer updated successfully');
      setShowEditDialog(false);
      setEditingVolunteer(null);
      resetForm();
      fetchVolunteers();
    } catch (error) {
      toast.error('Failed to update volunteer');
      console.error(error);
    }
  };

  const handleDeleteVolunteer = async (id) => {
    if (!window.confirm('Are you sure you want to remove this volunteer?')) return;
    
    try {
      await api.delete(`/volunteers/${id}`);
      toast.success('Volunteer removed');
      fetchVolunteers();
    } catch (error) {
      toast.error('Failed to remove volunteer');
      console.error(error);
    }
  };

  const openEditDialog = (volunteer) => {
    setEditingVolunteer(volunteer);
    setFormData({
      name: volunteer.name || '',
      contact_phone: volunteer.contact_phone || '',
      contact_email: volunteer.contact_email || '',
      station_id: volunteer.station_id || '',
      certifications: volunteer.certifications || [],
      notes: volunteer.notes || ''
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

  const filteredVolunteers = volunteers.filter(vol => {
    const matchesSearch = vol.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (vol.contact_phone || '').includes(searchTerm);
    const matchesStation = filterStation === 'all' || vol.station_id === filterStation;
    return matchesSearch && matchesStation;
  });

  const getStationName = (stationId) => {
    if (!stationId) return 'Unassigned';
    const station = stations.find(s => s.id === stationId);
    return station ? `Station ${station.station_number}` : 'Unassigned';
  };

  const VolunteerForm = ({ onSave, buttonText }) => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Full Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Enter volunteer name"
          data-testid="volunteer-name-input"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            value={formData.contact_phone}
            onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
            placeholder="(555) 123-4567"
            data-testid="volunteer-phone-input"
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
            data-testid="volunteer-email-input"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Preferred Station</Label>
        <Select
          value={formData.station_id || 'none'}
          onValueChange={(value) => setFormData(prev => ({ ...prev, station_id: value === 'none' ? '' : value }))}
        >
          <SelectTrigger data-testid="volunteer-station-select">
            <SelectValue placeholder="Select station" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Preference</SelectItem>
            {stations.map(station => (
              <SelectItem key={station.id} value={station.id}>
                Station {station.station_number}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Certifications</Label>
        <div className="flex gap-2">
          <Select value={certInput} onValueChange={addCertification}>
            <SelectTrigger className="flex-1" data-testid="cert-select">
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
          data-testid="volunteer-notes-input"
        />
      </div>

      <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <p className="text-sm text-blue-400">
          <strong>Login Info:</strong> Volunteer will use their email to login with initial password: <code className="bg-blue-500/20 px-1 rounded">volunteer123</code>
        </p>
        <p className="text-xs text-blue-300/70 mt-1">
          They will be prompted to change it on first login.
        </p>
      </div>

      <Button onClick={onSave} className="w-full" data-testid="save-volunteer-btn">
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
            <h1 className="font-heading text-3xl uppercase tracking-wider font-bold">
              Volunteer Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage volunteer firefighters
            </p>
          </div>
          
          <Dialog open={showAddDialog} onOpenChange={(open) => {
            setShowAddDialog(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button data-testid="add-volunteer-btn">
                <Plus className="h-4 w-4 mr-2" /> Add Volunteer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Volunteer</DialogTitle>
              </DialogHeader>
              <VolunteerForm onSave={handleAddVolunteer} buttonText="Add Volunteer" />
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
                  placeholder="Search by name or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="search-volunteers"
                />
              </div>
              <Select value={filterStation} onValueChange={setFilterStation}>
                <SelectTrigger className="w-48" data-testid="filter-station">
                  <SelectValue placeholder="Filter by station" />
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

        {/* Volunteers List */}
        <Card data-testid="volunteers-table-card">
          <CardHeader>
            <CardTitle className="font-heading uppercase">
              Volunteers ({filteredVolunteers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Preferred Station</TableHead>
                  <TableHead>Certifications</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Loading volunteers...
                    </TableCell>
                  </TableRow>
                ) : filteredVolunteers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No volunteers found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVolunteers.map(volunteer => (
                    <TableRow key={volunteer.id} data-testid={`volunteer-row-${volunteer.id}`}>
                      <TableCell className="font-medium">{volunteer.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm">
                          {volunteer.contact_phone && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="h-3 w-3" /> {volunteer.contact_phone}
                            </span>
                          )}
                          {volunteer.contact_email && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Mail className="h-3 w-3" /> {volunteer.contact_email}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStationName(volunteer.station_id)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {volunteer.certifications?.slice(0, 3).map((cert, idx) => (
                            <span key={idx} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {cert}
                            </span>
                          ))}
                          {volunteer.certifications?.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{volunteer.certifications.length - 3}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                        {volunteer.notes || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => openEditDialog(volunteer)}
                            title="Edit Volunteer"
                            data-testid={`edit-volunteer-${volunteer.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-500"
                            onClick={() => handleDeleteVolunteer(volunteer.id)}
                            title="Remove Volunteer"
                            data-testid={`delete-volunteer-${volunteer.id}`}
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
            setEditingVolunteer(null);
            resetForm();
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Volunteer</DialogTitle>
            </DialogHeader>
            <VolunteerForm onSave={handleEditVolunteer} buttonText="Save Changes" />
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};
