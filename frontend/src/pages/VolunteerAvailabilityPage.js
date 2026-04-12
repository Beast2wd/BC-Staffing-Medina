import { useEffect, useState } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useAuth } from '../context/AuthContext';
import { useStaffing } from '../context/StaffingContext';
import { BattalionSelector } from '../components/dashboard/BattalionSelector';
import { toast } from 'sonner';
import { Plus, Save, ChevronLeft, ChevronRight, Phone, AlertCircle, Hand } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { formatDisplayDate } from '../utils/dateUtils';

export const VolunteerAvailabilityPage = () => {
  const { api, user, isVolunteer } = useAuth();
  const { personnel, stations, fetchAllData, selectedDate, setSelectedDate, selectedBattalion, currentShift } = useStaffing();
  const [volunteerRecords, setVolunteerRecords] = useState([]);
  const [myRecords, setMyRecords] = useState([]);
  const [myHoursSummary, setMyHoursSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formData, setFormData] = useState({
    date: selectedDate,
    hours: 24,
    status: 'assigned',
    notes: '',
    phone_number: '',
    shift_type: '24',
    assigned_shift: '',
    assigned_station_id: ''
  });

  // Find the current user's personnel record or volunteer record
  const myPersonnel = personnel.find(p => p.payroll_number === user?.payroll_number);
  const myVolunteerId = user?.volunteer_id;
  
  // Calculate max allowed date (12 months in advance for volunteers)
  const getMaxAllowedDate = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date(today);
    maxDate.setFullYear(maxDate.getFullYear() + 1); // 12 months in advance
    return maxDate.toISOString().split('T')[0];
  };
  
  const maxDate = getMaxAllowedDate();

  useEffect(() => {
    fetchAllData();
    fetchMyHoursSummary();
  }, [selectedBattalion]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, date: selectedDate }));
    fetchVolunteerRecords();
  }, [selectedDate]);

  // Fetch my hours summary
  const fetchMyHoursSummary = async () => {
    try {
      const response = await api.get('/volunteer/my-hours');
      setMyHoursSummary(response.data);
    } catch (error) {
      console.error('Error fetching hours summary:', error);
    }
  };

  // Update myRecords when volunteerRecords or myPersonnel changes
  useEffect(() => {
    const myId = isVolunteer ? myVolunteerId : myPersonnel?.id;
    if (myId && volunteerRecords.length > 0) {
      setMyRecords(volunteerRecords.filter(r => r.personnel_id === myId));
    } else {
      setMyRecords([]);
    }
  }, [volunteerRecords, myPersonnel, myVolunteerId, isVolunteer]);

  const isDateAllowed = (dateStr) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateObj = new Date(dateStr + 'T00:00:00');
    const maxDateObj = new Date(today);
    maxDateObj.setFullYear(maxDateObj.getFullYear() + 1);
    return selectedDateObj >= today && selectedDateObj <= maxDateObj;
  };

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

  const handleAddAvailability = async () => {
    const myId = isVolunteer ? myVolunteerId : myPersonnel?.id;
    
    if (!myId && !isVolunteer) {
      toast.error('Your personnel record was not found. Please contact your administrator.');
      return;
    }
    
    if (!isDateAllowed(formData.date)) {
      toast.error('You can only submit availability up to 12 months in advance');
      return;
    }

    // Validate shift and station selection for volunteers
    if (isVolunteer && (!formData.assigned_shift || !formData.assigned_station_id)) {
      toast.error('Please select both a shift and station for your assignment');
      return;
    }
    
    setLoading(true);
    try {
      await api.post('/volunteer', {
        personnel_id: myId || '',
        date: formData.date,
        hours: formData.hours,
        station_id: formData.assigned_station_id || (myPersonnel?.station_id || ''),
        battalion_id: selectedBattalion,
        status: 'available',
        notes: formData.notes,
        phone_number: formData.phone_number || myPersonnel?.contact_phone || '',
        shift_type: formData.shift_type,
        assigned_shift: formData.assigned_shift,
        assigned_station_id: formData.assigned_station_id
      });
      toast.success('Availability submitted - You are now assigned!');
      setShowAddDialog(false);
      fetchVolunteerRecords();
      fetchMyHoursSummary();
      setFormData({ 
        date: selectedDate, 
        hours: 24, 
        status: 'assigned', 
        notes: '', 
        phone_number: '', 
        shift_type: '24',
        assigned_shift: '',
        assigned_station_id: ''
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit availability');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMyStatus = async (recordId, newStatus) => {
    if (newStatus === 'remove') {
      await handleRemoveMyRecord(recordId);
      return;
    }
    
    try {
      const record = volunteerRecords.find(r => r.id === recordId);
      
      await api.put(`/volunteer/${recordId}`, {
        ...record,
        status: newStatus
      });
      
      toast.success('Status updated');
      fetchVolunteerRecords();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleRemoveMyRecord = async (recordId) => {
    if (!confirm('Are you sure you want to remove yourself from the volunteer list?')) return;
    
    try {
      await api.delete(`/volunteer/${recordId}`);
      toast.success('Removed from volunteer list');
      fetchVolunteerRecords();
    } catch (error) {
      toast.error('Failed to remove from list');
    }
  };

  const getPersonnelName = (personnelId) => {
    const person = personnel.find(p => p.id === personnelId);
    return person ? `${person.rank} ${person.name}` : personnelId;
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

  return (
    <div className="min-h-screen bg-background" data-testid="volunteer-availability-page">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-3xl uppercase tracking-wider font-bold flex items-center gap-2">
              <Hand className="h-8 w-8 text-orange-500" />
              Volunteer Availability
            </h1>
            <p className="text-muted-foreground mt-1">
              Submit your volunteer availability - {formatDisplayDate(selectedDate)}
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

        {/* My Hours Summary */}
        {myHoursSummary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6" data-testid="my-hours-summary">
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-500">{myHoursSummary.shifts_count || 0}</p>
                  <p className="text-sm text-muted-foreground">Shifts Worked</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-500">{myHoursSummary.total_hours_scheduled || 0}</p>
                  <p className="text-sm text-muted-foreground">Hours Scheduled</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-orange-500">{myHoursSummary.total_hours_worked || 0}</p>
                  <p className="text-sm text-muted-foreground">Hours Worked (YTD)</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* My Volunteer Status */}
        <Card className="mb-6" data-testid="my-volunteer-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading uppercase">My Volunteer Status</CardTitle>
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button data-testid="add-availability-btn">
                    <Plus className="h-4 w-4 mr-2" /> Submit Availability
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="font-heading uppercase">Submit Volunteer Availability</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium">
                        {isVolunteer ? 'Volunteer Firefighter' : myPersonnel?.rank} {user?.name || myPersonnel?.name}
                      </p>
                      {!isVolunteer && (
                        <>
                          <p className="text-xs text-muted-foreground">Payroll: {user?.payroll_number}</p>
                          <p className="text-xs text-muted-foreground">Home Station: Station {stations.find(s => s.id === myPersonnel?.station_id)?.station_number || 'N/A'}</p>
                        </>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Phone Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={formData.phone_number || myPersonnel?.contact_phone || ''}
                          onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                          placeholder="(555) 555-5555"
                          className="pl-10"
                          data-testid="phone-input"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Date (up to 12 months in advance)</Label>
                      <Input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({...formData, date: e.target.value})}
                        min={new Date().toISOString().split('T')[0]}
                        max={maxDate}
                        data-testid="date-input"
                      />
                      <p className="text-xs text-muted-foreground">
                        Availability can be submitted up to {maxDate}
                      </p>
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

                    {/* Shift Assignment - Required for volunteers */}
                    <div className="space-y-2">
                      <Label>Assign to Shift {isVolunteer && <span className="text-red-500">*</span>}</Label>
                      <Select 
                        value={formData.assigned_shift} 
                        onValueChange={(v) => setFormData({...formData, assigned_shift: v})}
                      >
                        <SelectTrigger data-testid="assigned-shift-select">
                          <SelectValue placeholder="Select shift to work" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A">A Shift</SelectItem>
                          <SelectItem value="B">B Shift</SelectItem>
                          <SelectItem value="C">C Shift</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Station Assignment - Required for volunteers */}
                    <div className="space-y-2">
                      <Label>Assign to Station {isVolunteer && <span className="text-red-500">*</span>}</Label>
                      <Select 
                        value={formData.assigned_station_id} 
                        onValueChange={(v) => setFormData({...formData, assigned_station_id: v})}
                      >
                        <SelectTrigger data-testid="assigned-station-select">
                          <SelectValue placeholder="Select station to work" />
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

                    {formData.assigned_shift && formData.assigned_station_id && (
                      <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <p className="text-sm text-green-500">
                          You will be <strong>automatically assigned</strong> to <strong>{formData.assigned_shift} Shift</strong> at{' '}
                          <strong>Station {stations.find(s => s.id === formData.assigned_station_id)?.station_number}</strong>
                        </p>
                        <p className="text-xs text-green-400 mt-1">
                          No approval needed! This will immediately reflect on the daily worksheet, on-duty list, and apparatus assignments.
                        </p>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <Label>Hours Available</Label>
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

                    <Button onClick={handleAddAvailability} disabled={loading} className="w-full" data-testid="submit-availability-btn">
                      <Save className="h-4 w-4 mr-2" /> Submit Availability
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {myRecords.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                You have not submitted availability for this date.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Station</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Update Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myRecords.map(record => (
                    <TableRow key={record.id}>
                      <TableCell>{getStationName(record.station_id)}</TableCell>
                      <TableCell>{record.hours} hrs</TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{record.notes || '-'}</TableCell>
                      <TableCell>
                        <Select 
                          value={record.status} 
                          onValueChange={(v) => handleUpdateMyStatus(record.id, v)}
                          disabled={record.status === 'assigned'}
                        >
                          <SelectTrigger className="h-8 text-xs" data-testid={`status-select-${record.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="available">Available</SelectItem>
                            <SelectItem value="declined">Decline</SelectItem>
                            {record.status !== 'assigned' && (
                              <SelectItem value="remove" className="text-red-500">Remove</SelectItem>
                            )}
                            {record.status === 'assigned' && (
                              <SelectItem value="assigned" disabled>Assigned</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* All Volunteers Available */}
        <Card data-testid="all-volunteers-card">
          <CardHeader>
            <CardTitle className="font-heading uppercase">All Volunteers Available for {formatDisplayDate(selectedDate)}</CardTitle>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {volunteerRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No volunteers available for this date
                    </TableCell>
                  </TableRow>
                ) : (
                  volunteerRecords.map(record => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {getPersonnelName(record.personnel_id)}
                        {record.personnel_id === myPersonnel?.id && (
                          <Badge variant="outline" className="ml-2 text-xs">You</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {record.phone_number || '-'}
                        </div>
                      </TableCell>
                      <TableCell>{getStationName(record.station_id)}</TableCell>
                      <TableCell>{record.hours} hrs</TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
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
