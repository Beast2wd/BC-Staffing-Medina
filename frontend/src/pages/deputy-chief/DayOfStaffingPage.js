import { useEffect, useMemo } from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { useStaffing } from '../../context/StaffingContext';
import { BattalionSelector } from '../../components/dashboard/BattalionSelector';
import { Badge } from '../../components/ui/badge';
import { ShiftCalendar } from '../../components/dashboard/ShiftCalendar';

export const DayOfStaffingPage = () => {
  const { 
    stations, 
    personnel, 
    apparatusAssignments, 
    fetchAllData, 
    selectedDate, 
    currentShift,
    selectedBattalion
  } = useStaffing();

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Group assignments by station
  const stationData = useMemo(() => {
    return stations.map(station => {
      const stationPersonnel = personnel.filter(
        p => p.station_id === station.id && p.shift === currentShift
      );
      
      const stationAssignments = apparatusAssignments.filter(
        a => a.station_id === station.id
      );

      // Create apparatus data
      const apparatusData = station.apparatus?.map(appName => {
        const assignment = stationAssignments.find(a => a.apparatus_name === appName);
        const assignedPersonnel = assignment?.personnel_ids?.map(pid => 
          personnel.find(p => p.id === pid)
        ).filter(Boolean) || [];

        return {
          name: appName,
          assigned: assignedPersonnel
        };
      }) || [];

      return {
        station,
        personnel: stationPersonnel,
        apparatus: apparatusData,
        totalAssigned: stationPersonnel.length,
        minimumStaffing: station.minimum_staffing || 3
      };
    });
  }, [stations, personnel, apparatusAssignments, currentShift]);

  const totalPersonnel = stationData.reduce((sum, s) => sum + s.totalAssigned, 0);
  const totalMinimum = stationData.reduce((sum, s) => sum + s.minimumStaffing, 0);

  const getShiftBadgeClass = (shift) => {
    switch (shift) {
      case 'A': return 'bg-red-500 text-white';
      case 'B': return 'bg-green-500 text-white';
      case 'C': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  return (
    <div className="min-h-screen bg-background" data-testid="day-of-staffing-page">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-3xl uppercase tracking-wider font-bold">
              Day of Staffing
            </h1>
            <p className="text-muted-foreground mt-1">
              Complete staffing overview for {selectedDate}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <BattalionSelector />
            <Badge className={`${getShiftBadgeClass(currentShift)} text-lg px-4 py-2`}>
              {currentShift} Shift
            </Badge>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold">{stations.length}</p>
                <p className="text-sm text-muted-foreground">Active Stations</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold">{totalMinimum}</p>
                <p className="text-sm text-muted-foreground">Minimum Required</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-500">{totalPersonnel}</p>
                <p className="text-sm text-muted-foreground">Total Assigned</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className={`text-3xl font-bold ${totalPersonnel >= totalMinimum ? 'text-green-500' : 'text-red-500'}`}>
                  {totalPersonnel - totalMinimum >= 0 ? '+' : ''}{totalPersonnel - totalMinimum}
                </p>
                <p className="text-sm text-muted-foreground">Variance</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-3">
            <ShiftCalendar />
          </div>

          {/* Staffing Details */}
          <div className="lg:col-span-9 space-y-4">
            {stationData.map(({ station, personnel: stationPersonnel, apparatus, totalAssigned, minimumStaffing }) => (
              <Card key={station.id} data-testid={`station-card-${station.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-heading text-xl uppercase">
                      Station {station.station_number}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Min: {minimumStaffing}
                      </span>
                      <Badge className={totalAssigned >= minimumStaffing ? 'bg-green-500' : 'bg-red-500'}>
                        {totalAssigned} assigned
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-40">Apparatus</TableHead>
                        <TableHead>Assigned Personnel</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apparatus.length > 0 ? (
                        apparatus.map((app, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-semibold">{app.name}</TableCell>
                            <TableCell>
                              {app.assigned.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {app.assigned.map(person => (
                                    <span key={person.id} className="text-xs bg-muted px-2 py-1 rounded">
                                      {person.rank} {person.name}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground italic text-sm">
                                  Not assigned
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center text-muted-foreground">
                            No apparatus configured
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  {/* All Personnel at Station */}
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm font-semibold mb-2">All {currentShift} Shift Personnel:</p>
                    <div className="flex flex-wrap gap-2">
                      {stationPersonnel.length > 0 ? (
                        stationPersonnel.map(person => (
                          <span 
                            key={person.id} 
                            className={`text-xs px-2 py-1 rounded border ${
                              person.rank === 'Captain' ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-500' :
                              person.rank === 'Lieutenant' ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-500' :
                              person.rank === 'Battalion Chief' ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-500' :
                              'bg-muted'
                            }`}
                          >
                            {person.rank} {person.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">No personnel assigned to this shift</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};
