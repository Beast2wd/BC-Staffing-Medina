import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { useStaffing } from '../../context/StaffingContext';
import { Badge } from '../ui/badge';

const STAFFING_CATEGORIES = [
  { key: 'minimum_staffing', label: 'Minimum Staffing:', isHeader: true },
  { key: 'personnel_assigned', label: 'Personnel Assigned (+)', className: 'font-semibold' },
  { key: 'debit_day', label: 'Debit Day(+)' },
  { key: 'overtime_cr', label: 'Overtime/CR Personnel(P) (+)', className: 'text-blue-500' },
  { key: 'hold_over', label: 'Hold Over* (+)' },
  { key: 'out_of_district_fill_in_plus', label: 'Out Of District Fill In (+)', className: 'text-blue-500' },
  { key: 'out_of_district_fill_in_minus', label: 'Out Of District Fill In (-)', className: 'text-blue-500' },
  { key: 'prescheduled_holidays', label: 'Prescheduled Holidays (-)', className: 'text-red-500' },
  { key: 'guaranteed_holiday', label: 'Guaranteed Holiday* (-)', className: 'text-red-500' },
  { key: 'day_of_holidays', label: 'Day-of Holidays (-)', className: 'text-red-500' },
  { key: 'fmla', label: 'FMLA (-)', className: 'text-red-500' },
  { key: 'vac_emergency', label: 'Vac-Emergency (-)', className: 'text-red-500' },
  { key: 'vac_scheduled', label: 'Vac-Scheduled (-)', className: 'text-red-500' },
  { key: 'vac_scheduled_debit', label: 'Vac-Scheduled Debit (-)', className: 'text-red-500' },
  { key: 'sick_member', label: 'Sick-member (-)', className: 'text-red-500' },
  { key: 'sick_family', label: 'Sick-family (-)', className: 'text-red-500' },
  { key: 'injured_on_duty', label: 'scheduled or unScheduled Injured On Duty (-)', className: 'text-red-500' },
  { key: 'scheduled_other', label: 'Scheduled Other (-)', className: 'text-red-500' },
  { key: 'unscheduled_other', label: 'UnScheduled Other (-)', className: 'text-red-500' },
  { key: 'ems_adjusted', label: 'EMS Adjusted Personnel (-)', className: 'text-red-500' },
  { key: 'sap_adjusted', label: 'SAP Adjusted Personnel (+/-)', className: 'text-yellow-500' },
  { key: 'in_district_fill_in_minus', label: 'IN DISTRICT Fill In (-)', className: 'text-blue-500' },
  { key: 'in_district_fill_in_plus', label: 'IN DISTRICT Fill In (+)', className: 'text-blue-500' },
  { key: 'total_on_duty', label: 'Total Personnel On Duty:', isFooter: true, className: 'font-bold' },
  { key: 'variance', label: 'Stations Even/Over/Under:', isFooter: true },
];

export const StaffingGrid = () => {
  const { 
    stations, 
    staffingRecords, 
    personnel,
    currentShift,
    selectedDate 
  } = useStaffing();

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

      // Get categories from record or default to 0
      STAFFING_CATEGORIES.forEach(cat => {
        if (cat.key !== 'minimum_staffing' && cat.key !== 'personnel_assigned' && 
            cat.key !== 'total_on_duty' && cat.key !== 'variance') {
          stationData[cat.key] = record?.categories?.[cat.key] || 0;
          totals[cat.key] = (totals[cat.key] || 0) + stationData[cat.key];
        }
      });

      // Calculate total on duty
      const additions = (stationData.personnel_assigned || 0) +
        (stationData.debit_day || 0) +
        (stationData.overtime_cr || 0) +
        (stationData.hold_over || 0) +
        (stationData.out_of_district_fill_in_plus || 0) +
        (stationData.in_district_fill_in_plus || 0);

      const subtractions = (stationData.out_of_district_fill_in_minus || 0) +
        (stationData.prescheduled_holidays || 0) +
        (stationData.guaranteed_holiday || 0) +
        (stationData.day_of_holidays || 0) +
        (stationData.fmla || 0) +
        (stationData.vac_emergency || 0) +
        (stationData.vac_scheduled || 0) +
        (stationData.vac_scheduled_debit || 0) +
        (stationData.sick_member || 0) +
        (stationData.sick_family || 0) +
        (stationData.injured_on_duty || 0) +
        (stationData.scheduled_other || 0) +
        (stationData.unscheduled_other || 0) +
        (stationData.ems_adjusted || 0) +
        (stationData.in_district_fill_in_minus || 0);

      stationData.total_on_duty = additions - subtractions + (stationData.sap_adjusted || 0);
      stationData.variance = stationData.total_on_duty - stationData.minimum_staffing;

      totals.total_on_duty += stationData.total_on_duty;
      totals.variance += stationData.variance;

      data[station.id] = stationData;
    });

    return { data, totals };
  }, [stations, staffingRecords, personnel, currentShift]);

  const getShiftBadgeClass = (shift) => {
    switch (shift) {
      case 'A': return 'bg-red-500 text-white';
      case 'B': return 'bg-green-500 text-white';
      case 'C': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getVarianceClass = (variance) => {
    if (variance > 0) return 'text-green-500';
    if (variance < 0) return 'text-red-500';
    return '';
  };

  return (
    <Card className="h-full" data-testid="staffing-grid">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading text-lg uppercase tracking-wider">
            Stations
          </CardTitle>
          <Badge className={getShiftBadgeClass(currentShift)}>
            {currentShift} Shift - {selectedDate}
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
                    
                    return (
                      <TableCell 
                        key={station.id} 
                        className={`text-center ${
                          category.key === 'variance' ? getVarianceClass(value) : ''
                        }`}
                      >
                        {displayValue}
                      </TableCell>
                    );
                  })}
                  <TableCell className={`text-center font-bold ${
                    category.key === 'variance' ? getVarianceClass(gridData.totals[category.key]) : ''
                  }`}>
                    {gridData.totals[category.key] || 0}
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
