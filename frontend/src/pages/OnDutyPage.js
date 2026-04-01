import { useEffect, useState } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useAuth } from '../context/AuthContext';
import { useStaffing } from '../context/StaffingContext';
import { BattalionSelector } from '../components/dashboard/BattalionSelector';
import { ShiftCalendar } from '../components/dashboard/ShiftCalendar';
import { Users, MapPin } from 'lucide-react';

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

  useEffect(() => {
    fetchAllData();
  }, [selectedBattalion, selectedDate]);

  // Get personnel on duty for the selected shift
  const getOnDutyPersonnel = (stationId) => {
    return personnel.filter(p => 
      p.station_id === stationId && 
      p.shift === currentShift &&
      p.is_active
    );
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
              Personnel on duty for {selectedDate} - {currentShift} Shift
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

