import { useEffect, useState, useCallback } from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../context/AuthContext';
import { useStaffing } from '../../context/StaffingContext';
import { BattalionSelector } from '../../components/dashboard/BattalionSelector';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Calendar, Clock, Hand, Users, X, Building2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

export const CalendarViewPage = () => {
  const { api } = useAuth();
  const { stations, selectedBattalion, getShiftForDate } = useStaffing();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [overtimeRecords, setOvertimeRecords] = useState([]);
  const [partTimeRecords, setPartTimeRecords] = useState([]);
  const [volunteerRecords, setVolunteerRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, record: null, type: null });
  const [selectedStation, setSelectedStation] = useState('all');

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
      // Fetch overtime records - need to enrich with personnel names
      const otResponse = await api.get('/overtime', {
        params: { start_date: start, end_date: end }
      });
      // Filter for assigned only and within date range
      const assignedOT = otResponse.data.filter(r => {
        if (r.status !== 'assigned') return false;
        return r.date >= start && r.date <= end;
      });
      
      // Enrich overtime with personnel names
      const enrichedOT = await Promise.all(assignedOT.map(async (record) => {
        try {
          const personnelResponse = await api.get(`/personnel/${record.personnel_id}`);
          return {
            ...record,
            personnel_name: personnelResponse.data?.name || 'Unknown',
            shift: record.shift || record.assigned_shift || ''
          };
        } catch {
          return { ...record, personnel_name: 'Unknown', shift: record.shift || '' };
        }
      }));
      setOvertimeRecords(enrichedOT);

      // Fetch part-time records (assigned only)
      const ptResponse = await api.get('/part-time-availability/all');
      const filteredPT = ptResponse.data.filter(r => {
        if (r.status !== 'assigned') return false;
        const recordDate = r.date;
        return recordDate >= start && recordDate <= end;
      });
      setPartTimeRecords(filteredPT);

      // Fetch volunteer records
      const volResponse = await api.get('/volunteer', {
        params: { start_date: start, end_date: end }
      });
      
      const assignedVol = volResponse.data.filter(r => {
        if (r.status !== 'assigned') return false;
        return r.date >= start && r.date <= end;
      });
      
      // Enrich volunteer records with names
      const enrichedVol = await Promise.all(assignedVol.map(async (record) => {
        try {
          const enrichedResponse = await api.get('/volunteer-assignments', {
            params: { date: record.date }
          });
          const enrichedRecord = enrichedResponse.data.find(r => r.id === record.id);
          if (enrichedRecord) {
            return {
              ...record,
              ...enrichedRecord,
              shift: enrichedRecord.assigned_shift || record.assigned_shift || ''
            };
          }
        } catch {
          // Fallback
        }
        return { 
          ...record, 
          volunteer_name: 'Volunteer',
          shift: record.assigned_shift || ''
        };
      }));
      setVolunteerRecords(enrichedVol);

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
    return station ? station.station_number : '';
  };

  // Get all personnel for a specific date grouped by station
  const getPersonnelByStation = (dateStr) => {
    const byStation = {};
    
    // Initialize all stations
    stations.forEach(station => {
      byStation[station.id] = {
        stationId: station.id,
        stationNumber: station.station_number,
        personnel: []
      };
    });

    // Add overtime personnel
    overtimeRecords.forEach(record => {
      if (record.date === dateStr) {
        const stationId = record.overtime_station_id || record.station_id;
        if (byStation[stationId]) {
          byStation[stationId].personnel.push({
            id: record.id,
            name: record.personnel_name || 'Unknown',
            type: 'overtime',
            shift: record.shift || record.assigned_shift || '',
            hours: record.hours
          });
        }
      }
    });

    // Add part-time personnel
    partTimeRecords.forEach(record => {
      if (record.date === dateStr) {
        const stationId = record.assigned_station_id;
        if (byStation[stationId]) {
          byStation[stationId].personnel.push({
            id: record.id,
            name: record.employee_name || 'Unknown',
            type: 'parttime',
            shift: record.shift || '',
            hours: record.hours
          });
        }
      }
    });

    // Add volunteer personnel
    volunteerRecords.forEach(record => {
      if (record.date === dateStr) {
        const stationId = record.assigned_station_id;
        if (byStation[stationId]) {
          byStation[stationId].personnel.push({
            id: record.id,
            name: record.volunteer_name || 'Volunteer',
            type: 'volunteer',
            shift: record.assigned_shift || record.shift || '',
            hours: record.hours
          });
        }
      }
    });

    return byStation;
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
      fetchAllData();
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
        personnelByStation: getPersonnelByStation(dateStr)
      });
    }

    return days;
  };

  const calendarDays = generateCalendarDays();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getShiftTextColor = (shift) => {
    switch (shift) {
      case 'A': return 'text-red-500';
      case 'B': return 'text-green-500';
      case 'C': return 'text-blue-500';
      default: return '';
    }
  };

  const getShiftBorderColor = (shift) => {
    switch (shift) {
      case 'A': return 'border-red-500';
      case 'B': return 'border-green-500';
      case 'C': return 'border-blue-500';
      default: return 'border-muted';
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

  // Count totals
  const totalOT = overtimeRecords.length;
  const totalPT = partTimeRecords.length;
  const totalVol = volunteerRecords.length;

  // Filter stations for display
  const displayStations = selectedStation === 'all' 
    ? stations 
    : stations.filter(s => s.id === selectedStation);

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
              Overview by station - overtime, part-time, and volunteer personnel
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <BattalionSelector />
          </div>
        </div>

        {/* Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          {/* Month Navigation */}
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

          {/* Station Filter */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedStation} onValueChange={setSelectedStation}>
                <SelectTrigger className="w-[160px]" data-testid="station-filter">
                  <SelectValue placeholder="All Stations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stations</SelectItem>
                  {stations.map(station => (
                    <SelectItem key={station.id} value={station.id}>
                      Station {station.station_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-2 border-l pl-4">
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
                  className={`min-h-[180px] border-r border-b last:border-r-0 p-2 ${
                    dayInfo ? '' : 'bg-muted/30'
                  }`}
                  data-testid={dayInfo ? `calendar-day-${dayInfo.date}` : `empty-cell-${index}`}
                >
                  {dayInfo && (
                    <>
                      {/* Day Header */}
                      <div className="flex items-center justify-between mb-2">
                        <span className={`font-bold text-lg ${getShiftTextColor(dayInfo.shift)}`}>
                          {dayInfo.day}
                        </span>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getShiftTextColor(dayInfo.shift)} ${getShiftBorderColor(dayInfo.shift)}`}
                        >
                          {dayInfo.shift}
                        </Badge>
                      </div>
                      
                      {/* Stations with Personnel */}
                      <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                        {displayStations.map(station => {
                          const stationData = dayInfo.personnelByStation[station.id];
                          if (!stationData || stationData.personnel.length === 0) return null;
                          
                          return (
                            <div 
                              key={station.id} 
                              className="bg-muted/30 rounded p-1.5"
                              data-testid={`station-${station.id}-day-${dayInfo.date}`}
                            >
                              {/* Station Header */}
                              <div className="text-[10px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                Sta {station.station_number}
                              </div>
                              
                              {/* Personnel List */}
                              <div className="space-y-0.5">
                                {stationData.personnel.map((person, pIdx) => (
                                  <ContextMenu key={`${person.type}-${person.id}-${pIdx}`}>
                                    <ContextMenuTrigger>
                                      <div 
                                        className={`text-[11px] px-1.5 py-0.5 rounded cursor-context-menu border ${getTypeColor(person.type)} hover:opacity-80 transition-opacity`}
                                        data-testid={`personnel-${person.type}-${person.id}`}
                                      >
                                        <div className="flex items-center justify-between gap-1">
                                          <span className="font-medium truncate">
                                            {person.name}
                                          </span>
                                          <span className="text-[9px] opacity-70 shrink-0">
                                            {getTypeLabel(person.type)}
                                          </span>
                                        </div>
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
                              </div>
                            </div>
                          );
                        })}
                        
                        {/* Show message if no personnel for displayed stations */}
                        {displayStations.every(station => 
                          !dayInfo.personnelByStation[station.id]?.personnel?.length
                        ) && (
                          <p className="text-[10px] text-muted-foreground italic text-center py-2">
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

        {/* Summary Stats by Station */}
        <div className="mt-6">
          <h3 className="font-heading text-lg uppercase tracking-wider mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Summary by Station
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {stations.map(station => {
              // Count personnel for this station
              const otCount = overtimeRecords.filter(r => 
                (r.overtime_station_id || r.station_id) === station.id
              ).length;
              const ptCount = partTimeRecords.filter(r => 
                r.assigned_station_id === station.id
              ).length;
              const volCount = volunteerRecords.filter(r => 
                r.assigned_station_id === station.id
              ).length;
              const total = otCount + ptCount + volCount;

              return (
                <Card 
                  key={station.id} 
                  className={`cursor-pointer transition-all hover:border-primary ${
                    selectedStation === station.id ? 'border-primary ring-1 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedStation(selectedStation === station.id ? 'all' : station.id)}
                >
                  <CardContent className="p-3">
                    <div className="text-center">
                      <p className="font-heading text-sm uppercase tracking-wider text-muted-foreground">
                        Station
                      </p>
                      <p className="text-2xl font-bold">{station.station_number}</p>
                      <div className="flex justify-center gap-1 mt-2">
                        {otCount > 0 && (
                          <Badge variant="outline" className="text-[10px] px-1 bg-blue-500/20 text-blue-500 border-blue-500">
                            {otCount} OT
                          </Badge>
                        )}
                        {ptCount > 0 && (
                          <Badge variant="outline" className="text-[10px] px-1 bg-purple-500/20 text-purple-500 border-purple-500">
                            {ptCount} PT
                          </Badge>
                        )}
                        {volCount > 0 && (
                          <Badge variant="outline" className="text-[10px] px-1 bg-green-500/20 text-green-500 border-green-500">
                            {volCount} Vol
                          </Badge>
                        )}
                      </div>
                      {total === 0 && (
                        <p className="text-[10px] text-muted-foreground mt-2">No assignments</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
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
