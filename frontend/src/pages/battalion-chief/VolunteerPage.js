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
import { Plus, Save, ChevronLeft, ChevronRight, Phone, Trash2, Hand, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Alert, AlertDescription } from '../../components/ui/alert';

export const VolunteerPage = () => {
  const { api, canEdit } = useAuth();
  const { personnel, stations, fetchAllData, selectedDate, setSelectedDate, selectedBattalion, currentShift, fetchStaffingRecords, staffingRecords } = useStaffing();
  const [volunteerRecords, setVolunteerRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formData, setFormData] = useState({
    personnel_id: '',
    date: selectedDate,
    hours: 24,
    station_id: '',
    status: 'available',
    notes: '',
    phone_number: '',
    shift_type: '24'
  });

  // Filter for volunteer firefighters only
  const volunteerPersonnel = personnel.filter(p => p.rank === 'Volunteer Firefighter');

  useEffect(() => {
    fetchAllData();
  }, [selectedBattalion]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, date: selectedDate }));
    fetchVolunteerRecords();
  }, [selectedDate]);

  const fetchVolunteerRecords = async () => {
    try {
      const response = await api.get('/volunteer', {
        params: { date: selectedDate, battalion_id: selectedBattalion }
      });
      setVolunteerRecords(response.data);
    } catch (error) {
      console.error('Error fetching volunteer records:', error);
    }
  };

  const navigateDate = (direction) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + direction);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const handleAddRecord = async () => {
    if (!formData.personnel_id || !formData.station_id) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    try {
      await api.post('/volunteer', {
        ...formData,
        battalion_id: selectedBattalion
      });
      toast.success('Volunteer record created');
      setShowAddDialog(false);
      fetchVolunteerRecords();
      setFormData({ personnel_id: '', date: selectedDate, hours: 24, station_id: '', status: 'available', notes: '', phone_number: '', shift_type: '24' });
    } catch (error) {
      toast.error('Failed to create volunteer record');
    } finally {
      setLoading(false);
    }
  };

  const syncVolunteerToWorksheet = async (stationId, delta) => {
    try {
      const existingRecord = staffingRecords.find(r => r.station_id === stationId);
      if (existingRecord) {
        const currentCategories = existingRecord.categories || {};
        const currentVol = currentCategories['volunteer'] || 0;
        await api.put(`/staffing/${existingRecord.id}`, {
          categories: {
            ...currentCategories,
            'volunteer': Math.max(0, currentVol + delta)
          }
        });
      }
    } catch (error) {
      console.error('Error syncing volunteer to worksheet:', error);
    }
  };

  const handleUpdateStatus = async (recordId, newStatus) => {
    try {
      const record = volunteerRecords.find(r => r.id === recordId);
      const prevStatus = record.status;
      
      await api.put(`/volunteer/${recordId}`, {
        ...record,
        status: newStatus
      });
      
      // Sync with daily worksheet
      if (newStatus === 'assigned' && prevStatus !== 'assigned') {
        await syncVolunteerToWorksheet(record.station_id, 1);
      } else if (newStatus === 'declined' && prevStatus === 'assigned') {
        await syncVolunteerToWorksheet(record.station_id, -1);
      }
      
      toast.success('Status updated');
      fetchVolunteerRecords();
      fetchStaffingRecords();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteRecord = async (recordId) => {
    if (!confirm('Are you sure you want to delete this volunteer record?')) return;
    
    try {
      const record = volunteerRecords.find(r => r.id === recordId);
      
      if (record?.status === 'assigned') {
        await syncVolunteerToWorksheet(record.station_id, -1);
      }
      
      await api.delete(`/volunteer/${recordId}`);
      toast.success('Volunteer record deleted');
      fetchVolunteerRecords();
      fetchStaffingRecords();
    } catch (error) {
      toast.error('Failed to delete volunteer record');
    }
  };

  const handleUpdateStation = async (recordId, newStationId) => {
    try {
      const record = volunteerRecords.find(r => r.id === recordId);
      if (!record) return;
      
      const oldStationId = record.station_id;
      
      await api.put(`/volunteer/${recordId}`, {
        ...record,
        station_id: newStationId
      });
      
      if (record.status === 'assigned') {
        await syncVolunteerToWorksheet(oldStationId, -1);
        await syncVolunteerToWorksheet(newStationId, 1);
      }
      
      toast.success('Station updated');
      fetchVolunteerRecords();
      fetchStaffingRecords();
    } catch (error) {
      toast.error('Failed to update station');
    }
  };

  const getPersonnelName = (personnelId) => {
    const person = personnel.find(p => p.id === personnelId);
    return person ? `${person.rank} ${person.name}` : personnelId;
  };

  const getPersonnelPhone = (personnelId) => {
    const person = personnel.find(p => p.id === personnelId);
    return person?.contact_phone || '-';
  };

  const getStationName = (stationId) => {
    const station = stations.find(s => s.id === stationId);
    return station ? `Station ${station.station_number}` : stationId;
  };

  const getStatusBadge = (status) => {
    const variants = {
      'available': 'bg-green-500/20 text-green-500',
      'assigned': 'bg-blue-500/20 text-blue-500',
      'declined': 'bg-red-500/20 text-red-500'
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${variants[status] || ''}`}>
        {status}
      </span>
    );
  };

  const stats = {
    available: volunteerRecords.filter(r => r.status === 'available').length,
    assigned: volunteerRecords.filter(r => r.status === 'assigned').length,
    hoursAssigned: volunteerRecords.filter(r => r.status === 'assigned').reduce((sum, r) => sum + r.hours, 0),
    total: volunteerRecords.length
  };

  return (
    <div className="min-h-screen bg-background" data-testid="volunteer-page">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-3xl uppercase tracking-wider font-bold flex items-center gap-2">
              <Hand className="h-8 w-8 text-orange-500" />
              Volunteer Available
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage volunteer firefighter availability for {selectedDate}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <BattalionSelector />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => navigateDate(-1)} data-testid="prev-date">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-40"
                data-testid="date-input"
              />
              <Button variant="outline" size="icon" onClick={() => navigateDate(1)} data-testid="next-date">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {canEdit && (
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button data-testid="add-volunteer-btn">
                    <Plus className="h-4 w-4 mr-2" /> Add Volunteer
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="font-heading uppercase">Add Volunteer Availability</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Volunteer Firefighter</Label>
                      <Select 
                        value={formData.personnel_id} 
                        onValueChange={(v) => setFormData({...formData, personnel_id: v})}
                      >
                        <SelectTrigger data-testid="personnel-select">
                          <SelectValue placeholder="Select Volunteer" />
                        </SelectTrigger>
                        <SelectContent>
                          {volunteerPersonnel.map(person => (
                            <SelectItem key={person.id} value={person.id}>
                              {person.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Phone Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={formData.phone_number}
                          onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                          placeholder="(555) 555-5555"
                          className="pl-10"
                          data-testid="phone-input"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Assign to Station</Label>
                      <Select 
                        value={formData.station_id} 
                        onValueChange={(v) => setFormData({...formData, station_id: v})}
                      >
                        <SelectTrigger data-testid="station-select">
                          <SelectValue placeholder="Select Station" />
                        </SelectTrigger>
                        <SelectContent>
                          {stations.map(station => (
                            <SelectItem key={station.id} value={station.id}>
                              Station {station.station_number}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Shift Type</Label>
                      <Select 
                        value={formData.shift_type} 
                        onValueChange={(v) => setFormData({...formData, shift_type: v, hours: parseInt(v)})}
                      >
                        <SelectTrigger data-testid="shift-type-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="12">12-Hour Shift</SelectItem>
                          <SelectItem value="24">24-Hour Shift</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Hours</Label>
                      <Input
                        type="number"
                        value={formData.hours}
                        onChange={(e) => setFormData({...formData, hours: parseFloat(e.target.value)})}
                        data-testid="hours-input"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({...formData, notes: e.target.value})}
                        placeholder="Any additional notes..."
                        data-testid="notes-input"
                      />
                    </div>

                    <Button onClick={handleAddRecord} disabled={loading} className="w-full" data-testid="save-volunteer-btn">
                      <Save className="h-4 w-4 mr-2" /> Save Record
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Important Notice */}
        <Alert className="mb-6 border-orange-500/50 bg-orange-500/10">
          <AlertCircle className="h-4 w-4 text-orange-500" />
          <AlertDescription>
            <strong>Important:</strong> If you decline a volunteer shift, it is YOUR responsibility 
            to contact the Officer or Battalion Chief of the station and shift that staffing is being affected, 
            via department email and phone call.
          </AlertDescription>
        </Alert>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-500">{stats.available}</p>
                <p className="text-sm text-muted-foreground">Available</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-500">{stats.assigned}</p>
                <p className="text-sm text-muted-foreground">Assigned</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-500">{stats.hoursAssigned}</p>
                <p className="text-sm text-muted-foreground">Hours Assigned</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Records</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Volunteer Records Table */}
        <Card data-testid="volunteer-records-card">
          <CardHeader>
            <CardTitle className="font-heading uppercase">Volunteer List</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Volunteer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  {canEdit && <TableHead className="w-40">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {volunteerRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 7 : 6} className="text-center text-muted-foreground py-8">
                      No volunteer records for this date
                    </TableCell>
                  </TableRow>
                ) : (
                  volunteerRecords.map(record => (
                    <TableRow key={record.id} data-testid={`volunteer-row-${record.id}`}>
                      <TableCell className="font-medium">{getPersonnelName(record.personnel_id)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {record.phone_number || getPersonnelPhone(record.personnel_id)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {canEdit ? (
                          <Select 
                            value={record.station_id} 
                            onValueChange={(v) => handleUpdateStation(record.id, v)}
                          >
                            <SelectTrigger className="h-8 text-xs w-28" data-testid={`station-select-${record.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {stations.map(station => (
                                <SelectItem key={station.id} value={station.id}>
                                  Station {station.station_number}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          getStationName(record.station_id)
                        )}
                      </TableCell>
                      <TableCell>{record.hours} hrs</TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{record.notes || '-'}</TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Select 
                              value={record.status} 
                              onValueChange={(v) => handleUpdateStatus(record.id, v)}
                            >
                              <SelectTrigger className="h-8 text-xs w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="available">Available</SelectItem>
                                <SelectItem value="assigned">Assigned</SelectItem>
                                <SelectItem value="declined">Declined</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                              onClick={() => handleDeleteRecord(record.id)}
                              title="Delete"
                              data-testid={`delete-volunteer-${record.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
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
