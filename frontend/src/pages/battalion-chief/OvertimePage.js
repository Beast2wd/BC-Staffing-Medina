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
import { Plus, Save, ChevronLeft, ChevronRight, Phone, Trash2, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';

export const OvertimePage = () => {
  const { api, canEdit } = useAuth();
  const { personnel, stations, fetchAllData, selectedDate, setSelectedDate, selectedBattalion, currentShift, fetchStaffingRecords, staffingRecords } = useStaffing();
  const [overtimeRecords, setOvertimeRecords] = useState([]);
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

  useEffect(() => {
    fetchAllData();
  }, [selectedBattalion]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, date: selectedDate }));
    fetchOvertimeRecords();
  }, [selectedDate]);

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

  const handleAddRecord = async () => {
    if (!formData.personnel_id || !formData.station_id) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    try {
      await api.post('/overtime', {
        ...formData,
        battalion_id: selectedBattalion
      });
      toast.success('Overtime record created');
      setShowAddDialog(false);
      fetchOvertimeRecords();
      setFormData({ personnel_id: '', date: selectedDate, hours: 24, station_id: '', status: 'available', notes: '', phone_number: '', shift_type: '24' });
    } catch (error) {
      toast.error('Failed to create overtime record');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (recordId, newStatus) => {
    try {
      const record = overtimeRecords.find(r => r.id === recordId);
      const prevStatus = record.status;
      
      // Update the overtime record
      await api.put(`/overtime/${recordId}`, {
        ...record,
        status: newStatus
      });
      
      // Sync with daily worksheet
      if (newStatus === 'assigned' && prevStatus !== 'assigned') {
        // Add to daily worksheet overtime cell
        await syncOvertimeToWorksheet(record.station_id, 1);
      } else if (newStatus === 'declined' && prevStatus === 'assigned') {
        // Remove from daily worksheet overtime cell
        await syncOvertimeToWorksheet(record.station_id, -1);
      }
      
      toast.success('Status updated');
      fetchOvertimeRecords();
      fetchStaffingRecords();
      fetchAllData(); // Refresh personnel to get updated hours
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteRecord = async (recordId) => {
    if (!confirm('Are you sure you want to delete this overtime record?')) return;
    
    try {
      const record = overtimeRecords.find(r => r.id === recordId);
      
      // If it was assigned, also update the worksheet
      if (record?.status === 'assigned') {
        await syncOvertimeToWorksheet(record.station_id, -1);
      }
      
      await api.delete(`/overtime/${recordId}`);
      toast.success('Overtime record deleted');
      fetchOvertimeRecords();
      fetchStaffingRecords();
      fetchAllData(); // Refresh personnel to get updated hours
    } catch (error) {
      toast.error('Failed to delete overtime record');
    }
  };

  const syncOvertimeToWorksheet = async (stationId, change) => {
    try {
      // Find existing staffing record for the station
      const existingRecord = staffingRecords.find(r => r.station_id === stationId);
      
      if (existingRecord) {
        const currentOT = existingRecord.categories?.overtime || 0;
        await api.put(`/staffing/${existingRecord.id}`, {
          categories: { ...existingRecord.categories, overtime: Math.max(0, currentOT + change) }
        });
      } else {
        // Create new staffing record
        await api.post('/staffing', {
          date: selectedDate,
          station_id: stationId,
          battalion_id: selectedBattalion,
          shift: currentShift,
          personnel_assigned: [],
          categories: { overtime: Math.max(0, change) },
          remarks: ''
        });
      }
    } catch (error) {
      console.error('Error syncing overtime to worksheet:', error);
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
    const colors = {
      available: 'bg-green-500',
      assigned: 'bg-blue-500',
      declined: 'bg-red-500'
    };
    return <Badge className={colors[status] || 'bg-gray-500'}>{status}</Badge>;
  };

  const availableCount = overtimeRecords.filter(r => r.status === 'available').length;
  const assignedCount = overtimeRecords.filter(r => r.status === 'assigned').length;
  const totalHoursAssigned = overtimeRecords.filter(r => r.status === 'assigned').reduce((sum, r) => sum + r.hours, 0);

  return (
    <div className="min-h-screen bg-background" data-testid="overtime-page">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-3xl uppercase tracking-wider font-bold">
              Overtime Available
            </h1>
            <p className="text-muted-foreground mt-1">
              Personnel available for overtime
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <BattalionSelector />
            {canEdit && (
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button data-testid="add-overtime-btn">
                    <Plus className="h-4 w-4 mr-2" /> Add Available
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="font-heading uppercase">Add Overtime Availability</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Personnel</Label>
                      <Select 
                        value={formData.personnel_id} 
                        onValueChange={(v) => {
                          const person = personnel.find(p => p.id === v);
                          setFormData({
                            ...formData, 
                            personnel_id: v,
                            phone_number: person?.contact_phone || ''
                          });
                        }}
                      >
                        <SelectTrigger data-testid="personnel-select">
                          <SelectValue placeholder="Select Personnel" />
                        </SelectTrigger>
                        <SelectContent>
                          {personnel.map(person => (
                            <SelectItem key={person.id} value={person.id}>
                              {person.rank} {person.name} ({person.shift} Shift)
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
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({...formData, date: e.target.value})}
                        data-testid="date-input"
                      />
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
                        placeholder="Optional notes..."
                        data-testid="notes-input"
                      />
                    </div>

                    <Button onClick={handleAddRecord} disabled={loading} className="w-full" data-testid="save-overtime-btn">
                      <Save className="h-4 w-4 mr-2" /> Save
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
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
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
                <p className="text-sm text-muted-foreground">{currentShift} Shift</p>
              </div>
              <Button variant="outline" onClick={() => navigateDate(1)} data-testid="next-date">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-500">{availableCount}</p>
                <p className="text-sm text-muted-foreground">Available</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-500">{assignedCount}</p>
                <p className="text-sm text-muted-foreground">Assigned</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-yellow-500">{totalHoursAssigned}</p>
                <p className="text-sm text-muted-foreground">Hours Assigned</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold">{overtimeRecords.length}</p>
                <p className="text-sm text-muted-foreground">Total Records</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card data-testid="overtime-records-card">
          <CardHeader>
            <CardTitle className="font-heading uppercase">Overtime List</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Personnel</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Regular Station</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>OT Station</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Total OT Hrs</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  {canEdit && <TableHead className="w-40">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {overtimeRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 10 : 9} className="text-center text-muted-foreground py-8">
                      No overtime records for this date
                    </TableCell>
                  </TableRow>
                ) : (
                  overtimeRecords.map(record => {
                    const person = personnel.find(p => p.id === record.personnel_id);
                    return (
                      <TableRow key={record.id} data-testid={`overtime-row-${record.id}`}>
                        <TableCell className="font-medium">{getPersonnelName(record.personnel_id)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {record.phone_number || getPersonnelPhone(record.personnel_id)}
                          </div>
                        </TableCell>
                        <TableCell>{person?.station_id?.replace('sta-', 'Station ') || '-'}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs ${
                            person?.shift === 'A' ? 'bg-red-500/20 text-red-500' :
                            person?.shift === 'B' ? 'bg-green-500/20 text-green-500' :
                            'bg-blue-500/20 text-blue-500'
                          }`}>
                            {person?.shift || '-'}
                          </span>
                        </TableCell>
                        <TableCell>{getStationName(record.station_id)}</TableCell>
                        <TableCell>{record.hours} hrs</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3 text-yellow-500" />
                            <span className="font-medium text-yellow-500">
                              {person?.overtime_hours_worked || 0} hrs
                            </span>
                          </div>
                        </TableCell>
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
                                data-testid={`delete-overtime-${record.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
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
