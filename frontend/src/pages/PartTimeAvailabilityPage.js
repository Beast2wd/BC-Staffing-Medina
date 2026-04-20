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
import { Plus, ChevronLeft, ChevronRight, Clock, CalendarIcon, Trash2, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { formatDisplayDate } from '../utils/dateUtils';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { format } from 'date-fns';

export const PartTimeAvailabilityPage = () => {
  const { api, isAdmin } = useAuth();
  const { selectedDate, setSelectedDate, selectedBattalion, getShiftForDate } = useStaffing();
  const [partTimeEmployees, setPartTimeEmployees] = useState([]);
  const [availabilityRecords, setAvailabilityRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: '',
    date: selectedDate,
    shift: '',
    hours: 24,
    notes: ''
  });

  // Calculate max allowed date (12 months in advance)
  const getMaxAllowedDate = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date(today);
    maxDate.setFullYear(maxDate.getFullYear() + 1);
    return maxDate.toISOString().split('T')[0];
  };
  
  const maxDate = getMaxAllowedDate();

  useEffect(() => {
    fetchPartTimeEmployees();
  }, []);

  useEffect(() => {
    setFormData(prev => ({ ...prev, date: selectedDate }));
    fetchAvailabilityRecords();
  }, [selectedDate, selectedBattalion]);

  const fetchPartTimeEmployees = async () => {
    try {
      const response = await api.get('/part-time-employees');
      setPartTimeEmployees(response.data);
    } catch (error) {
      console.error('Error fetching part-time employees:', error);
    }
  };

  const fetchAvailabilityRecords = async () => {
    try {
      const response = await api.get('/part-time-availability', {
        params: { date: selectedDate, battalion_id: selectedBattalion }
      });
      setAvailabilityRecords(response.data);
    } catch (error) {
      console.error('Error fetching availability records:', error);
    }
  };

  const navigateDate = (direction) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + direction);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const handleAddAvailability = async () => {
    if (!formData.employee_id) {
      toast.error('Please select a part-time employee');
      return;
    }
    if (!formData.date) {
      toast.error('Please select a date');
      return;
    }
    if (!formData.shift) {
      toast.error('Please select a shift');
      return;
    }

    setLoading(true);
    try {
      await api.post('/part-time-availability', {
        employee_id: formData.employee_id,
        date: formData.date,
        shift: formData.shift,
        hours: formData.hours,
        notes: formData.notes,
        battalion_id: selectedBattalion
      });
      toast.success('Part-time availability submitted');
      setShowAddDialog(false);
      fetchAvailabilityRecords();
      setFormData({ 
        employee_id: '', 
        date: selectedDate, 
        shift: '',
        hours: 24, 
        notes: '' 
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit availability');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (recordId, newStatus) => {
    try {
      await api.put(`/part-time-availability/${recordId}`, {
        status: newStatus
      });
      toast.success('Status updated');
      fetchAvailabilityRecords();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleDeclineAssigned = async (recordId) => {
    const confirmed = window.confirm(
      'Are you sure you want to decline this ASSIGNED shift?\n\n' +
      'IMPORTANT: It is YOUR responsibility to contact the Officer or Battalion Chief of the station and shift that staffing is being affected, via department email and phone call.'
    );
    
    if (!confirmed) return;
    
    try {
      await api.put(`/part-time-availability/${recordId}`, {
        status: 'declined'
      });
      toast.warning('Assigned shift declined. Please notify the Battalion Chief immediately.');
      fetchAvailabilityRecords();
      // TODO: Send email and text notification to on-duty Battalion Chief
    } catch (error) {
      toast.error('Failed to decline shift');
    }
  };

  const handleDeleteRecord = async (recordId) => {
    if (!confirm('Are you sure you want to remove this availability?')) return;
    
    try {
      await api.delete(`/part-time-availability/${recordId}`);
      toast.success('Availability removed');
      fetchAvailabilityRecords();
    } catch (error) {
      toast.error('Failed to remove availability');
    }
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

  const getShiftBadge = (shift) => {
    const colors = {
      'A': 'bg-red-500/20 text-red-500 border-red-500',
      'B': 'bg-green-500/20 text-green-500 border-green-500',
      'C': 'bg-blue-500/20 text-blue-500 border-blue-500'
    };
    return (
      <Badge variant="outline" className={colors[shift] || ''}>
        {shift} Shift
      </Badge>
    );
  };

  const getEmployeeName = (employeeId) => {
    const employee = partTimeEmployees.find(e => e.id === employeeId);
    return employee ? employee.name : employeeId;
  };

  // Render form inline to prevent focus loss
  const renderAddForm = () => (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>Part-Time Employee *</Label>
        <Select 
          value={formData.employee_id} 
          onValueChange={(v) => setFormData({...formData, employee_id: v})}
        >
          <SelectTrigger data-testid="employee-select">
            <SelectValue placeholder="Select employee" />
          </SelectTrigger>
          <SelectContent>
            {partTimeEmployees.map(employee => (
              <SelectItem key={employee.id} value={employee.id}>
                {employee.name} ({employee.employee_number})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Availability Date *</Label>
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="justify-start text-left font-normal flex-1"
                data-testid="calendar-trigger"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.date ? (
                  <>
                    {format(new Date(formData.date + 'T00:00:00'), 'MM/dd/yyyy')}
                    <Badge 
                      variant="outline" 
                      className={`ml-2 text-xs ${
                        getShiftForDate(formData.date) === 'A' ? 'bg-red-500/20 text-red-500 border-red-500' :
                        getShiftForDate(formData.date) === 'B' ? 'bg-green-500/20 text-green-500 border-green-500' :
                        'bg-blue-500/20 text-blue-500 border-blue-500'
                      }`}
                    >
                      {getShiftForDate(formData.date)} Shift
                    </Badge>
                  </>
                ) : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="p-2 border-b bg-muted/50">
                <div className="flex items-center justify-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span>A Shift</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span>B Shift</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span>C Shift</span>
                  </div>
                </div>
              </div>
              <Calendar
                mode="single"
                selected={formData.date ? new Date(formData.date + 'T00:00:00') : undefined}
                onSelect={(date) => {
                  if (date) {
                    const dateStr = format(date, 'yyyy-MM-dd');
                    setFormData({...formData, date: dateStr, shift: getShiftForDate(dateStr)});
                  }
                }}
                disabled={(date) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const maxDateObj = new Date(maxDate + 'T00:00:00');
                  return date < today || date > maxDateObj;
                }}
                modifiers={{
                  shiftA: (date) => getShiftForDate(format(date, 'yyyy-MM-dd')) === 'A',
                  shiftB: (date) => getShiftForDate(format(date, 'yyyy-MM-dd')) === 'B',
                  shiftC: (date) => getShiftForDate(format(date, 'yyyy-MM-dd')) === 'C',
                }}
                modifiersClassNames={{
                  shiftA: 'bg-red-500/20 text-red-700 dark:text-red-300 hover:bg-red-500/30',
                  shiftB: 'bg-green-500/20 text-green-700 dark:text-green-300 hover:bg-green-500/30',
                  shiftC: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 hover:bg-blue-500/30',
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Input
            type="date"
            value={formData.date}
            onChange={(e) => {
              const dateStr = e.target.value;
              setFormData({...formData, date: dateStr, shift: getShiftForDate(dateStr)});
            }}
            min={new Date().toISOString().split('T')[0]}
            max={maxDate}
            className="w-36"
            data-testid="date-input"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Availability can be submitted up to {formatDisplayDate(maxDate)}
        </p>
      </div>

      <div className="space-y-2">
        <Label>Shift *</Label>
        <Select 
          value={formData.shift} 
          onValueChange={(v) => setFormData({...formData, shift: v})}
        >
          <SelectTrigger data-testid="shift-select">
            <SelectValue placeholder="Select shift" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="A">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                A Shift
              </div>
            </SelectItem>
            <SelectItem value="B">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                B Shift
              </div>
            </SelectItem>
            <SelectItem value="C">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                C Shift
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Hours</Label>
        <div className="p-3 bg-muted rounded-lg">
          <p className="text-lg font-bold">24 Hours</p>
          <p className="text-xs text-muted-foreground">Part-time shifts are fixed at 24 hours</p>
        </div>
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

      {formData.employee_id && formData.date && formData.shift && (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <p className="text-sm text-yellow-500">
            <strong>{getEmployeeName(formData.employee_id)}</strong> will be marked as <strong>Available</strong> for{' '}
            <strong>{formData.shift} Shift</strong> on <strong>{formatDisplayDate(formData.date)}</strong>
          </p>
          <p className="text-xs text-yellow-400 mt-1">
            Note: Part-time employees are NOT automatically assigned. Battalion Chief will review and assign manually.
          </p>
        </div>
      )}

      <Button onClick={handleAddAvailability} disabled={loading} className="w-full" data-testid="submit-availability-btn">
        <Plus className="h-4 w-4 mr-2" /> Submit Availability
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background" data-testid="part-time-availability-page">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-3xl uppercase tracking-wider font-bold flex items-center gap-2">
              <Clock className="h-8 w-8 text-purple-500" />
              Part-Time Availability
            </h1>
            <p className="text-muted-foreground mt-1">
              Submit part-time employee availability - {formatDisplayDate(selectedDate)}
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

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-purple-500">{partTimeEmployees.length}</p>
                <p className="text-sm text-muted-foreground">Part-Time Employees</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-500">
                  {availabilityRecords.filter(r => r.status === 'available').length}
                </p>
                <p className="text-sm text-muted-foreground">Available Today</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-500">
                  {availabilityRecords.filter(r => r.status === 'assigned').length}
                </p>
                <p className="text-sm text-muted-foreground">Assigned Today</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Submit Availability */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading uppercase">Submit Part-Time Availability</CardTitle>
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button data-testid="add-availability-btn">
                    <Plus className="h-4 w-4 mr-2" /> Submit Availability
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="font-heading uppercase">Submit Part-Time Availability</DialogTitle>
                  </DialogHeader>
                  {renderAddForm()}
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
        </Card>

        {/* All Part-Time Available */}
        <Card data-testid="all-part-time-card">
          <CardHeader>
            <CardTitle className="font-heading uppercase">
              Part-Time Availability for {formatDisplayDate(selectedDate)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Emp #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availabilityRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No part-time availability for this date
                    </TableCell>
                  </TableRow>
                ) : (
                  availabilityRecords.map(record => (
                    <TableRow key={record.id} data-testid={`pt-record-${record.id}`}>
                      <TableCell className="font-medium">
                        {record.employee_name || getEmployeeName(record.employee_id)}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-primary">
                        {record.employee_number}
                      </TableCell>
                      <TableCell>
                        {formatDisplayDate(record.date)}
                      </TableCell>
                      <TableCell>
                        {getShiftBadge(record.shift)}
                      </TableCell>
                      <TableCell>{record.hours} hrs</TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell className="max-w-[150px] truncate text-sm text-muted-foreground">
                        {record.notes || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {record.status !== 'assigned' ? (
                            <Select 
                              value={record.status} 
                              onValueChange={(v) => handleUpdateStatus(record.id, v)}
                            >
                              <SelectTrigger className="h-8 text-xs w-28" data-testid={`status-select-${record.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="available">Available</SelectItem>
                                <SelectItem value="declined">Declined</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="h-8 text-xs text-red-500 border-red-500 hover:bg-red-500/10"
                              onClick={() => handleDeclineAssigned(record.id)}
                              data-testid={`decline-assigned-btn-${record.id}`}
                            >
                              Decline Shift
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-500 h-8 w-8 p-0"
                            onClick={() => handleDeleteRecord(record.id)}
                            title="Remove"
                            data-testid={`delete-btn-${record.id}`}
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
            
            {/* Important Notice about declining assigned shifts */}
            <Alert className="mt-4 border-red-500/50 bg-red-500/10">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <AlertDescription className="text-red-500 text-sm">
                <strong>Important:</strong> If you decline an assigned part-time shift, it is YOUR responsibility to contact the Officer or Battalion Chief of the station and shift that staffing is being affected, via department email and phone call.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
