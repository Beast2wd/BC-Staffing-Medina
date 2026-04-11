import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Input } from '../ui/input';
import { useStaffing } from '../../context/StaffingContext';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { formatDisplayDate } from '../../utils/dateUtils';

const STAFFING_CATEGORIES = [
  { key: 'minimum_staffing', label: 'Minimum Staffing:', isHeader: true, editable: true, isStationField: true },
  { key: 'personnel_assigned', label: 'Personnel Assigned (+)', className: 'font-semibold', editable: false },
  { key: 'volunteer', label: 'Volunteer (+)', className: 'text-green-500', editable: true },
  { key: 'overtime', label: 'Overtime (+)', className: 'text-blue-500', editable: true },
  { key: 'hold_over', label: 'Hold Over* (+)', editable: true },
  { key: 'out_of_battalion_fill_in_plus', label: 'Out of Battalion Fill In (+)', className: 'text-blue-500', editable: true },
  { key: 'out_of_battalion_fill_in_minus', label: 'Out of Battalion Fill In (-)', className: 'text-blue-500', editable: true },
  { key: 'holiday', label: 'HOLIDAY (-)', className: 'text-red-500', editable: true, leaveType: 'holiday' },
  { key: 'fmla', label: 'FMLA (-)', className: 'text-red-500', editable: true },
  { key: 'vacation', label: 'VACATION (-)', className: 'text-red-500', editable: true, leaveType: 'vacation' },
  { key: 'sick', label: 'SICK (-)', className: 'text-red-500', editable: true, leaveType: 'sick' },
  { key: 'injured_on_duty', label: 'Injured On Duty (-)', className: 'text-red-500', editable: true },
  { key: 'scheduled_other', label: 'Scheduled Other (-)', className: 'text-red-500', editable: true },
  { key: 'unscheduled_other', label: 'UnScheduled Other (-)', className: 'text-red-500', editable: true },
  { key: 'sap_adjusted', label: 'SAP Adjusted Personnel (+/-)', className: 'text-yellow-500', editable: true },
  { key: 'in_battalion_fill_in_minus', label: 'In Battalion Fill In (-)', className: 'text-blue-500', editable: true },
  { key: 'in_battalion_fill_in_plus', label: 'In Battalion Fill In (+)', className: 'text-blue-500', editable: true },
  { key: 'total_on_duty', label: 'Total Personnel On Duty:', isFooter: true, className: 'font-bold', editable: false },
  { key: 'variance', label: 'Stations Even/Over/Under:', isFooter: true, editable: false },
];

