import { useEffect, useState, useCallback, useRef } from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../context/AuthContext';
import { useStaffing } from '../../context/StaffingContext';
import { BattalionSelector } from '../../components/dashboard/BattalionSelector';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Calendar, Clock, Hand, Users, X } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '../../components/ui/context-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';

export const CalendarViewPage = () => {
  const { api } = useAuth();
  const { stations, selectedBattalion, getShiftForDate } = useStaffing();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [overtimeRecords, setOvertimeRecords] = useState([]);
  const [partTimeRecords, setPartTimeRecords] = useState([]);
  const [volunteerRecords, setVolunteerRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, record: null, type: null });

  // Get first and last day of the month for fetching data
  const getMonthRange = useCallback(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    return {
      start: firstDay.toISOString().split('T')[0],
      end: lastDay.toISOString().split('T')[0]
    };
  }, [currentMonth]);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    const { start, end } = getMonthRange();
    
    try {
      // Fetch overtime records (assigned only)
      const otResponse = await api.get('/overtime', {
        params: { start_date: start, end_date: end }
      });
      setOvertimeRecords(otResponse.data.filter(r => r.status === 'assigned'));

      // Fetch part-time records (assigned only)
      const ptResponse = await api.get('/part-time-availability/all');
      const filteredPT = ptResponse.data.filter(r => {
        if (r.status !== 'assigned') return false;
        const recordDate = r.date;
        return recordDate >= start && recordDate <= end;
      });
      setPartTimeRecords(filteredPT);

      // Fetch volunteer records (assigned only)
      const volResponse = await api.get('/volunteer', {
        params: { start_date: start, end_date: end }
      });
      setVolunteerRecords(volResponse.data.filter(r => r.status === 'assigned'));

    } catch (error) {
      console.error('Error fetching calendar data:', error);
      toast.error('Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  }, [api, getMonthRange]);

  useEffect(() => {
    fetchAllData();
  }, [currentMonth, selectedBattalion]);

  const navigateMonth = (direction) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + direction);
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  // Get station name by ID
  const getStationName = (stationId) => {
    const station = stations.find(s => s.id === stationId);
    return station ? `Sta ${station.station_number}` : '';
  };

  // Get all personnel for a specific date
  const getPersonnelForDate = (dateStr) => {
    const shift = getShiftForDate(dateStr);
    const personnel = [];

    // Add overtime personnel
    overtimeRecords.forEach(record => {
      if (record.date === dateStr && record.shift === shift) {
        personnel.push({
          id: record.id,
          name: record.personnel_name,
          type: 'overtime',
          station: getStationName(record.overtime_station_id || record.station_id),
          shift: record.shift,
          hours: record.hours
        });
      }
    });

    // Add part-time personnel
    partTimeRecords.forEach(record => {
      if (record.date === dateStr && record.shift === shift) {
        personnel.push({
          id: record.id,
          name: record.employee_name,
          type: 'parttime',
          station: getStationName(record.assigned_station_id),
          shift: record.shift,
          hours: record.hours
        });
      }
    });

    // Add volunteer personnel
    volunteerRecords.forEach(record => {
      if (record.date === dateStr && record.shift === shift) {
        personnel.push({
          id: record.id,
          name: record.volunteer_name,
          type: 'volunteer',
          station: getStationName(record.assigned_station_id),
          shift: record.shift,
          hours: record.hours
        });
      }
    });

    return personnel;
  };

  // Handle remove personnel
  const handleRemove = (record, type) => {
    setConfirmDialog({ open: true, record, type });
  };

  const confirmRemove = async () => {
    const { record, type } = confirmDialog;
    if (!record || !type) return;

    try {
      let endpoint = '';
      let updateData = {};

      switch (type) {
        case 'overtime':
          endpoint = `/overtime/${record.id}`;
          updateData = { status: 'declined' };
          await api.put(endpoint, updateData);
          break;
        case 'parttime':
          endpoint = `/part-time-availability/${record.id}`;
          updateData = { status: 'declined' };
          await api.put(endpoint, updateData);
          break;
        case 'volunteer':
          endpoint = `/volunteer/${record.id}`;
          updateData = { status: 'declined' };
          await api.put(endpoint, updateData);
          break;
        default:
          throw new Error('Unknown record type');
      }

      toast.success(`${record.name} has been removed from the shift`);
      fetchAllData(); // Refresh data
    } catch (error) {
      console.error('Error removing personnel:', error);
      toast.error('Failed to remove personnel');
    } finally {
      setConfirmDialog({ open: false, record: null, type: null });
    }
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days = [];

    // Add empty cells for days before the first of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({
        day,
        date: dateStr,
        shift: getShiftForDate(dateStr),
        personnel: getPersonnelForDate(dateStr)
      });
    }

    return days;
  };

  const calendarDays = generateCalendarDays();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getShiftColor = (shift) => {
    switch (shift) {
      case 'A': return 'bg-red-500/20 border-red-500';
      case 'B': return 'bg-green-500/20 border-green-500';
      case 'C': return 'bg-blue-500/20 border-blue-500';
      default: return 'bg-muted';
    }
  };

  const getShiftTextColor = (shift) => {
    switch (shift) {
      case 'A': return 'text-red-500';
      case 'B': return 'text-green-500';
      case 'C': return 'text-blue-500';
      default: return '';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'overtime': return 'bg-blue-500/20 text-blue-500 border-blue-500';
      case 'parttime': return 'bg-purple-500/20 text-purple-500 border-purple-500';
      case 'volunteer': return 'bg-green-500/20 text-green-500 border-green-500';
      default: return 'bg-muted';
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'overtime': return 'OT';
      case 'parttime': return 'PT';
      case 'volunteer': return 'Vol';
      default: return '';
    }
  };

  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Count totals for the legend
  const totalOT = overtimeRecords.length;
  const totalPT = partTimeRecords.length;
  const totalVol = volunteerRecords.length;

  return (
    <div className="min-h-screen bg-background" data-testid="calendar-view-page">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-3xl uppercase tracking-wider font-bold flex items-center gap-2">
              <Calendar className="h-8 w-8 text-primary" />
              Calendar View
            </h1>
            <p className="text-muted-foreground mt-1">
              Overview of all scheduled overtime, part-time, and volunteer personnel
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <BattalionSelector />
          </div>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)} data-testid="prev-month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="font-heading text-xl uppercase tracking-wider min-w-[200px] text-center">
              {monthName}
            </h2>
            <Button variant="outline" size="icon" onClick={() => navigateMonth(1)} data-testid="next-month">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={goToToday} className="ml-2">
              Today
            </Button>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-500/20 text-blue-500 border-blue-500">
                <Clock className="h-3 w-3 mr-1" /> OT ({totalOT})
              </Badge>
              <Badge variant="outline" className="bg-purple-500/20 text-purple-500 border-purple-500">
                <Users className="h-3 w-3 mr-1" /> PT ({totalPT})
              </Badge>
              <Badge variant="outline" className="bg-green-500/20 text-green-500 border-green-500">
                <Hand className="h-3 w-3 mr-1" /> Vol ({totalVol})
              </Badge>
            </div>
            <div className="flex items-center gap-2 ml-4 border-l pl-4">
              <Badge variant="outline" className="bg-red-500/20 text-red-500 border-red-500">A Shift</Badge>
              <Badge variant="outline" className="bg-green-500/20 text-green-500 border-green-500">B Shift</Badge>
              <Badge variant="outline" className="bg-blue-500/20 text-blue-500 border-blue-500">C Shift</Badge>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <Card data-testid="calendar-grid">
          <CardContent className="p-0">
            {/* Week Day Headers */}
            <div className="grid grid-cols-7 border-b">
              {weekDays.map(day => (
                <div key={day} className="p-3 text-center font-heading uppercase text-sm border-r last:border-r-0 bg-muted/50">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7">
              {calendarDays.map((dayInfo, index) => (
                <div
                  key={index}
                  className={`min-h-[140px] border-r border-b last:border-r-0 p-2 ${
                    dayInfo ? '' : 'bg-muted/30'
                  }`}
                  data-testid={dayInfo ? `calendar-day-${dayInfo.date}` : `empty-cell-${index}`}
                >
                  {dayInfo && (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`font-bold text-lg ${getShiftTextColor(dayInfo.shift)}`}>
                          {dayInfo.day}
                        </span>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getShiftColor(dayInfo.shift)} ${getShiftTextColor(dayInfo.shift)}`}
                        >
                          {dayInfo.shift}
                        </Badge>
                      </div>
                      
                      {/* Personnel List */}
                      <div className="space-y-1 max-h-[100px] overflow-y-auto">
                        {dayInfo.personnel.map((person, pIdx) => (
                          <ContextMenu key={`${person.type}-${person.id}-${pIdx}`}>
                            <ContextMenuTrigger>
                              <div 
                                className={`text-xs p-1.5 rounded cursor-context-menu border ${getTypeColor(person.type)} hover:opacity-80 transition-opacity`}
                                data-testid={`personnel-${person.type}-${person.id}`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium truncate flex-1">
                                    {person.name}
                                  </span>
                                  <span className="text-[10px] opacity-70 ml-1">
                                    {getTypeLabel(person.type)}
                                  </span>
                                </div>
                                {person.station && (
                                  <div className="text-[10px] opacity-70 mt-0.5">
                                    {person.station}
                                  </div>
                                )}
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                              <ContextMenuItem 
                                className="text-red-500 focus:text-red-500"
                                onClick={() => handleRemove(person, person.type)}
                              >
                                <X className="h-4 w-4 mr-2" />
                                Remove from Shift
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        ))}
                        {dayInfo.personnel.length === 0 && (
                          <p className="text-xs text-muted-foreground italic text-center py-2">
                            No assigned personnel
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-500">{totalOT}</p>
                  <p className="text-sm text-muted-foreground">Overtime Shifts</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Users className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-500">{totalPT}</p>
                  <p className="text-sm text-muted-foreground">Part-Time Shifts</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Hand className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-500">{totalVol}</p>
                  <p className="text-sm text-muted-foreground">Volunteer Shifts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Confirm Remove Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, record: null, type: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Personnel from Shift</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{confirmDialog.record?.name}</strong> from this shift? 
              This will mark their status as declined and remove them from all related assignments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmRemove}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
