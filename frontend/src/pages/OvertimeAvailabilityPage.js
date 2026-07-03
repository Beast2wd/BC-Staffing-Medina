import { useEffect, useState } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useAuth } from '../context/AuthContext';
import { useStaffing } from '../context/StaffingContext';
import { toast } from 'sonner';
import { Plus, Save, ChevronLeft, ChevronRight, Phone, Mail, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { formatDisplayDateWithDay } from '../utils/dateUtils';

export const OvertimeAvailabilityPage = () => {
  const { api, user } = useAuth();
  const { personnel, stations, fetchAllData, selectedDate, setSelectedDate, selectedBattalion, currentShift } = useStaffing();
  const [overtimeRecords, setOvertimeRecords] = useState([]);
  const [myRecords, setMyRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formData, setFormData] = useState({
    date: selectedDate,
    hours: 24,
    status: 'available',
    notes: '',
    phone_number: '',
    email: '',
    shift_type: '24'
  });

  // Find the current user's personnel record
  const myPersonnel = personnel.find(p => p.payroll_number === user?.payroll_number);
  
  // Calculate max allowed date (144 hours / 3 tours from today)
  const getMaxAllowedDate = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date(today);
    maxDate.setHours(maxDate.getHours() + 144); // 144 hours = 6 days
    return maxDate.toISOString().split('T')[0];
  };
  
  const maxDate = getMaxAllowedDate();

  useEffect(() => {
    fetchAllData();
  }, [selectedBattalion]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, date: selectedDate }));
    fetchOvertimeRecords();
  }, [selectedDate]);

  // Update myRecords when overtimeRecords or myPersonnel changes
  useEffect(() => {
    if (myPersonnel && overtimeRecords.length > 0) {
      setMyRecords(overtimeRecords.filter(r => r.personnel_id === myPersonnel.id));
    } else {
      setMyRecords([]);
    }
  }, [overtimeRecords, myPersonnel]);

  // Validate date is within allowed range
  const isDateAllowed = (dateStr) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateObj = new Date(dateStr + 'T00:00:00');
    const maxDateObj = new Date(today);
    maxDateObj.setHours(maxDateObj.getHours() + 144);
    return selectedDateObj >= today && selectedDateObj <= maxDateObj;
  };

  const fetchOvertimeRecords = async () => {
    try {
      const response = await api.get('/overtime', {
        params: { date: selectedDate, battalion_id: selectedBattalion }
      });
      setOvertimeRecords(response.data);
    } catch (error) {
      console.error('Error fetching overtime records:', error);
    }
  };

  const navigateDate = (direction) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + direction);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const handleAddAvailability = async () => {
    if (!myPersonnel) {
      toast.error('Your personnel record was not found. Please contact your administrator.');
      return;
    }
    
    // Validate date is within 144 hours (3 tours)
    if (!isDateAllowed(formData.date)) {
      toast.error('You can only submit availability up to 3 tours (144 hours) in advance');
      return;
    }
    
    setLoading(true);
    try {
      // Use the personnel's assigned station from their record
      await api.post('/overtime', {
        personnel_id: myPersonnel.id,
        date: formData.date,
        hours: formData.hours,
        station_id: myPersonnel.station_id, // Use personnel's home station
        battalion_id: selectedBattalion,
        status: 'available',
        notes: formData.notes,
        phone_number: formData.phone_number || myPersonnel.contact_phone,
        email: formData.email || myPersonnel.contact_email,
        shift_type: formData.shift_type
      });
      toast.success('Availability submitted');
      setShowAddDialog(false);
      fetchOvertimeRecords();
      setFormData({ date: selectedDate, hours: 24, status: 'available', notes: '', phone_number: '', email: '', shift_type: '24' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit availability');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMyStatus = async (recordId, newStatus) => {
    // Handle remove action
    if (newStatus === 'remove') {
      await handleRemoveMyRecord(recordId);
      return;
    }
    
    try {
      const record = overtimeRecords.find(r => r.id === recordId);
      
      await api.put(`/overtime/${recordId}`, {
        ...record,
        status: newStatus
      });
      
      toast.success('Status updated');
      fetchOvertimeRecords();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleRemoveMyRecord = async (recordId) => {
    if (!confirm('Are you sure you want to remove yourself from the overtime list?')) return;
    
    try {
      await api.delete(`/overtime/${recordId}`);
      toast.success('Removed from overtime list');
      fetchOvertimeRecords();
    } catch (error) {
      toast.error('Failed to remove from list');
    }
  };

  const getStationName = (stationId) => {
    const station = stations.find(s => s.id === stationId);
    return station ? `Station ${station.station_number}` : stationId;
  };

  const getStatusBadge = (status) => {
    const colors = {
      available: 'bg-green-500',
      assigned: 'bg-blue-500',
      declined: 'bg-red-500'
    };
    return <Badge className={colors[status] || 'bg-gray-500'}>{status}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background" data-testid="overtime-availability-page">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-3xl uppercase tracking-wider font-bold">
              Overtime Availability
            </h1>
            <p className="text-muted-foreground mt-1">
              Submit your availability for overtime shifts
            </p>
          </div>
          
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button data-testid="add-availability-btn">
                <Plus className="h-4 w-4 mr-2" /> Submit Availability
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="font-heading uppercase">Submit Overtime Availability</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">{myPersonnel?.rank} {myPersonnel?.name}</p>
                  <p className="text-xs text-muted-foreground">Payroll: {user?.payroll_number}</p>
                  <p className="text-xs text-muted-foreground">Home Station: Station {stations.find(s => s.id === myPersonnel?.station_id)?.station_number || 'N/A'}</p>
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
                  <Label>Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      value={formData.email || myPersonnel?.contact_email || ''}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      placeholder="email@example.com"
                      className="pl-10"
                      data-testid="email-input"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Date (max 3 tours / 144 hours in advance)</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    min={new Date().toISOString().split('T')[0]}
                    max={maxDate}
                    data-testid="date-input"
                  />
                  <p className="text-xs text-muted-foreground">
                    Availability can only be submitted up to {maxDate}
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

        {/* Date Navigation */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-4">
              <Button variant="outline" onClick={() => navigateDate(-1)} data-testid="prev-date">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="text-center min-w-[200px]">
                <p className="text-lg font-heading font-semibold">
                  {formatDisplayDateWithDay(selectedDate)}
                </p>
                <p className="text-sm text-muted-foreground">{currentShift} Shift</p>
              </div>
              <Button variant="outline" onClick={() => navigateDate(1)} data-testid="next-date">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* My Overtime Status */}
        <Card className="mb-6" data-testid="my-overtime-card">
          <CardHeader>
            <CardTitle className="font-heading uppercase">My Overtime Status</CardTitle>
          </CardHeader>
          <CardContent>
            {myRecords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>You have not submitted availability for this date.</p>
                <Button variant="outline" className="mt-4" onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Submit Availability
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Station</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-40">Update Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myRecords.map(record => (
                    <TableRow key={record.id}>
                      <TableCell>{getStationName(record.station_id)}</TableCell>
                      <TableCell>{record.hours} hrs</TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell>{record.notes || '-'}</TableCell>
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

        {/* Important Notice */}
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Important:</strong> If you decline an assigned overtime shift, it is YOUR responsibility 
            to contact the Officer or Battalion Chief of the station and shift that staffing is being affected, 
            via department email and phone call.
          </AlertDescription>
        </Alert>

        {/* All Available Personnel */}
        <Card data-testid="all-overtime-card">
          <CardHeader>
            <CardTitle className="font-heading uppercase">All Personnel Available for Overtime</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Personnel</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overtimeRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No overtime availability submitted for this date
                    </TableCell>
                  </TableRow>
                ) : (
                  overtimeRecords.map(record => {
                    const person = personnel.find(p => p.id === record.personnel_id);
                    return (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          {person?.rank} {person?.name}
                          {record.personnel_id === myPersonnel?.id && (
                            <Badge variant="outline" className="ml-2 text-xs">You</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {record.phone_number || person?.contact_phone || '-'}
                          </div>
                        </TableCell>
                        <TableCell>{getStationName(record.station_id)}</TableCell>
                        <TableCell>{record.hours} hrs</TableCell>
                        <TableCell>{getStatusBadge(record.status)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
