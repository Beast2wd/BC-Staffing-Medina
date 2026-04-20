import { useEffect, useState } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useAuth } from '../context/AuthContext';
import { useStaffing } from '../context/StaffingContext';
import { BattalionSelector } from '../components/dashboard/BattalionSelector';
import { ShiftCalendar } from '../components/dashboard/ShiftCalendar';
import { Users, MapPin, Truck, Hand, Clock } from 'lucide-react';
import { formatDisplayDate } from '../utils/dateUtils';
import { Badge } from '../components/ui/badge';

export const OnDutyPage = () => {
  const { api } = useAuth();
  const { 
    stations, 
    personnel, 
    fetchAllData, 
    selectedDate, 
    selectedBattalion,
    currentShift
  } = useStaffing();
  const [loading, setLoading] = useState(false);
  const [apparatusAssignments, setApparatusAssignments] = useState([]);
  const [volunteerAssignments, setVolunteerAssignments] = useState([]);
  const [partTimeAssignments, setPartTimeAssignments] = useState([]);

  useEffect(() => {
    fetchAllData();
    fetchApparatusAssignments();
    fetchVolunteerAssignments();
    fetchPartTimeAssignments();
  }, [selectedBattalion, selectedDate]);

  const fetchApparatusAssignments = async () => {
    try {
      const response = await api.get('/apparatus-assignments', {
        params: { date: selectedDate, battalion_id: selectedBattalion }
      });
      setApparatusAssignments(response.data);
    } catch (error) {
      console.error('Error fetching apparatus assignments:', error);
    }
  };

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

  // Get personnel on duty for the selected shift
  const getOnDutyPersonnel = (stationId) => {
    return personnel.filter(p => 
      p.station_id === stationId && 
      p.shift === currentShift &&
      p.is_active
    );
  };

  // Get apparatus assignments for a station with personnel grouped and sorted by position
  const getStationApparatusWithPersonnel = (stationId) => {
    const stationApparatusAssignments = apparatusAssignments.filter(a => a.station_id === stationId);
    const onDutyPersonnel = getOnDutyPersonnel(stationId);
    const stationVolunteers = getStationVolunteers(stationId);
    const station = stations.find(s => s.id === stationId);
    const stationApparatusList = station?.apparatus || [];
    
    // Build apparatus groups with assigned personnel
    const apparatusGroups = [];
    const assignedPersonnelIds = new Set();
    
    // First, process apparatus with assignments
    stationApparatusList.forEach(apparatusName => {
      const assignment = stationApparatusAssignments.find(a => a.apparatus_name === apparatusName);
      
      if (assignment && assignment.personnel_ids?.length > 0) {
        const personnelWithPositions = assignment.personnel_ids.map(pid => {
          // Check regular personnel
          const person = personnel.find(p => p.id === pid);
          if (person) {
            const position = assignment.position_assignments?.[pid] || 'Z';
            assignedPersonnelIds.add(pid);
            return { ...person, position, isVolunteer: false };
          }
          
          // Check volunteers
          const volunteer = stationVolunteers.find(v => v.personnel_id === pid);
          if (volunteer) {
            const position = assignment.position_assignments?.[pid] || 'Z';
            assignedPersonnelIds.add(pid);
            return { 
              id: pid, 
              name: volunteer.volunteer_name, 
              rank: 'Volunteer',
              position, 
              isVolunteer: true 
            };
          }
          
          // Check assignment's personnel_names
          if (assignment.personnel_names?.[pid]) {
            const position = assignment.position_assignments?.[pid] || 'Z';
            assignedPersonnelIds.add(pid);
            const displayName = assignment.personnel_names[pid];
            return { 
              id: pid, 
              name: displayName.replace('Vol. ', ''), 
              rank: displayName.startsWith('Vol.') ? 'Volunteer' : '',
              position, 
              isVolunteer: displayName.startsWith('Vol.') 
            };
          }
          
          return null;
        }).filter(p => p).sort((a, b) => a.position.localeCompare(b.position));
        
        apparatusGroups.push({
          name: apparatusName,
          personnel: personnelWithPositions
        });
      }
    });
    
    // Get unassigned personnel (regular personnel only)
    const unassignedPersonnel = onDutyPersonnel.filter(p => !assignedPersonnelIds.has(p.id));
    
    // Get unassigned volunteers (volunteers not assigned to any apparatus)
    const unassignedVolunteers = stationVolunteers
      .filter(v => !assignedPersonnelIds.has(v.personnel_id))
      .map(v => ({
        id: v.personnel_id,
        name: v.volunteer_name,
        rank: 'Volunteer',
        isVolunteer: true
      }));
    
    return { apparatusGroups, unassignedPersonnel, unassignedVolunteers };
  };

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
              Personnel on duty for {formatDisplayDate(selectedDate)} - {currentShift} Shift
            </p>
          </div>
          
          <BattalionSelector />
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Calendar Section - Using same ShiftCalendar component as Daily Worksheet */}
          <div className="lg:w-80 flex-shrink-0">
            <ShiftCalendar />
          </div>

          {/* Stations Personnel Section */}
          <div className="flex-1 space-y-4">
            {stations.map(station => {
              const { apparatusGroups, unassignedPersonnel, unassignedVolunteers } = getStationApparatusWithPersonnel(station.id);
              const stationVolunteers = getStationVolunteers(station.id);
              const stationPartTime = getStationPartTime(station.id);
              const hasAnyPersonnel = apparatusGroups.length > 0 || unassignedPersonnel.length > 0 || unassignedVolunteers.length > 0 || stationPartTime.length > 0;
              
              return (
                <Card key={station.id} data-testid={`station-card-${station.id}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="font-heading uppercase flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      Station {station.station_number}
                      {stationPartTime.length > 0 && (
                        <Badge variant="outline" className="border-purple-500 text-purple-500 text-xs">
                          +{stationPartTime.length} PT
                        </Badge>
                      )}
                      {stationVolunteers.length > 0 && (
                        <Badge variant="outline" className="border-green-500 text-green-500 text-xs">
                          +{stationVolunteers.length} Vol
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!hasAnyPersonnel ? (
                      <p className="text-muted-foreground text-center py-4">
                        No personnel scheduled for this shift
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {/* Part-Time Employees */}
                        {stationPartTime.length > 0 && (
                          <div className="border border-purple-500/30 rounded-lg p-3 bg-purple-500/5">
                            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-purple-500/30">
                              <Clock className="h-4 w-4 text-purple-500" />
                              <span className="font-semibold text-purple-500">Part-Time (+{stationPartTime.length})</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {stationPartTime.map(pt => (
                                <div 
                                  key={pt.id} 
                                  className="flex items-center gap-2 p-2 rounded-lg bg-purple-500/10 border border-purple-500/30"
                                  data-testid={`part-time-card-${pt.id}`}
                                >
                                  <div>
                                    <p className="font-medium text-sm text-purple-600 dark:text-purple-400">
                                      {pt.employee_name}
                                    </p>
                                    <p className="text-xs text-purple-500/70">
                                      {pt.employee_number} • {pt.hours}h
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Apparatus Groups */}
                        {apparatusGroups.map(group => (
                          <div key={group.name} className="border border-border rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                              <Truck className="h-4 w-4 text-primary" />
                              <span className="font-semibold text-primary">{group.name}</span>
                              <span className="text-xs text-muted-foreground">({group.personnel.length} assigned)</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {group.personnel.map(person => (
                                <div 
                                  key={person.id} 
                                  className={`flex items-center gap-2 p-2 rounded-lg ${
                                    person.isVolunteer 
                                      ? 'bg-green-500/10 border border-green-500/30' 
                                      : 'bg-muted'
                                  }`}
                                  data-testid={`personnel-card-${person.id}`}
                                >
                                  {person.position && person.position !== 'Z' && (
                                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                                      person.isVolunteer 
                                        ? 'bg-green-500 text-white' 
                                        : 'bg-primary text-primary-foreground'
                                    }`}>
                                      {person.position}
                                    </span>
                                  )}
                                  <div>
                                    <p className={`font-medium text-sm ${person.isVolunteer ? 'text-green-600 dark:text-green-400' : ''}`}>
                                      {person.name}
                                    </p>
                                    <p className={`text-xs ${person.isVolunteer ? 'text-green-500/70' : 'text-muted-foreground'}`}>
                                      {person.rank}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        
                        {/* Unassigned Personnel */}
                        {unassignedPersonnel.length > 0 && (
                          <div className="border border-dashed border-muted-foreground/30 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span className="font-semibold text-muted-foreground">Not Assigned to Apparatus</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {unassignedPersonnel.map(person => (
                                <div 
                                  key={person.id} 
                                  className="p-2 bg-muted/50 rounded-lg"
                                  data-testid={`personnel-card-${person.id}`}
                                >
                                  <p className="font-medium text-sm">{person.name}</p>
                                  <p className="text-xs text-muted-foreground">{person.rank}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Unassigned Volunteers */}
                        {unassignedVolunteers.length > 0 && (
                          <div className="border border-dashed border-green-500/30 bg-green-500/5 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-green-500/30">
                              <Hand className="h-4 w-4 text-green-500" />
                              <span className="font-semibold text-green-500">Volunteers Not Assigned to Apparatus</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {unassignedVolunteers.map(vol => (
                                <div 
                                  key={vol.id} 
                                  className="p-2 bg-green-500/10 rounded-lg border border-green-500/20"
                                  data-testid={`volunteer-card-${vol.id}`}
                                >
                                  <p className="font-medium text-sm text-green-600 dark:text-green-400">
                                    {vol.name}
                                  </p>
                                  <p className="text-xs text-green-500/70">{vol.rank}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
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

