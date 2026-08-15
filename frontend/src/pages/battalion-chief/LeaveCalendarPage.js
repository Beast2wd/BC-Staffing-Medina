import { useEffect, useState, useMemo } from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { useAuth } from '../../context/AuthContext';
import { useStaffing } from '../../context/StaffingContext';
import { ChevronLeft, ChevronRight, Calendar, Filter, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { formatDisplayDate } from '../../utils/dateUtils';

const LEAVE_TYPES = [
  { id: 'all', label: 'All Leave Types', color: '' },
  { id: 'vacation', label: 'Vacation', color: 'bg-blue-500' },
  { id: 'sick', label: 'Sick', color: 'bg-red-500' },
  { id: 'holiday', label: 'Holiday', color: 'bg-green-500' },
];

const SHIFTS = ['all', 'A', 'B', 'C'];

export const LeaveCalendarPage = () => {
  const { api } = useAuth();
  const { personnel, stations, fetchPersonnel, getShiftForDate } = useStaffing();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [leaveRecords, setLeaveRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedLeaveType, setSelectedLeaveType] = useState('all');
  const [selectedShift, setSelectedShift] = useState('all');
  const [selectedStation, setSelectedStation] = useState('all');
  const [selectedDay, setSelectedDay] = useState(null);
  const [showDayDialog, setShowDayDialog] = useState(false);

  // Fetch personnel on mount
  useEffect(() => {
    fetchPersonnel();
  }, [fetchPersonnel]);

  // Fetch leave records for the current month view
  useEffect(() => {
    const fetchLeaveRecords = async () => {
      setLoading(true);
      try {
        // Get records for the visible month range (including partial weeks)
        const start = startOfWeek(startOfMonth(currentMonth));
        const end = endOfWeek(endOfMonth(currentMonth));
        
        const response = await api.get('/leave-records', {
          params: {
            start_date: format(start, 'yyyy-MM-dd'),
            end_date: format(end, 'yyyy-MM-dd')
          }
        });
        setLeaveRecords(response.data);
      } catch (error) {
        console.error('Error fetching leave records:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaveRecords();
  }, [api, currentMonth]);

  // Get calendar days for the current month view
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // Get personnel map for quick lookup
  const personnelMap = useMemo(() => {
    const map = {};
    personnel.forEach(p => {
      map[p.id] = p;
    });
    return map;
  }, [personnel]);

  // Filter and organize leave records by date
  const leaveByDate = useMemo(() => {
    const byDate = {};
    
    leaveRecords.forEach(leave => {
      // Apply filters
      const person = personnelMap[leave.personnel_id];
      if (!person) return;
      
      // Filter by leave type
      if (selectedLeaveType !== 'all' && leave.leave_type !== selectedLeaveType) return;
      
      // Filter by shift
      if (selectedShift !== 'all' && person.shift !== selectedShift) return;
      
      // Filter by station
      if (selectedStation !== 'all' && person.station_id !== selectedStation) return;
      
      // Only include approved leaves
      if (leave.status !== 'approved') return;
      
      // Add to each date in the leave range
      // Use parseISO to correctly parse date strings without timezone shift
      const startDate = parseISO(leave.start_date);
      const endDate = parseISO(leave.end_date);
      
      // For 24-hour shift work (0600-0600), the end_date represents when the shift ends,
      // not a separate day of leave. Only show leave on shift START dates.
      // Example: Vacation Aug 17-18 = one 24hr shift starting Aug 17
      // Example: Vacation Aug 17-19 = two 24hr shifts starting Aug 17 and Aug 18
      const lastShiftDate = new Date(endDate);
      lastShiftDate.setDate(lastShiftDate.getDate() - 1); // Exclude the end date (shift end time)
      
      // If start and adjusted end are the same or end is before start, just use start date
      const effectiveEndDate = lastShiftDate >= startDate ? lastShiftDate : startDate;
      
      const daysInRange = eachDayOfInterval({ start: startDate, end: effectiveEndDate });
      daysInRange.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        if (!byDate[dateKey]) {
          byDate[dateKey] = [];
        }
        byDate[dateKey].push({
          ...leave,
          person
        });
      });
    });
    
    return byDate;
  }, [leaveRecords, personnelMap, selectedLeaveType, selectedShift, selectedStation]);

  // Get unique stations for filter
  const uniqueStations = useMemo(() => {
    const stationSet = new Set();
    personnel.forEach(p => {
      if (p.station_id) stationSet.add(p.station_id);
    });
    return Array.from(stationSet).sort();
  }, [personnel]);

  // Navigation
  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  // Get leave type color
  const getLeaveColor = (leaveType) => {
    const type = LEAVE_TYPES.find(t => t.id === leaveType);
    return type?.color || 'bg-gray-500';
  };

  // Get shift color for day header
  const getShiftColor = (date) => {
    const shift = getShiftForDate(format(date, 'yyyy-MM-dd'));
    switch (shift) {
      case 'A': return 'bg-red-500/20 text-red-500';
      case 'B': return 'bg-green-500/20 text-green-500';
      case 'C': return 'bg-blue-500/20 text-blue-500';
      default: return '';
    }
  };

  // Handle day click
  const handleDayClick = (day) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    const dayLeaves = leaveByDate[dateKey] || [];
    if (dayLeaves.length > 0) {
      setSelectedDay({ date: day, leaves: dayLeaves });
      setShowDayDialog(true);
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    let vacation = 0, sick = 0, holiday = 0;
    Object.values(leaveByDate).forEach(dayLeaves => {
      dayLeaves.forEach(leave => {
        if (leave.leave_type === 'vacation') vacation++;
        else if (leave.leave_type === 'sick') sick++;
        else if (leave.leave_type === 'holiday') holiday++;
      });
    });
    return { vacation, sick, holiday, total: vacation + sick + holiday };
  }, [leaveByDate]);

  return (
    <div className="min-h-screen bg-background" data-testid="leave-calendar-page">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-3xl uppercase tracking-wider font-bold flex items-center gap-3">
              <Calendar className="h-8 w-8" />
              Leave Calendar
            </h1>
            <p className="text-muted-foreground mt-1">
              Visual overview of all leave across personnel
            </p>
          </div>
          
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selectedLeaveType} onValueChange={setSelectedLeaveType}>
              <SelectTrigger className="w-40" data-testid="leave-type-filter">
                <SelectValue placeholder="Leave Type" />
              </SelectTrigger>
              <SelectContent>
                {LEAVE_TYPES.map(type => (
                  <SelectItem key={type.id} value={type.id}>
                    <div className="flex items-center gap-2">
                      {type.color && <div className={`w-3 h-3 rounded-full ${type.color}`} />}
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedShift} onValueChange={setSelectedShift}>
              <SelectTrigger className="w-32" data-testid="shift-filter">
                <SelectValue placeholder="Shift" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Shifts</SelectItem>
                <SelectItem value="A">A Shift</SelectItem>
                <SelectItem value="B">B Shift</SelectItem>
                <SelectItem value="C">C Shift</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={selectedStation} onValueChange={setSelectedStation}>
              <SelectTrigger className="w-40" data-testid="station-filter">
                <SelectValue placeholder="Station" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stations</SelectItem>
                {uniqueStations.map(stationId => (
                  <SelectItem key={stationId} value={stationId}>
                    {stationId.replace('sta-', 'Station ').replace(/-/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.vacation}</div>
                <div className="text-sm text-muted-foreground">Vacation Days</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-red-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.sick}</div>
                <div className="text-sm text-muted-foreground">Sick Days</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.holiday}</div>
                <div className="text-sm text-muted-foreground">Holiday Days</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">Total Leave Days</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Calendar Card */}
        <Card data-testid="leave-calendar-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading text-xl uppercase tracking-wider">
                {format(currentMonth, 'MMMM yyyy')}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={goToPreviousMonth} data-testid="prev-month-btn">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={goToToday} data-testid="today-btn">
                  Today
                </Button>
                <Button variant="outline" size="icon" onClick={goToNextMonth} data-testid="next-month-btn">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-sm font-semibold text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, idx) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayLeaves = leaveByDate[dateKey] || [];
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isToday = isSameDay(day, new Date());
                const shift = getShiftForDate(dateKey);

                return (
                  <div
                    key={idx}
                    className={`
                      min-h-[100px] p-1 border rounded-md cursor-pointer transition-colors
                      ${isCurrentMonth ? 'bg-card' : 'bg-muted/30 opacity-50'}
                      ${isToday ? 'ring-2 ring-primary' : ''}
                      ${dayLeaves.length > 0 ? 'hover:bg-accent' : ''}
                    `}
                    onClick={() => handleDayClick(day)}
                    data-testid={`calendar-day-${dateKey}`}
                  >
                    {/* Day Header */}
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-medium ${isToday ? 'text-primary' : ''}`}>
                        {format(day, 'd')}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${getShiftColor(day)}`}>
                        {shift}
                      </span>
                    </div>

                    {/* Leave Entries */}
                    <div className="space-y-0.5">
                      {dayLeaves.slice(0, 3).map((leave, i) => (
                        <div
                          key={`${leave.id}-${i}`}
                          className={`text-[10px] px-1 py-0.5 rounded truncate text-white ${getLeaveColor(leave.leave_type)}`}
                          title={`${leave.person?.name} - ${leave.leave_type}`}
                        >
                          {leave.person?.name?.split(' ').slice(-1)[0] || 'Unknown'}
                        </div>
                      ))}
                      {dayLeaves.length > 3 && (
                        <div className="text-[10px] text-muted-foreground text-center">
                          +{dayLeaves.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-sm">Vacation</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm">Sick</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm">Holiday</span>
              </div>
              <div className="flex items-center gap-4 ml-4 pl-4 border-l">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-500">A</span>
                  <span className="text-sm">A Shift</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-500">B</span>
                  <span className="text-sm">B Shift</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-500">C</span>
                  <span className="text-sm">C Shift</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Day Detail Dialog */}
        <Dialog open={showDayDialog} onOpenChange={setShowDayDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading uppercase flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {selectedDay && formatDisplayDate(format(selectedDay.date, 'yyyy-MM-dd'))}
                <span className={`text-xs px-2 py-0.5 rounded ml-2 ${selectedDay ? getShiftColor(selectedDay.date) : ''}`}>
                  {selectedDay && getShiftForDate(format(selectedDay.date, 'yyyy-MM-dd'))} Shift
                </span>
              </DialogTitle>
              <DialogDescription className="sr-only">
                Leave records for the selected date
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4 max-h-[400px] overflow-y-auto">
              {selectedDay?.leaves.map((leave, idx) => (
                <div
                  key={`${leave.id}-${idx}`}
                  className="p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">
                        {leave.person?.rank} {leave.person?.name}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                        <span>{leave.person?.station_id?.replace('sta-', 'Station ').replace(/-/g, ' ')}</span>
                        <span>•</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                          leave.person?.shift === 'A' ? 'bg-red-500/20 text-red-500' :
                          leave.person?.shift === 'B' ? 'bg-green-500/20 text-green-500' :
                          'bg-blue-500/20 text-blue-500'
                        }`}>
                          {leave.person?.shift} Shift
                        </span>
                      </div>
                    </div>
                    <Badge className={`${getLeaveColor(leave.leave_type)} text-white`}>
                      {leave.leave_type ? leave.leave_type.charAt(0).toUpperCase() + leave.leave_type.slice(1) : 'Leave'}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-2">
                    {formatDisplayDate(leave.start_date)} - {formatDisplayDate(leave.end_date)}
                  </div>
                  {leave.notes && (
                    <div className="mt-2 p-2 bg-muted/50 rounded text-sm">
                      {leave.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default LeaveCalendarPage;
