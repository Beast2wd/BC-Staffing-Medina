import { useEffect, useState } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useAuth } from '../context/AuthContext';
import { useStaffing } from '../context/StaffingContext';
import { BattalionSelector } from '../components/dashboard/BattalionSelector';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ChevronLeft, ChevronRight, Users, MapPin } from 'lucide-react';

export const OnDutyPage = () => {
  const { api } = useAuth();
  const { 
    stations, 
    personnel, 
    fetchAllData, 
    selectedDate, 
    setSelectedDate, 
    selectedBattalion,
    currentShift,
    getShiftForDate 
  } = useStaffing();
  const [loading, setLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));
  
  // Shift colors
  const shiftColors = {
    A: 'bg-red-500 text-white',
    B: 'bg-green-500 text-white',
    C: 'bg-blue-500 text-white'
  };

  useEffect(() => {
    fetchAllData();
  }, [selectedBattalion, selectedDate]);

  useEffect(() => {
    setCurrentMonth(new Date(selectedDate));
  }, [selectedDate]);

  const navigateDate = (direction) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + direction);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const navigateMonth = (direction) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + direction);
    setCurrentMonth(newMonth);
  };

  const handleDateClick = (day) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    setSelectedDate(newDate.toISOString().split('T')[0]);
  };

  // Get personnel on duty for the selected shift
  const getOnDutyPersonnel = (stationId) => {
    return personnel.filter(p => 
      p.station_id === stationId && 
      p.shift === currentShift &&
      p.is_active
    );
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const days = [];
    
    // Add empty cells for days before the first of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const shift = getShiftForDate(dateStr);
      days.push({ day, dateStr, shift });
    }
    
    return days;
  };

  const calendarDays = generateCalendarDays();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div className="min-h-screen bg-background" data-testid="on-duty-page">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-3xl uppercase tracking-wider font-bold flex items-center gap-2">
              <Users className="h-8 w-8 text-primary" />
              On Duty
            </h1>
            <p className="text-muted-foreground mt-1">
              Personnel on duty for {selectedDate} - {currentShift} Shift
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Section */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <CardTitle className="font-heading uppercase">
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {dayNames.map(day => (
                  <div key={day} className="text-center text-xs font-medium text-muted-foreground p-1">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((dayInfo, index) => (
                  <div key={index} className="aspect-square">
                    {dayInfo ? (
                      <button
                        onClick={() => handleDateClick(dayInfo.day)}
                        className={`w-full h-full rounded-md flex items-center justify-center text-sm font-medium transition-all
                          ${dayInfo.dateStr === selectedDate 
                            ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' 
                            : ''}
                          ${shiftColors[dayInfo.shift] || 'bg-muted'}
                          hover:opacity-80
                        `}
                        data-testid={`calendar-day-${dayInfo.day}`}
                      >
                        {dayInfo.day}
                      </button>
                    ) : (
                      <div className="w-full h-full" />
                    )}
                  </div>
                ))}
              </div>
              
              {/* Legend */}
              <div className="flex justify-center gap-4 mt-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-500" />
                  <span className="text-xs">A Shift</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500" />
                  <span className="text-xs">B Shift</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-blue-500" />
                  <span className="text-xs">C Shift</span>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-muted rounded-lg text-center">
                <p className="text-sm font-medium">Selected Date</p>
                <p className="text-lg font-bold">{new Date(selectedDate).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</p>
                <p className={`mt-1 inline-block px-3 py-1 rounded-full text-sm font-medium ${shiftColors[currentShift]}`}>
                  {currentShift} Shift
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Stations Personnel Section */}
          <div className="lg:col-span-2 space-y-4">
            {stations.map(station => {
              const onDutyPersonnel = getOnDutyPersonnel(station.id);
              
              return (
                <Card key={station.id} data-testid={`station-card-${station.id}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="font-heading uppercase flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      Station {station.station_number}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {onDutyPersonnel.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">
                        No personnel scheduled for this shift
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {onDutyPersonnel.map(person => (
                          <div 
                            key={person.id} 
                            className="p-3 bg-muted rounded-lg"
                            data-testid={`personnel-card-${person.id}`}
                          >
                            <p className="font-medium text-sm">{person.name}</p>
                            <p className="text-xs text-muted-foreground">{person.rank}</p>
                            {person.certifications?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {person.certifications.slice(0, 2).map((cert, idx) => (
                                  <span 
                                    key={idx} 
                                    className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded"
                                  >
                                    {cert}
                                  </span>
                                ))}
                                {person.certifications.length > 2 && (
                                  <span className="text-xs text-muted-foreground">
                                    +{person.certifications.length - 2}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
};
