import { useEffect, useMemo, useState } from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { useStaffing } from '../../context/StaffingContext';
import { useAuth } from '../../context/AuthContext';
import { BattalionSelector } from '../../components/dashboard/BattalionSelector';
import { Badge } from '../../components/ui/badge';
import { ShiftCalendar } from '../../components/dashboard/ShiftCalendar';
import { formatDisplayDate } from '../../utils/dateUtils';

export const DayOfStaffingPage = () => {
  const { api } = useAuth();
  const { 
    stations, 
    personnel, 
    apparatusAssignments, 
    fetchAllData, 
    selectedDate, 
    currentShift,
    selectedBattalion
  } = useStaffing();
  const [volunteerAssignments, setVolunteerAssignments] = useState([]);
  const [partTimeAssignments, setPartTimeAssignments] = useState([]);

  useEffect(() => {
    fetchAllData();
    fetchVolunteerAssignments();
    fetchPartTimeAssignments();
  }, [fetchAllData, selectedDate, currentShift, selectedBattalion]);

  const fetchVolunteerAssignments = async () => {
    try {
      const response = await api.get('/volunteer-assignments', {
        params: { date: selectedDate, shift: currentShift }
      });
      setVolunteerAssignments(response.data);
    } catch (error) {
      console.error('Error fetching volunteer assignments:', error);
    }
  };

  const fetchPartTimeAssignments = async () => {
    try {
      const response = await api.get('/part-time-availability/assigned', {
        params: { date: selectedDate, battalion_id: selectedBattalion }
      });
      setPartTimeAssignments(response.data);
    } catch (error) {
      console.error('Error fetching part-time assignments:', error);
    }
  };

  // Get part-time employees assigned to a station
  const getStationPartTime = (stationId) => {
    return partTimeAssignments.filter(pt => pt.assigned_station_id === stationId);
  };

  // Get volunteers assigned to a station
  const getStationVolunteers = (stationId) => {
    return volunteerAssignments.filter(v => v.assigned_station_id === stationId);
  };

  // Group assignments by station
  const stationData = useMemo(() => {
    return stations.map(station => {
      const stationPersonnel = personnel.filter(
        p => p.station_id === station.id && p.shift === currentShift
      );
      
      const stationVolunteers = getStationVolunteers(station.id);
      
      const stationAssignments = apparatusAssignments.filter(
        a => a.station_id === station.id
      );

      // Create apparatus data with volunteers included
      const apparatusData = station.apparatus?.map(appName => {
        const assignment = stationAssignments.find(a => a.apparatus_name === appName);
        const assignedPersonnel = assignment?.personnel_ids?.map(pid => {
          // Check regular personnel
          const person = personnel.find(p => p.id === pid);
          if (person) {
            return { 
              ...person, 
              isVolunteer: false,
              position: assignment.position_assignments?.[pid] || '-'
            };
          }
          // Check volunteers
          const volunteer = stationVolunteers.find(v => v.personnel_id === pid);
          if (volunteer) {
            return {
              id: pid,
              name: volunteer.volunteer_name,
              rank: 'Volunteer',
              isVolunteer: true,
              position: assignment.position_assignments?.[pid] || '-'
            };
          }
          // Use personnel_names from API
          if (assignment.personnel_names?.[pid]) {
            const displayName = assignment.personnel_names[pid];
            return {
              id: pid,
              name: displayName.replace('Vol. ', ''),
              rank: displayName.startsWith('Vol.') ? 'Volunteer' : '',
              isVolunteer: displayName.startsWith('Vol.'),
              position: assignment.position_assignments?.[pid] || '-'
            };
          }
          return null;
        }).filter(Boolean).sort((a, b) => {
          const posOrder = {'A': 1, 'B': 2, 'C': 3, 'D': 4, '-': 5};
          return (posOrder[a.position] || 5) - (posOrder[b.position] || 5);
        }) || [];

        return {
          name: appName,
          assigned: assignedPersonnel
        };
      }) || [];

      const stationPartTime = getStationPartTime(station.id);

      return {
        station,
        personnel: stationPersonnel,
        volunteers: stationVolunteers,
        partTime: stationPartTime,
        apparatus: apparatusData,
        totalAssigned: stationPersonnel.length + stationVolunteers.length + stationPartTime.length,
        minimumStaffing: station.minimum_staffing || 3
      };
    });
  }, [stations, personnel, apparatusAssignments, currentShift, volunteerAssignments, partTimeAssignments]);

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
              Complete staffing overview for {formatDisplayDate(selectedDate)}
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
            {stationData.map(({ station, personnel: stationPersonnel, volunteers, partTime, apparatus, totalAssigned, minimumStaffing }) => (
              <Card key={station.id} data-testid={`station-card-${station.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-heading text-xl uppercase flex items-center gap-2">
                      Station {station.station_number}
                      {partTime.length > 0 && (
                        <Badge variant="outline" className="border-purple-500 text-purple-500 text-xs">
                          +{partTime.length} PT
                        </Badge>
                      )}
                      {volunteers.length > 0 && (
                        <Badge variant="outline" className="border-green-500 text-green-500 text-xs">
                          +{volunteers.length} Vol
                        </Badge>
                      )}
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
                                  {app.assigned.map(person => {
                                    const isOfficer = ['Captain', 'Lieutenant', 'Battalion Chief'].includes(person.rank);
                                    return (
                                      <span 
                                        key={person.id} 
                                        className={`text-xs px-2 py-1 rounded flex items-center gap-1 border ${
                                          person.isVolunteer 
                                            ? 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30' 
                                            : isOfficer
                                              ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-500'
                                              : 'bg-muted border-transparent'
                                        }`}
                                      >
                                        {person.position && person.position !== '-' && (
                                          <span className={`font-bold ${
                                            person.isVolunteer ? 'text-green-500' : 
                                            isOfficer ? 'text-yellow-600' : 'text-primary'
                                          }`}>
                                            {person.position}
                                          </span>
                                        )}
                                        {person.isVolunteer ? `Vol. ${person.name}` : `${person.rank} ${person.name}`}
                                      </span>
                                    );
                                  })}
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

                  {/* Part-Time Employees */}
                  {partTime.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-purple-500/30">
                      <p className="text-sm font-semibold mb-2 text-purple-500">Part-Time (+{partTime.length}):</p>
                      <div className="flex flex-wrap gap-2">
                        {partTime.map(pt => (
                          <span 
                            key={pt.id} 
                            className="text-xs px-2 py-1 rounded bg-purple-500/10 border border-purple-500/30 text-purple-600 dark:text-purple-400"
                          >
                            {pt.employee_name} ({pt.hours}h)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

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
