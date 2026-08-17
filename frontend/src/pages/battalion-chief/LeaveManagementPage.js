import { useEffect, useState, useMemo } from 'react';
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
import { Plus, Save, Trash2, CalendarIcon, ChevronLeft, ChevronRight, Pencil, BarChart3, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Calendar } from '../../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Progress } from '../../components/ui/progress';
import { format, addDays, subDays } from 'date-fns';
import { formatDisplayDate } from '../../utils/dateUtils';

export const LeaveManagementPage = ({ leaveType }) => {
  const { api, canEdit } = useAuth();
  const { personnel, fetchAllData, selectedBattalion, getShiftForDate, fetchLeaveRecords: refreshGlobalLeaveRecords } = useStaffing();
  const [leaveRecords, setLeaveRecords] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showBalancesPanel, setShowBalancesPanel] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);
  const [editStartDateOpen, setEditStartDateOpen] = useState(false);
  const [editEndDateOpen, setEditEndDateOpen] = useState(false);
  
  // View date for filtering records
  const [viewDate, setViewDate] = useState(new Date());
  const [viewDateCalendarOpen, setViewDateCalendarOpen] = useState(false);
  const [viewMode, setViewMode] = useState('all'); // 'all', 'current', 'future', 'past'
  
  const [formData, setFormData] = useState({
    personnel_id: '',
    start_date: '',
    end_date: '',
    status: 'approved',
    notes: ''
  });
  
  const [editFormData, setEditFormData] = useState({
    personnel_id: '',
    start_date: '',
    end_date: '',
    status: 'approved',
    notes: ''
  });

  // Parse date string to Date object
  const parseDate = (dateStr) => {
    if (!dateStr) return undefined;
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // Format Date object to YYYY-MM-DD string
  const formatDateString = (date) => {
    if (!date) return '';
    return format(date, 'yyyy-MM-dd');
  };

  const pageConfig = {
    sick: { title: 'Sick Leave', color: 'bg-red-500' },
    vacation: { title: 'Vacation', color: 'bg-blue-500' },
    holiday: { title: 'Holiday', color: 'bg-green-500' }
  };

  const config = pageConfig[leaveType] || pageConfig.sick;

  // Get the on-duty shift for the selected start date in the Add form
  const addFormShift = useMemo(() => {
    if (!formData.start_date) return null;
    return getShiftForDate(formData.start_date);
  }, [formData.start_date, getShiftForDate]);

  // Filter personnel to only show those assigned to the on-duty shift
  const filteredPersonnelForAdd = useMemo(() => {
    if (!addFormShift) {
      // No start date selected yet - show message to select date first
      return [];
    }
    return personnel.filter(p => p.shift === addFormShift);
  }, [personnel, addFormShift]);

  // Get the on-duty shift for the selected start date in the Edit form
  const editFormShift = useMemo(() => {
    if (!editFormData.start_date) return null;
    return getShiftForDate(editFormData.start_date);
  }, [editFormData.start_date, getShiftForDate]);

  // Navigate to previous day
  const goToPreviousDay = () => {
    setViewDate(subDays(viewDate, 1));
  };

  // Navigate to next day
  const goToNextDay = () => {
    setViewDate(addDays(viewDate, 1));
  };

  // Go to today
  const goToToday = () => {
    setViewDate(new Date());
  };

  // Filter records based on view date AND on-duty shift
  // For 24-hour shifts (0600-0600), we only show leave on shift START dates
  const filteredRecords = useMemo(() => {
    const viewDateStr = formatDateString(viewDate);
    const onDutyShift = getShiftForDate(viewDateStr);
    
    return leaveRecords.filter(record => {
      // Get the personnel's shift
      const person = personnel.find(p => p.id === record.personnel_id);
      if (!person) return false;
      
      // Only show records for personnel on the ON-DUTY shift
      if (person.shift !== onDutyShift) return false;
      
      const startDate = record.start_date;
      const endDate = record.end_date;
      
      // For 24-hour shifts: the end_date is when the shift ends (0600), not a full day
      // So we check if viewDate falls within [start_date, end_date - 1 day]
      // This matches the Leave Calendar logic
      const endDateObj = new Date(endDate + 'T00:00:00');
      endDateObj.setDate(endDateObj.getDate() - 1);
      const effectiveEndDate = endDateObj.toISOString().split('T')[0];
      // If effective end is before start (single day leave), use start date
      const adjustedEndDate = effectiveEndDate >= startDate ? effectiveEndDate : startDate;
      
      switch (viewMode) {
        case 'current':
          // Records where viewDate falls within the leave period (using 24hr shift logic)
          return viewDateStr >= startDate && viewDateStr <= adjustedEndDate;
        case 'future':
          // Records that start after viewDate
          return startDate > viewDateStr;
        case 'past':
          // Records that ended before viewDate (using adjusted end date)
          return adjustedEndDate < viewDateStr;
        case 'all':
        default:
          // Show all records for the on-duty shift
          return true;
      }
    });
  }, [leaveRecords, viewDate, viewMode, personnel, getShiftForDate]);

  useEffect(() => {
    fetchAllData();
  }, [selectedBattalion]);

  // Fetch leave records after personnel is loaded
  useEffect(() => {
    if (personnel.length > 0) {
      fetchLeaveRecords();
      fetchLeaveBalances();
    }
  }, [selectedBattalion, leaveType, personnel.length]);

  const fetchLeaveRecords = async () => {
    try {
      const response = await api.get('/leave-records', {
        params: { leave_type: leaveType }
      });
      // Filter by battalion personnel IDs
      const battalionPersonnelIds = personnel.map(p => p.id);
      const filtered = response.data.filter(r => battalionPersonnelIds.includes(r.personnel_id));
      setLeaveRecords(filtered);
    } catch (error) {
      console.error('Error fetching leave records:', error);
    }
  };

  const fetchLeaveBalances = async () => {
    try {
      const response = await api.get('/leave-balances');
      setLeaveBalances(response.data);
    } catch (error) {
      console.error('Error fetching leave balances:', error);
    }
  };

  const handleAddRecord = async () => {
    if (!formData.personnel_id || !formData.start_date || !formData.end_date) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    try {
      await api.post('/leave-records', {
        ...formData,
        leave_type: leaveType
      });
      toast.success('Leave record created');
      setShowAddDialog(false);
      fetchLeaveRecords();
      refreshGlobalLeaveRecords(); // Sync with Daily Worksheet
      setFormData({ personnel_id: '', start_date: '', end_date: '', status: 'approved', notes: '' });
    } catch (error) {
      toast.error('Failed to create leave record');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRecord = async (recordId) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    
    try {
      await api.delete(`/leave-records/${recordId}`);
      toast.success('Record deleted');
      fetchLeaveRecords();
      refreshGlobalLeaveRecords(); // Sync with Daily Worksheet
    } catch (error) {
      toast.error('Failed to delete record');
    }
  };

  const handleOpenEdit = (record) => {
    setEditingRecord(record);
    setEditFormData({
      personnel_id: record.personnel_id,
      start_date: record.start_date,
      end_date: record.end_date,
      status: record.status,
      notes: record.notes || ''
    });
    setShowEditDialog(true);
  };

  const handleEditRecord = async () => {
    if (!editFormData.start_date || !editFormData.end_date) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    try {
      await api.put(`/leave-records/${editingRecord.id}`, {
        ...editFormData,
        leave_type: leaveType
      });
      toast.success('Leave record updated');
      setShowEditDialog(false);
      setEditingRecord(null);
      fetchLeaveRecords();
      refreshGlobalLeaveRecords(); // Sync with Daily Worksheet
    } catch (error) {
      toast.error('Failed to update leave record');
    } finally {
      setLoading(false);
    }
  };

  const getPersonnelName = (personnelId) => {
    const person = personnel.find(p => p.id === personnelId);
    return person ? `${person.rank} ${person.name}` : personnelId;
  };

  const getStatusBadge = (status) => {
    const colors = {
      approved: 'bg-green-500',
      pending: 'bg-yellow-500',
      denied: 'bg-red-500'
    };
    return <Badge className={colors[status] || 'bg-gray-500'}>{status}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background" data-testid={`${leaveType}-page`}>
      <Navbar />
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-3xl uppercase tracking-wider font-bold">
              {config.title} Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage {leaveType} records for personnel
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <BattalionSelector />
            <Button 
              variant="outline" 
              onClick={() => setShowBalancesPanel(!showBalancesPanel)}
              data-testid="toggle-balances-btn"
            >
              <BarChart3 className="h-4 w-4 mr-2" /> 
              {showBalancesPanel ? 'Hide' : 'Show'} Balances
            </Button>
            {canEdit && (
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button data-testid="add-leave-btn">
                    <Plus className="h-4 w-4 mr-2" /> Add {config.title}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="font-heading uppercase">New {config.title} Record</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    {/* Start Date - Select First to determine which shift personnel to show */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Date <span className="text-red-500">*</span></Label>
                        <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                              data-testid="start-date-input"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {formData.start_date ? format(parseDate(formData.start_date), 'PPP') : 'Select date first'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={parseDate(formData.start_date)}
                              onSelect={(date) => {
                                // Clear personnel selection when date changes (shift may change)
                                setFormData({...formData, start_date: formatDateString(date), personnel_id: ''});
                                setStartDateOpen(false);
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2">
                        <Label>End Date <span className="text-red-500">*</span></Label>
                        <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                              data-testid="end-date-input"
                              disabled={!formData.start_date}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {formData.end_date ? format(parseDate(formData.end_date), 'PPP') : 'Select date'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={parseDate(formData.end_date)}
                              onSelect={(date) => {
                                setFormData({...formData, end_date: formatDateString(date)});
                                setEndDateOpen(false);
                              }}
                              disabled={(date) => formData.start_date && date < parseDate(formData.start_date)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {/* On-Duty Shift Indicator */}
                    {addFormShift && (
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                        <span className="text-sm text-muted-foreground">On-Duty Shift:</span>
                        <Badge 
                          className={`${
                            addFormShift === 'A' ? 'bg-red-500' :
                            addFormShift === 'B' ? 'bg-green-500' :
                            'bg-blue-500'
                          }`}
                        >
                          {addFormShift} Shift
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          (Only {addFormShift} Shift personnel shown below)
                        </span>
                      </div>
                    )}

                    {/* Personnel - Filtered by on-duty shift */}
                    <div className="space-y-2">
                      <Label>Personnel <span className="text-red-500">*</span></Label>
                      {!formData.start_date ? (
                        <div className="p-3 bg-muted/50 rounded-md text-sm text-muted-foreground italic">
                          Please select a start date first to see available personnel
                        </div>
                      ) : filteredPersonnelForAdd.length === 0 ? (
                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md text-sm text-yellow-600">
                          No {addFormShift} Shift personnel found in the system
                        </div>
                      ) : (
                        <Select 
                          value={formData.personnel_id} 
                          onValueChange={(v) => setFormData({...formData, personnel_id: v})}
                        >
                          <SelectTrigger data-testid="personnel-select">
                            <SelectValue placeholder="Select Personnel" />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredPersonnelForAdd.map(person => (
                              <SelectItem key={person.id} value={person.id}>
                                {person.rank} {person.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select 
                        value={formData.status} 
                        onValueChange={(v) => setFormData({...formData, status: v})}
                      >
                        <SelectTrigger data-testid="status-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="denied">Denied</SelectItem>
                        </SelectContent>
                      </Select>
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

                    <Button onClick={handleAddRecord} disabled={loading} className="w-full" data-testid="save-leave-btn">
                      <Save className="h-4 w-4 mr-2" /> Save Record
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            
            {/* Edit Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-heading uppercase">Edit {config.title} Record</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Personnel</Label>
                    <div className="p-2 bg-muted rounded-md text-sm">
                      {getPersonnelName(editFormData.personnel_id)}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Popover open={editStartDateOpen} onOpenChange={setEditStartDateOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                            data-testid="edit-start-date-input"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {editFormData.start_date ? format(parseDate(editFormData.start_date), 'PPP') : 'Select date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={parseDate(editFormData.start_date)}
                            onSelect={(date) => {
                              setEditFormData({...editFormData, start_date: formatDateString(date)});
                              setEditStartDateOpen(false);
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Popover open={editEndDateOpen} onOpenChange={setEditEndDateOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                            data-testid="edit-end-date-input"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {editFormData.end_date ? format(parseDate(editFormData.end_date), 'PPP') : 'Select date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={parseDate(editFormData.end_date)}
                            onSelect={(date) => {
                              setEditFormData({...editFormData, end_date: formatDateString(date)});
                              setEditEndDateOpen(false);
                            }}
                            disabled={(date) => editFormData.start_date && date < parseDate(editFormData.start_date)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={editFormData.status} onValueChange={(v) => setEditFormData({...editFormData, status: v})}>
                      <SelectTrigger data-testid="edit-status-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="denied">Denied</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={editFormData.notes}
                      onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                      placeholder="Optional notes..."
                      data-testid="edit-notes-input"
                    />
                  </div>

                  <Button onClick={handleEditRecord} disabled={loading} className="w-full" data-testid="update-leave-btn">
                    <Save className="h-4 w-4 mr-2" /> Update Record
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Leave Balances Panel */}
        {showBalancesPanel && (
          <Card className="mb-6" data-testid="leave-balances-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="font-heading uppercase flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  {leaveBalances[0]?.year || new Date().getFullYear()} Leave Balances
                  {leaveBalances[0]?.year_start && (
                    <Badge variant="outline" className="ml-2 text-xs font-normal normal-case">
                      {leaveBalances[0].year_start} to {leaveBalances[0].year_end}
                    </Badge>
                  )}
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowBalancesPanel(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {leaveBalances
                  .filter(b => {
                    // Filter by current shift on duty
                    const currentShift = getShiftForDate(formatDateString(viewDate));
                    return b.shift === currentShift;
                  })
                  .map(balance => {
                    const leaveData = balance[leaveType] || { annual: 0, used: 0, remaining: 0 };
                    const usedPercent = leaveData.annual > 0 
                      ? Math.min(100, (leaveData.used / leaveData.annual) * 100) 
                      : 0;
                    const isOverused = leaveData.remaining < 0;
                    
                    return (
                      <div 
                        key={balance.personnel_id} 
                        className={`p-3 rounded-lg border ${isOverused ? 'border-red-500 bg-red-500/5' : 'bg-muted/30'}`}
                        data-testid={`balance-${balance.personnel_id}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="font-medium text-sm">{balance.rank} {balance.name}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded ${
                                balance.shift === 'A' ? 'bg-red-500/20 text-red-500' :
                                balance.shift === 'B' ? 'bg-green-500/20 text-green-500' :
                                'bg-blue-500/20 text-blue-500'
                              }`}>
                                {balance.shift}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-lg font-bold ${isOverused ? 'text-red-500' : ''}`}>
                              {leaveData.remaining}
                            </div>
                            <div className="text-[10px] text-muted-foreground uppercase">Remaining</div>
                          </div>
                        </div>
                        <Progress 
                          value={usedPercent} 
                          className={`h-2 ${isOverused ? '[&>div]:bg-red-500' : ''}`}
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                          <span>{leaveData.used} used</span>
                          <span>{leaveData.annual} annual</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
              {leaveBalances.filter(b => b.shift === getShiftForDate(formatDateString(viewDate))).length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No personnel on {getShiftForDate(formatDateString(viewDate))} Shift
                </p>
              )}
              <p className="text-xs text-muted-foreground text-center mt-4">
                Showing {getShiftForDate(formatDateString(viewDate))} Shift personnel balances for {leaveType}
              </p>
            </CardContent>
          </Card>
        )}

        <Card data-testid="leave-records-card">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <CardTitle className="font-heading uppercase">{config.title} Records</CardTitle>
              
              {/* Date Navigation Controls */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={goToPreviousDay} data-testid="prev-day-btn">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <Popover open={viewDateCalendarOpen} onOpenChange={setViewDateCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="min-w-[180px]" data-testid="view-date-btn">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(viewDate, 'PPP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="center">
                    <Calendar
                      mode="single"
                      selected={viewDate}
                      onSelect={(date) => {
                        if (date) {
                          setViewDate(date);
                          setViewDateCalendarOpen(false);
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                
                {/* On-Duty Shift Indicator */}
                <Badge 
                  className={`text-sm px-3 py-1 ${
                    getShiftForDate(formatDateString(viewDate)) === 'A' ? 'bg-red-500 hover:bg-red-600' :
                    getShiftForDate(formatDateString(viewDate)) === 'B' ? 'bg-green-500 hover:bg-green-600' :
                    'bg-blue-500 hover:bg-blue-600'
                  }`}
                  data-testid="on-duty-shift-badge"
                >
                  {getShiftForDate(formatDateString(viewDate))} Shift On Duty
                </Badge>
                
                <Button variant="outline" size="icon" onClick={goToNextDay} data-testid="next-day-btn">
                  <ChevronRight className="h-4 w-4" />
                </Button>
                
                <Button variant="ghost" size="sm" onClick={goToToday} data-testid="today-btn">
                  Today
                </Button>
                
                <Select value={viewMode} onValueChange={setViewMode}>
                  <SelectTrigger className="w-32" data-testid="view-mode-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Records</SelectItem>
                    <SelectItem value="current">Current</SelectItem>
                    <SelectItem value="future">Future</SelectItem>
                    <SelectItem value="past">Past</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Personnel</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  {canEdit && <TableHead className="w-20">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 8 : 7} className="text-center text-muted-foreground py-8">
                      No {leaveType} records for {getShiftForDate(formatDateString(viewDate))} Shift on {formatDisplayDate(formatDateString(viewDate))}
                      {viewMode !== 'all' && ` (${viewMode})`}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map(record => {
                    const person = personnel.find(p => p.id === record.personnel_id);
                    return (
                      <TableRow key={record.id} data-testid={`leave-row-${record.id}`}>
                        <TableCell className="font-medium">{getPersonnelName(record.personnel_id)}</TableCell>
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
                        <TableCell>{formatDisplayDate(record.start_date)}</TableCell>
                        <TableCell>{formatDisplayDate(record.end_date)}</TableCell>
                        <TableCell>{getStatusBadge(record.status)}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{record.notes || '-'}</TableCell>
                        {canEdit && (
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleOpenEdit(record)}
                                data-testid={`edit-leave-${record.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-red-500"
                                onClick={() => handleDeleteRecord(record.id)}
                                data-testid={`delete-leave-${record.id}`}
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
