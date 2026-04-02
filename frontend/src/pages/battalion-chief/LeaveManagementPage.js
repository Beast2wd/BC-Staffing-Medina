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
import { Plus, Save, Trash2, CalendarIcon, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Calendar } from '../../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { format, addDays, subDays } from 'date-fns';

export const LeaveManagementPage = ({ leaveType }) => {
  const { api, canEdit } = useAuth();
  const { personnel, fetchAllData, selectedBattalion } = useStaffing();
  const [leaveRecords, setLeaveRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
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

  // Filter records based on view date
  const filteredRecords = leaveRecords.filter(record => {
    const viewDateStr = formatDateString(viewDate);
    const startDate = record.start_date;
    const endDate = record.end_date;
    
    switch (viewMode) {
      case 'current':
        // Records where viewDate falls within the leave period
        return viewDateStr >= startDate && viewDateStr <= endDate;
      case 'future':
        // Records that start after viewDate
        return startDate > viewDateStr;
      case 'past':
        // Records that ended before viewDate
        return endDate < viewDateStr;
      case 'all':
      default:
        // Show all records that overlap with or are near the view date (within 30 days)
        return true;
    }
  });

  useEffect(() => {
    fetchAllData();
    fetchLeaveRecords();
  }, [selectedBattalion, leaveType, viewDate]);

  const fetchLeaveRecords = async () => {
    try {
      const response = await api.get('/leave-records', {
        params: { leave_type: leaveType }
      });
      // Filter by battalion personnel
      const battalionPersonnelIds = personnel.map(p => p.id);
      const filtered = response.data.filter(r => battalionPersonnelIds.includes(r.personnel_id));
      setLeaveRecords(filtered);
    } catch (error) {
      console.error('Error fetching leave records:', error);
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
                    <div className="space-y-2">
                      <Label>Personnel</Label>
                      <Select 
                        value={formData.personnel_id} 
                        onValueChange={(v) => setFormData({...formData, personnel_id: v})}
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
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Date</Label>
                        <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                              data-testid="start-date-input"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {formData.start_date ? format(parseDate(formData.start_date), 'PPP') : 'Select date'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={parseDate(formData.start_date)}
                              onSelect={(date) => {
                                setFormData({...formData, start_date: formatDateString(date)});
                                setStartDateOpen(false);
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2">
                        <Label>End Date</Label>
                        <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                              data-testid="end-date-input"
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
                      No {leaveType} records found for {viewMode === 'current' ? 'current date' : viewMode === 'future' ? 'future dates' : viewMode === 'past' ? 'past dates' : 'this selection'}
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
                        <TableCell>{record.start_date}</TableCell>
                        <TableCell>{record.end_date}</TableCell>
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