export const StaffingGrid = () => {
  const { 
    stations, 
    staffingRecords, 
    personnel,
    leaveRecords,
    currentShift,
    selectedDate,
    selectedBattalion,
    fetchStaffingRecords,
    fetchStations
  } = useStaffing();
  const { api, canEdit } = useAuth();
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');

  // Calculate leave counts by station and type
  const leaveCounts = useMemo(() => {
    const counts = {};
    
    // Only count approved leave records
    const approvedLeaves = leaveRecords.filter(l => l.status === 'approved');
    
    approvedLeaves.forEach(leave => {
      // Check if the selected date falls within the leave period
      if (selectedDate >= leave.start_date && selectedDate <= leave.end_date) {
        // Find the personnel to get their station
        const person = personnel.find(p => p.id === leave.personnel_id);
        if (person && person.station_id) {
          const stationId = person.station_id;
          const leaveType = leave.leave_type; // 'vacation', 'sick', 'holiday'
          
          if (!counts[stationId]) {
            counts[stationId] = { vacation: 0, sick: 0, holiday: 0 };
          }
          counts[stationId][leaveType] = (counts[stationId][leaveType] || 0) + 1;
        }
      }
    });
    
    return counts;
  }, [leaveRecords, personnel, selectedDate]);

  // Calculate data for each station
  const gridData = useMemo(() => {
    const data = {};
    const totals = {};

    // Initialize totals
    STAFFING_CATEGORIES.forEach(cat => {
      totals[cat.key] = 0;
    });

    stations.forEach(station => {
      const stationData = {};
      const record = staffingRecords.find(r => r.station_id === station.id);
      const stationPersonnel = personnel.filter(p => 
        p.station_id === station.id && p.shift === currentShift
      );

      // Minimum staffing from station config
      stationData.minimum_staffing = station.minimum_staffing || 3;
      totals.minimum_staffing += stationData.minimum_staffing;

      // Personnel assigned (count of active personnel on shift)
      stationData.personnel_assigned = stationPersonnel.length;
      totals.personnel_assigned += stationData.personnel_assigned;

      // Store record ID for updates
      stationData._recordId = record?.id;

      // Get categories from record or default to 0
      STAFFING_CATEGORIES.forEach(cat => {
        if (cat.key !== 'minimum_staffing' && cat.key !== 'personnel_assigned' && 
            cat.key !== 'total_on_duty' && cat.key !== 'variance') {
          // For vacation, sick, holiday - use leave records count if available
          if (cat.leaveType && leaveCounts[station.id]?.[cat.leaveType]) {
            stationData[cat.key] = leaveCounts[station.id][cat.leaveType];
          } else {
            stationData[cat.key] = record?.categories?.[cat.key] || 0;
          }
          totals[cat.key] = (totals[cat.key] || 0) + stationData[cat.key];
        }
      });

      // Calculate total on duty
      const additions = (stationData.personnel_assigned || 0) +
        (stationData.volunteer || 0) +
        (stationData.overtime || 0) +
        (stationData.hold_over || 0) +
        (stationData.out_of_battalion_fill_in_plus || 0) +
        (stationData.in_battalion_fill_in_plus || 0);

      const subtractions = (stationData.out_of_battalion_fill_in_minus || 0) +
        (stationData.holiday || 0) +
        (stationData.fmla || 0) +
        (stationData.vacation || 0) +
        (stationData.sick || 0) +
        (stationData.injured_on_duty || 0) +
        (stationData.scheduled_other || 0) +
        (stationData.unscheduled_other || 0) +
        (stationData.in_battalion_fill_in_minus || 0);

      stationData.total_on_duty = additions - subtractions + (stationData.sap_adjusted || 0);
      stationData.variance = stationData.total_on_duty - stationData.minimum_staffing;

      totals.total_on_duty += stationData.total_on_duty;
      totals.variance += stationData.variance;

      data[station.id] = stationData;
    });

    return { data, totals };
  }, [stations, staffingRecords, personnel, currentShift, leaveCounts]);

  const handleCellClick = (stationId, categoryKey, currentValue) => {
    if (!canEdit) return;
    const category = STAFFING_CATEGORIES.find(c => c.key === categoryKey);
    if (!category?.editable) return;
    
    setEditingCell({ stationId, categoryKey });
    setEditValue(currentValue?.toString() || '0');
  };

  const handleCellSave = async () => {
    if (!editingCell) return;
    
    const { stationId, categoryKey } = editingCell;
    const newValue = parseInt(editValue) || 0;
    const category = STAFFING_CATEGORIES.find(c => c.key === categoryKey);
    
    try {
      // Handle minimum staffing update (station field)
      if (category?.isStationField) {
        const station = stations.find(s => s.id === stationId);
        await api.put(`/stations/${stationId}`, {
          station_number: station?.station_number,
          name: station?.name,
          battalion_id: station?.battalion_id || selectedBattalion,
          minimum_staffing: newValue,
          apparatus: station?.apparatus || []
        });
        toast.success('Minimum staffing updated');
        fetchStations(); // Refresh stations to reflect the change
        setEditingCell(null);
        setEditValue('');
        return;
      }
      
      // Handle regular staffing record update
      const record = staffingRecords.find(r => r.station_id === stationId);
      
      if (record) {
        // Update existing record
        const updatedCategories = { ...record.categories, [categoryKey]: newValue };
        await api.put(`/staffing/${record.id}`, { categories: updatedCategories });
      } else {
        // Create new record
        await api.post('/staffing', {
          date: selectedDate,
          station_id: stationId,
          battalion_id: selectedBattalion,
          shift: currentShift,
          personnel_assigned: [],
          categories: { [categoryKey]: newValue },
          remarks: ''
        });
      }
      
      toast.success('Staffing updated');
      fetchStaffingRecords();
    } catch (error) {
      toast.error('Failed to update staffing');
      console.error(error);
    }
    
    setEditingCell(null);
    setEditValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleCellSave();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
    }
  };

  const getShiftBadgeClass = (shift) => {
    switch (shift) {
      case 'A': return 'bg-red-500 text-white';
      case 'B': return 'bg-green-500 text-white';
      case 'C': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getVarianceClass = (variance) => {
    if (variance > 0) return 'text-white';      // Over staffed - white
    if (variance < 0) return 'text-red-500';    // Under staffed - red
    return 'text-green-500';                     // Even - green
  };

  const formatVariance = (value) => {
    if (value > 0) return `+${value}`;
    if (value < 0) return `${value}`;  // Already has minus sign
    return value;
  };

  return (
    <Card className="h-full" data-testid="staffing-grid">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading text-lg uppercase tracking-wider">
            Stations
          </CardTitle>
          <Badge className={getShiftBadgeClass(currentShift)}>
            {currentShift} Shift - {formatDisplayDate(selectedDate)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="staffing-grid text-xs">
            <TableHeader>
              <TableRow className="bg-muted">
                <TableHead className="sticky left-0 bg-muted z-10 min-w-[200px]">STATIONS:</TableHead>
                {stations.map(station => (
                  <TableHead key={station.id} className="text-center min-w-[60px]">
                    {station.station_number}
                  </TableHead>
                ))}
                <TableHead className="text-center font-bold min-w-[60px]">Totals</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {STAFFING_CATEGORIES.map((category, idx) => (
                <TableRow 
                  key={category.key}
                  className={`
                    ${category.isHeader ? 'bg-muted font-semibold' : ''}
                    ${category.isFooter ? 'bg-muted font-semibold border-t-2' : ''}
                  `}
                  data-testid={`category-row-${category.key}`}
                >
                  <TableCell className={`sticky left-0 bg-card z-10 ${category.className || ''}`}>
                    {category.label}
                  </TableCell>
                  {stations.map(station => {
                    const value = gridData.data[station.id]?.[category.key] || 0;
                    const displayValue = value !== 0 || category.isHeader || category.isFooter ? value : '';
                    const isEditing = editingCell?.stationId === station.id && editingCell?.categoryKey === category.key;
                    const isEditable = category.editable && canEdit;
                    const formattedValue = category.key === 'variance' ? formatVariance(value) : displayValue;
                    
                    return (
                      <TableCell 
                        key={station.id} 
                        className={`text-center ${
                          category.key === 'variance' ? getVarianceClass(value) : ''
                        } ${isEditable ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
                        onClick={() => handleCellClick(station.id, category.key, value)}
                        data-testid={`cell-${station.id}-${category.key}`}
                      >
                        {isEditing ? (
                          <Input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCellSave}
                            onKeyDown={handleKeyDown}
                            className="w-12 h-6 text-center p-0 text-xs"
                            autoFocus
                            data-testid={`edit-input-${station.id}-${category.key}`}
                          />
                        ) : (
                          formattedValue
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className={`text-center font-bold ${
                    category.key === 'variance' ? getVarianceClass(gridData.totals[category.key]) : ''
                  }`}>
                    {category.key === 'variance' ? formatVariance(gridData.totals[category.key] || 0) : (gridData.totals[category.key] || 0)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
