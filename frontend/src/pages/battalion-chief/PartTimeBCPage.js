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
import { ChevronLeft, ChevronRight, Clock, Check, X, Calendar, TrendingUp, UserMinus, RefreshCw } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { formatDisplayDate } from '../../utils/dateUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../components/ui/accordion';

export const PartTimeBCPage = () => {
  const { api } = useAuth();
  const { selectedDate, setSelectedDate, selectedBattalion, stations, fetchStations } = useStaffing();
  const [availabilityRecords, setAvailabilityRecords] = useState([]);
  const [partTimeEmployees, setPartTimeEmployees] = useState([]);
  const [employeeStats, setEmployeeStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedStations, setSelectedStations] = useState({}); // Track station selection per record
  const [reassignDialog, setReassignDialog] = useState({ open: false, record: null });
  const [reassignData, setReassignData] = useState({ station_id: '', shift: '' });

  useEffect(() => {
    fetchPartTimeEmployees();
    fetchAvailabilityRecords();
    fetchStations(); // Ensure stations are loaded
  }, [selectedBattalion]);

  useEffect(() => {
    fetchAvailabilityRecords();
  }, [selectedDate]);

  const fetchPartTimeEmployees = async () => {
    try {
      const response = await api.get('/part-time-employees');
      setPartTimeEmployees(response.data);
      
      // Fetch stats for each employee
      for (const employee of response.data) {
        fetchEmployeeStats(employee.id);
      }
    } catch (error) {
      console.error('Error fetching part-time employees:', error);
    }
  };

  const fetchEmployeeStats = async (employeeId) => {
    try {
      const response = await api.get(`/part-time/stats/${employeeId}`);
      setEmployeeStats(prev => ({
        ...prev,
        [employeeId]: response.data
      }));
    } catch (error) {
      console.error('Error fetching employee stats:', error);
    }
  };

  const fetchAvailabilityRecords = async () => {
    setLoading(true);
    try {
      const response = await api.get('/part-time-availability/all', {
        params: { battalion_id: selectedBattalion }
      });
      setAvailabilityRecords(response.data);
    } catch (error) {
      console.error('Error fetching availability records:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigateDate = (direction) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + direction);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const handleApprove = async (recordId) => {
    const stationId = selectedStations[recordId];
    if (!stationId) {
      toast.error('Please select a station before approving');
      return;
    }
    
    try {
      await api.put(`/part-time-availability/${recordId}/approve?station_id=${stationId}`);
      toast.success('Part-time availability approved and assigned to station');
      fetchAvailabilityRecords();
      // Refresh stats for the affected employee
      const record = availabilityRecords.find(r => r.id === recordId);
      if (record) {
        fetchEmployeeStats(record.employee_id);
      }
      // Clear the selection
      setSelectedStations(prev => {
        const updated = { ...prev };
        delete updated[recordId];
        return updated;
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve availability');
    }
  };

  const handleStationSelect = (recordId, stationId) => {
    setSelectedStations(prev => ({
      ...prev,
      [recordId]: stationId
    }));
  };

  const handleDecline = async (recordId) => {
    try {
      await api.put(`/part-time-availability/${recordId}`, { status: 'declined' });
      toast.success('Part-time availability declined');
      fetchAvailabilityRecords();
    } catch (error) {
      toast.error('Failed to decline availability');
    }
  };

  const handleUnassign = async (recordId) => {
    if (!window.confirm('Are you sure you want to unassign this part-time employee? They will be moved back to pending approval.')) {
      return;
    }
    try {
      await api.put(`/part-time-availability/${recordId}/unassign`);
      toast.success('Part-time employee unassigned successfully');
      fetchAvailabilityRecords();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to unassign');
    }
  };

  const openReassignDialog = (record) => {
    setReassignDialog({ open: true, record });
    setReassignData({
      station_id: record.assigned_station_id || '',
      shift: record.shift || ''
    });
  };

  const handleReassign = async () => {
    const { record } = reassignDialog;
    if (!reassignData.station_id) {
      toast.error('Please select a station');
      return;
    }
    try {
      await api.put(`/part-time-availability/${record.id}/reassign`, null, {
        params: {
          station_id: reassignData.station_id,
          shift: reassignData.shift || undefined
        }
      });
      toast.success('Part-time employee reassigned successfully');
      setReassignDialog({ open: false, record: null });
      fetchAvailabilityRecords();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reassign');
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      'available': 'bg-yellow-500/20 text-yellow-500 border-yellow-500',
      'assigned': 'bg-green-500/20 text-green-500 border-green-500',
      'declined': 'bg-red-500/20 text-red-500 border-red-500'
    };
    return (
      <Badge variant="outline" className={variants[status] || ''}>
        {status}
      </Badge>
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

  // Filter records for current date
  const todayRecords = availabilityRecords.filter(r => r.date === selectedDate);
  const pendingRecords = availabilityRecords.filter(r => r.status === 'available');
  const assignedRecords = availabilityRecords.filter(r => r.status === 'assigned');

  // Group records by employee for the detailed view
  const recordsByEmployee = {};
  availabilityRecords.forEach(record => {
    if (!recordsByEmployee[record.employee_id]) {
      recordsByEmployee[record.employee_id] = [];
    }
    recordsByEmployee[record.employee_id].push(record);
  });

  return (
    <div className="min-h-screen bg-background" data-testid="part-time-bc-page">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-3xl uppercase tracking-wider font-bold flex items-center gap-2">
              <Clock className="h-8 w-8 text-purple-500" />
              Part-Time Available
            </h1>
            <p className="text-muted-foreground mt-1">
              Review and approve part-time availability requests
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
                <p className="text-3xl font-bold text-yellow-500">{pendingRecords.length}</p>
                <p className="text-sm text-muted-foreground">Pending Approval</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-500">{assignedRecords.length}</p>
                <p className="text-sm text-muted-foreground">Total Assigned</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-500">{todayRecords.length}</p>
                <p className="text-sm text-muted-foreground">Available {formatDisplayDate(selectedDate)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Approvals */}
        <Card className="mb-6" data-testid="pending-approvals-card">
          <CardHeader>
            <CardTitle className="font-heading uppercase flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              Pending Approvals ({pendingRecords.length})
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
                  <TableHead>Station</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No pending approvals
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingRecords.map(record => (
                    <TableRow key={record.id} data-testid={`pending-row-${record.id}`}>
                      <TableCell className="font-medium">{record.employee_name}</TableCell>
                      <TableCell className="font-mono text-sm text-primary">{record.employee_number}</TableCell>
                      <TableCell>{formatDisplayDate(record.date)}</TableCell>
                      <TableCell>{getShiftBadge(record.shift)}</TableCell>
                      <TableCell>{record.hours} hrs</TableCell>
                      <TableCell>
                        <Select 
                          value={selectedStations[record.id] || ''} 
                          onValueChange={(v) => handleStationSelect(record.id, v)}
                        >
                          <SelectTrigger className="w-32 h-8 text-xs" data-testid={`station-select-${record.id}`}>
                            <SelectValue placeholder="Select station" />
                          </SelectTrigger>
                          <SelectContent>
                            {stations.map(station => (
                              <SelectItem key={station.id} value={station.id}>
                                Station {station.station_number}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="max-w-[100px] truncate text-sm text-muted-foreground">
                        {record.notes || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700 h-8"
                            onClick={() => handleApprove(record.id)}
                            disabled={!selectedStations[record.id]}
                            data-testid={`approve-btn-${record.id}`}
                          >
                            <Check className="h-4 w-4 mr-1" /> Approve
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            className="h-8"
                            onClick={() => handleDecline(record.id)}
                            data-testid={`decline-btn-${record.id}`}
                          >
                            <X className="h-4 w-4 mr-1" /> Decline
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

        {/* Assigned Part-Time Employees */}
        <Card data-testid="assigned-part-time-card">
          <CardHeader>
            <CardTitle className="font-heading uppercase flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              Assigned Part-Time ({availabilityRecords.filter(r => r.status === 'assigned').length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Emp #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Approved By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availabilityRecords.filter(r => r.status === 'assigned').length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No assigned part-time employees for {formatDisplayDate(selectedDate)}
                    </TableCell>
                  </TableRow>
                ) : (
                  availabilityRecords
                    .filter(r => r.status === 'assigned')
                    .map(record => {
                      const stationInfo = stations.find(s => s.id === record.assigned_station_id);
                      return (
                        <TableRow key={record.id} data-testid={`assigned-row-${record.id}`}>
                          <TableCell className="font-medium">{record.employee_name}</TableCell>
                          <TableCell className="font-mono text-sm text-primary">{record.employee_number}</TableCell>
                          <TableCell>{formatDisplayDate(record.date)}</TableCell>
                          <TableCell>{getShiftBadge(record.shift)}</TableCell>
                          <TableCell>
                            {stationInfo ? (
                              <Badge variant="outline">Station {stationInfo.station_number}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>{record.hours} hrs</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{record.approved_by || '-'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openReassignDialog(record)}
                                data-testid={`reassign-btn-${record.id}`}
                              >
                                <RefreshCw className="h-4 w-4 mr-1" /> Reassign
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleUnassign(record.id)}
                                data-testid={`unassign-btn-${record.id}`}
                              >
                                <UserMinus className="h-4 w-4 mr-1" /> Unassign
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Part-Time Employee Details */}
        <Card data-testid="employee-details-card">
          <CardHeader>
            <CardTitle className="font-heading uppercase flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              Part-Time Employee Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {partTimeEmployees.map(employee => {
                const stats = employeeStats[employee.id] || {};
                const employeeRecords = recordsByEmployee[employee.id] || [];
                const assignedDays = employeeRecords
                  .filter(r => r.status === 'assigned')
                  .sort((a, b) => b.date.localeCompare(a.date));
                
                return (
                  <AccordionItem key={employee.id} value={employee.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                            <span className="font-bold text-purple-500">
                              {employee.name?.charAt(0) || 'P'}
                            </span>
                          </div>
                          <div className="text-left">
                            <p className="font-medium">{employee.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {employee.employee_number} • {employee.rank || 'Part-Time'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <div className="text-center">
                            <p className="font-bold text-blue-500">{stats.hours_scheduled || 0}</p>
                            <p className="text-xs text-muted-foreground">Scheduled</p>
                          </div>
                          <div className="text-center">
                            <p className="font-bold text-purple-500">{stats.hours_worked_monthly || 0}</p>
                            <p className="text-xs text-muted-foreground">{stats.current_month_name || 'Monthly'}</p>
                          </div>
                          <div className="text-center">
                            <p className="font-bold text-green-500">{stats.hours_worked_ytd || 0}</p>
                            <p className="text-xs text-muted-foreground">YTD</p>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pl-14 pr-4 pb-4">
                        {/* Recent Approved Scheduled Days */}
                        <div className="mb-4">
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Recent Approved Scheduled Days
                          </h4>
                          {assignedDays.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No scheduled days</p>
                          ) : (
                            <div className="space-y-2">
                              {assignedDays.slice(0, 5).map((record, idx) => {
                                const stationInfo = stations.find(s => s.id === record.assigned_station_id);
                                return (
                                  <div 
                                    key={idx} 
                                    className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="font-medium">{formatDisplayDate(record.date)}</span>
                                      {getShiftBadge(record.shift)}
                                      {stationInfo && (
                                        <Badge variant="outline" className="text-xs">
                                          Station {stationInfo.station_number}
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span>{record.hours} hrs</span>
                                      {getStatusBadge(record.status)}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        
                        {/* Work History */}
                        {stats.work_history?.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                              <TrendingUp className="h-4 w-4" />
                              Days Worked (Ordered by Date)
                            </h4>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Date</TableHead>
                                  <TableHead>Shift</TableHead>
                                  <TableHead>Station</TableHead>
                                  <TableHead>Hours</TableHead>
                                  <TableHead>Notes</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {stats.work_history.map((entry, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell>{formatDisplayDate(entry.date)}</TableCell>
                                    <TableCell>{getShiftBadge(entry.shift)}</TableCell>
                                    <TableCell>
                                      {entry.station_name ? (
                                        <Badge variant="outline" className="text-xs">
                                          {entry.station_name}
                                        </Badge>
                                      ) : '-'}
                                    </TableCell>
                                    <TableCell>{entry.hours} hrs</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {entry.notes || '-'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                        
                        {/* Contact Info */}
                        {(employee.contact_phone || employee.contact_email) && (
                          <div className="mt-4 pt-4 border-t">
                            <p className="text-xs text-muted-foreground">
                              Contact: {employee.contact_phone} {employee.contact_email && `• ${employee.contact_email}`}
                            </p>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
            
            {partTimeEmployees.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No part-time employees found
              </p>
            )}
          </CardContent>
        </Card>

        {/* Reassign Dialog */}
        <Dialog open={reassignDialog.open} onOpenChange={(open) => setReassignDialog({ open, record: open ? reassignDialog.record : null })}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading uppercase flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Reassign Part-Time Employee
              </DialogTitle>
            </DialogHeader>
            {reassignDialog.record && (
              <div className="space-y-4 py-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium">{reassignDialog.record.employee_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDisplayDate(reassignDialog.record.date)} • {reassignDialog.record.hours} hrs
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Station *</Label>
                  <Select 
                    value={reassignData.station_id} 
                    onValueChange={(v) => setReassignData(prev => ({ ...prev, station_id: v }))}
                  >
                    <SelectTrigger data-testid="reassign-station-select">
                      <SelectValue placeholder="Select station" />
                    </SelectTrigger>
                    <SelectContent>
                      {stations.map(station => (
                        <SelectItem key={station.id} value={station.id}>
                          Station {station.station_number} - {station.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Shift (optional - leave blank to keep current)</Label>
                  <Select 
                    value={reassignData.shift || "keep"} 
                    onValueChange={(v) => setReassignData(prev => ({ ...prev, shift: v === "keep" ? '' : v }))}
                  >
                    <SelectTrigger data-testid="reassign-shift-select">
                      <SelectValue placeholder="Keep current shift" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keep">Keep current shift ({reassignDialog.record.shift})</SelectItem>
                      <SelectItem value="A">A Shift</SelectItem>
                      <SelectItem value="B">B Shift</SelectItem>
                      <SelectItem value="C">C Shift</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button 
                    onClick={handleReassign} 
                    disabled={!reassignData.station_id}
                    className="flex-1"
                    data-testid="reassign-confirm-btn"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" /> Reassign
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setReassignDialog({ open: false, record: null })}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};
