import { useState, useMemo } from 'react';
import { Calendar } from '../ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useStaffing } from '../../context/StaffingContext';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const ShiftCalendar = () => {
  const { selectedDate, setSelectedDate, getShiftForDate, currentShift } = useStaffing();
  const [displayMonth, setDisplayMonth] = useState(new Date(selectedDate));

  const selectedDateObj = new Date(selectedDate + 'T00:00:00');

  const handleDateSelect = (date) => {
    if (date) {
      const dateStr = date.toISOString().split('T')[0];
      setSelectedDate(dateStr);
    }
  };

  const handleMonthChange = (month) => {
    setDisplayMonth(month);
  };

  const handleYearChange = (year) => {
    const newDate = new Date(displayMonth);
    newDate.setFullYear(parseInt(year));
    setDisplayMonth(newDate);
  };

  const handleMonthSelect = (month) => {
    const newDate = new Date(displayMonth);
    newDate.setMonth(parseInt(month));
    setDisplayMonth(newDate);
  };

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 10 }, (_, i) => currentYear - 2 + i);
  }, []);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Custom day render with shift colors
  const modifiers = useMemo(() => {
    const shiftA = [];
    const shiftB = [];
    const shiftC = [];

    // Generate dates for the current display month range
    const startDate = new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1);
    const endDate = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 2, 0);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const shift = getShiftForDate(dateStr);
      const dateCopy = new Date(d);
      
      if (shift === 'A') shiftA.push(dateCopy);
      else if (shift === 'B') shiftB.push(dateCopy);
      else if (shift === 'C') shiftC.push(dateCopy);
    }

    return { shiftA, shiftB, shiftC };
  }, [displayMonth, getShiftForDate]);

  const modifiersStyles = {
    shiftA: {
      backgroundColor: 'rgba(239, 68, 68, 0.2)',
      borderRadius: '50%',
    },
    shiftB: {
      backgroundColor: 'rgba(34, 197, 94, 0.2)',
      borderRadius: '50%',
    },
    shiftC: {
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
      borderRadius: '50%',
    },
  };

  const getShiftBadgeClass = (shift) => {
    switch (shift) {
      case 'A': return 'bg-red-500 text-white';
      case 'B': return 'bg-green-500 text-white';
      case 'C': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  return (
    <Card className="h-full" data-testid="shift-calendar">
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-lg uppercase tracking-wider flex items-center justify-between">
          <span>Select A Day</span>
          <span className={`text-sm px-3 py-1 rounded-full ${getShiftBadgeClass(currentShift)}`}>
            {currentShift} Shift
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Month/Year Selectors */}
        <div className="flex gap-2">
          <Select value={displayMonth.getMonth().toString()} onValueChange={handleMonthSelect}>
            <SelectTrigger className="flex-1" data-testid="month-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((month, idx) => (
                <SelectItem key={idx} value={idx.toString()}>{month}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={displayMonth.getFullYear().toString()} onValueChange={handleYearChange}>
            <SelectTrigger className="w-24" data-testid="year-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => handleMonthChange(new Date(displayMonth.setMonth(displayMonth.getMonth() - 1)))}
            data-testid="prev-month"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="font-heading font-semibold">
            {months[displayMonth.getMonth()]} {displayMonth.getFullYear()}
          </span>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => handleMonthChange(new Date(displayMonth.setMonth(displayMonth.getMonth() + 1)))}
            data-testid="next-month"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Calendar */}
        <Calendar
          mode="single"
          selected={selectedDateObj}
          onSelect={handleDateSelect}
          month={displayMonth}
          onMonthChange={handleMonthChange}
          modifiers={modifiers}
          modifiersStyles={modifiersStyles}
          className="rounded-md border"
          data-testid="calendar"
        />

        {/* Legend */}
        <div className="flex justify-center gap-4 pt-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500/30 border border-red-500" />
            <span className="text-xs text-muted-foreground">A Shift</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500/30 border border-green-500" />
            <span className="text-xs text-muted-foreground">B Shift</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500/30 border border-blue-500" />
            <span className="text-xs text-muted-foreground">C Shift</span>
          </div>
        </div>

        {/* Selected Date Info */}
        <div className="text-center p-3 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">Selected Date</p>
          <p className="font-heading text-lg font-semibold">
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
