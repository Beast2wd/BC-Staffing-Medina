import { useEffect, useState } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useAuth } from '../context/AuthContext';
import { useStaffing } from '../context/StaffingContext';
import { BattalionSelector } from '../components/dashboard/BattalionSelector';
import { ShiftCalendar } from '../components/dashboard/ShiftCalendar';
import { Users, MapPin, Truck } from 'lucide-react';
import { formatDisplayDate } from '../utils/dateUtils';

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

  useEffect(() => {
    fetchAllData();
    fetchApparatusAssignments();
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
          const person = personnel.find(p => p.id === pid);
          const position = assignment.position_assignments?.[pid] || 'Z'; // Z for unassigned position (sorts last)
          assignedPersonnelIds.add(pid);
          return { ...person, position };
        }).filter(p => p).sort((a, b) => a.position.localeCompare(b.position));
        
        apparatusGroups.push({
          name: apparatusName,
          personnel: personnelWithPositions
        });
      }
    });
    
    // Get unassigned personnel
    const unassignedPersonnel = onDutyPersonnel.filter(p => !assignedPersonnelIds.has(p.id));
    
    return { apparatusGroups, unassignedPersonnel };
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
              const { apparatusGroups, unassignedPersonnel } = getStationApparatusWithPersonnel(station.id);
              const hasAnyPersonnel = apparatusGroups.length > 0 || unassignedPersonnel.length > 0;
              
              return (
                <Card key={station.id} data-testid={`station-card-${station.id}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="font-heading uppercase flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      Station {station.station_number}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!hasAnyPersonnel ? (
                      <p className="text-muted-foreground text-center py-4">
                        No personnel scheduled for this shift
                      </p>
                    ) : (
                      <div className="space-y-4">
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
                                  className="flex items-center gap-2 p-2 bg-muted rounded-lg"
                                  data-testid={`personnel-card-${person.id}`}
                                >
                                  {person.position && person.position !== 'Z' && (
                                    <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded">
                                      {person.position}
                                    </span>
                                  )}
                                  <div>
                                    <p className="font-medium text-sm">{person.name}</p>
                                    <p className="text-xs text-muted-foreground">{person.rank}</p>
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

