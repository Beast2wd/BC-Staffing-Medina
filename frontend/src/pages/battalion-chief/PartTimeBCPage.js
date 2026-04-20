import { useEffect, useState } from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useAuth } from '../../context/AuthContext';
import { useStaffing } from '../../context/StaffingContext';
import { BattalionSelector } from '../../components/dashboard/BattalionSelector';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Clock, Check, X, Calendar, TrendingUp } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { formatDisplayDate } from '../../utils/dateUtils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../components/ui/accordion';

export const PartTimeBCPage = () => {
  const { api } = useAuth();
  const { selectedDate, setSelectedDate, selectedBattalion } = useStaffing();
  const [availabilityRecords, setAvailabilityRecords] = useState([]);
  const [partTimeEmployees, setPartTimeEmployees] = useState([]);
  const [employeeStats, setEmployeeStats] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPartTimeEmployees();
    fetchAvailabilityRecords();
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
    try {
      await api.put(`/part-time-availability/${recordId}/approve`);
      toast.success('Part-time availability approved');
      fetchAvailabilityRecords();
      // Refresh stats for the affected employee
      const record = availabilityRecords.find(r => r.id === recordId);
      if (record) {
        fetchEmployeeStats(record.employee_id);
      }
    } catch (error) {
      toast.error('Failed to approve availability');
    }
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
                  <TableHead>Notes</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
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
                      <TableCell className="max-w-[150px] truncate text-sm text-muted-foreground">
                        {record.notes || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700 h-8"
                            onClick={() => handleApprove(record.id)}
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
                              {assignedDays.slice(0, 5).map((record, idx) => (
                                <div 
                                  key={idx} 
                                  className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="font-medium">{formatDisplayDate(record.date)}</span>
                                    {getShiftBadge(record.shift)}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span>{record.hours} hrs</span>
                                    {getStatusBadge(record.status)}
                                  </div>
                                </div>
                              ))}
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
                                  <TableHead>Hours</TableHead>
                                  <TableHead>Notes</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {stats.work_history.map((entry, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell>{formatDisplayDate(entry.date)}</TableCell>
                                    <TableCell>{getShiftBadge(entry.shift)}</TableCell>
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
      </main>
    </div>
  );
};
