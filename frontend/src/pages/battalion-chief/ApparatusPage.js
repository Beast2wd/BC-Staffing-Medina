import { useEffect, useState } from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useAuth } from '../../context/AuthContext';
import { useStaffing } from '../../context/StaffingContext';
import { BattalionSelector } from '../../components/dashboard/BattalionSelector';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';

export const ApparatusPage = () => {
  const { api, canEdit } = useAuth();
  const { stations, personnel, fetchAllData, selectedDate, selectedBattalion, currentShift } = useStaffing();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [selectedStation, setSelectedStation] = useState('');
  const [selectedApparatus, setSelectedApparatus] = useState('');
  const [assignedPersonnel, setAssignedPersonnel] = useState([]);

  useEffect(() => {
    fetchAllData();
    fetchAssignments();
  }, [selectedDate, selectedBattalion]);

  const fetchAssignments = async () => {
    try {
      const response = await api.get('/apparatus-assignments', {
        params: { date: selectedDate, battalion_id: selectedBattalion }
      });
      setAssignments(response.data);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    }
  };

  const handleAddAssignment = async () => {
    if (!selectedStation || !selectedApparatus) {
      toast.error('Please select station and apparatus');
      return;
    }
    
    setLoading(true);
    try {
      await api.post('/apparatus-assignments', {
        date: selectedDate,
        station_id: selectedStation,
        apparatus_name: selectedApparatus,
        battalion_id: selectedBattalion,
        shift: currentShift,
        personnel_ids: assignedPersonnel
      });
      toast.success('Assignment created');
      setShowAddDialog(false);
      fetchAssignments();
      resetForm();
    } catch (error) {
      toast.error('Failed to create assignment');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedStation('');
    setSelectedApparatus('');
    setAssignedPersonnel([]);
  };

  const handleOpenEdit = (assignment, stationId, apparatusName) => {
    // If assignment exists, use it; otherwise create a placeholder for unassigned apparatus
    if (assignment) {
      setEditingAssignment(assignment);
      setSelectedStation(assignment.station_id);
      setSelectedApparatus(assignment.apparatus_name);
      setAssignedPersonnel(assignment.personnel_ids || []);
    } else {
      setEditingAssignment({ station_id: stationId, apparatus_name: apparatusName });
      setSelectedStation(stationId);
      setSelectedApparatus(apparatusName);
      setAssignedPersonnel([]);
    }
    setShowEditDialog(true);
  };

  const handleEditAssignment = async () => {
    if (!selectedStation || !selectedApparatus) {
      toast.error('Please select station and apparatus');
      return;
    }
    
    setLoading(true);
    try {
      if (editingAssignment?.id) {
        // Update existing assignment
        await api.put(`/apparatus-assignments/${editingAssignment.id}`, {
          personnel_ids: assignedPersonnel
        });
        toast.success('Assignment updated');
      } else {
        // Create new assignment for unassigned apparatus
        await api.post('/apparatus-assignments', {
          date: selectedDate,
          station_id: selectedStation,
          apparatus_name: selectedApparatus,
          battalion_id: selectedBattalion,
          shift: currentShift,
          personnel_ids: assignedPersonnel
        });
        toast.success('Assignment created');
      }
      setShowEditDialog(false);
      setEditingAssignment(null);
      fetchAssignments();
      resetForm();
    } catch (error) {
      toast.error('Failed to update assignment');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    if (!confirm('Are you sure you want to remove this assignment?')) return;
    
    try {
      await api.delete(`/apparatus-assignments/${assignmentId}`);
      toast.success('Assignment removed');
      fetchAssignments();
    } catch (error) {
      toast.error('Failed to remove assignment');
    }
  };

  const getStationApparatus = (stationId) => {
    const station = stations.find(s => s.id === stationId);
    return station?.apparatus || [];
  };

  const getPersonnelName = (personnelId) => {
    const person = personnel.find(p => p.id === personnelId);
    return person ? `${person.rank} ${person.name}` : personnelId;
  };

  const getStationPersonnel = (stationId) => {
    return personnel.filter(p => p.station_id === stationId && p.shift === currentShift);
  };

  return (
    <div className="min-h-screen bg-background" data-testid="apparatus-page">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-3xl uppercase tracking-wider font-bold">
              Apparatus Assignments
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage apparatus crew assignments for {selectedDate}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <BattalionSelector />
            {canEdit && (
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button data-testid="add-assignment-btn">
                    <Plus className="h-4 w-4 mr-2" /> Add Assignment
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="font-heading uppercase">New Apparatus Assignment</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Station</Label>
                      <Select value={selectedStation} onValueChange={setSelectedStation}>
                        <SelectTrigger data-testid="station-select">
                          <SelectValue placeholder="Select Station" />
                        </SelectTrigger>
                        <SelectContent>
                          {stations.map(station => (
                            <SelectItem key={station.id} value={station.id}>
                              Station {station.station_number}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Apparatus</Label>
                      <Select 
                        value={selectedApparatus} 
                        onValueChange={setSelectedApparatus}
                        disabled={!selectedStation}
                      >
                        <SelectTrigger data-testid="apparatus-select">
                          <SelectValue placeholder="Select Apparatus" />
                        </SelectTrigger>
                        <SelectContent>
                          {getStationApparatus(selectedStation).map(app => (
                            <SelectItem key={app} value={app}>{app}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Assigned Personnel</Label>
                      <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                        {selectedStation && getStationPersonnel(selectedStation).map(person => (
                          <label key={person.id} className="flex items-center gap-2 p-1 hover:bg-muted rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={assignedPersonnel.includes(person.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAssignedPersonnel([...assignedPersonnel, person.id]);
                                } else {
                                  setAssignedPersonnel(assignedPersonnel.filter(id => id !== person.id));
                                }
                              }}
                              className="rounded"
                            />
                            <span className="text-sm">{person.rank} {person.name}</span>
                          </label>
                        ))}
                        {selectedStation && getStationPersonnel(selectedStation).length === 0 && (
                          <p className="text-sm text-muted-foreground p-2">No personnel on this shift</p>
                        )}
                      </div>
                    </div>

                    <Button onClick={handleAddAssignment} disabled={loading} className="w-full" data-testid="save-assignment-btn">
                      <Save className="h-4 w-4 mr-2" /> Save Assignment
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Assignments Table */}
        <Card data-testid="assignments-card">
          <CardHeader>
            <CardTitle className="font-heading uppercase">Current Assignments - {currentShift} Shift</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Station</TableHead>
                  <TableHead>Apparatus</TableHead>
                  <TableHead>Assigned Personnel</TableHead>
                  {canEdit && <TableHead className="w-24">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {stations.map(station => {
                  const stationAssignments = assignments.filter(a => a.station_id === station.id);
                  
                  if (stationAssignments.length === 0) {
                    return station.apparatus?.map((app, idx) => (
                      <TableRow key={`${station.id}-${app}`} data-testid={`assignment-row-${station.id}-${idx}`}>
                        {idx === 0 && (
                          <TableCell rowSpan={station.apparatus.length} className="font-semibold align-top">
                            Station {station.station_number}
                          </TableCell>
                        )}
                        <TableCell>{app}</TableCell>
                        <TableCell className="text-muted-foreground italic">Not assigned</TableCell>
                        {canEdit && (
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleOpenEdit(null, station.id, app)}
                              title="Assign Personnel"
                              data-testid={`edit-unassigned-${station.id}-${app}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ));
                  }

                  return stationAssignments.map((assignment, idx) => (
                    <TableRow key={assignment.id} data-testid={`assignment-row-${assignment.id}`}>
                      {idx === 0 && (
                        <TableCell rowSpan={stationAssignments.length} className="font-semibold align-top">
                          Station {station.station_number}
                        </TableCell>
                      )}
                      <TableCell>{assignment.apparatus_name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {assignment.personnel_ids?.map(pid => (
                            <span key={pid} className="text-xs bg-muted px-2 py-1 rounded">
                              {getPersonnelName(pid)}
                            </span>
                          ))}
                          {(!assignment.personnel_ids || assignment.personnel_ids.length === 0) && (
                            <span className="text-muted-foreground italic">No personnel assigned</span>
                          )}
                        </div>
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleOpenEdit(assignment, assignment.station_id, assignment.apparatus_name)}
                              title="Edit Assignment"
                              data-testid={`edit-assignment-${assignment.id}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-500"
                              onClick={() => handleDeleteAssignment(assignment.id)}
                              title="Remove Assignment"
                              data-testid={`delete-assignment-${assignment.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ));
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit Assignment Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading uppercase">Edit Apparatus Assignment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">
                  {stations.find(s => s.id === selectedStation)?.station_number 
                    ? `Station ${stations.find(s => s.id === selectedStation)?.station_number}` 
                    : 'Station'}
                </p>
                <p className="text-xs text-muted-foreground">{selectedApparatus}</p>
              </div>

              <div className="space-y-2">
                <Label>Assigned Personnel</Label>
                <div className="max-h-64 overflow-y-auto border rounded-md p-2 space-y-1">
                  {selectedStation && getStationPersonnel(selectedStation).map(person => (
                    <label key={person.id} className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={assignedPersonnel.includes(person.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAssignedPersonnel([...assignedPersonnel, person.id]);
                          } else {
                            setAssignedPersonnel(assignedPersonnel.filter(id => id !== person.id));
                          }
                        }}
                        className="rounded"
                        data-testid={`checkbox-${person.id}`}
                      />
                      <span className="text-sm">{person.rank} {person.name}</span>
                    </label>
                  ))}
                  {selectedStation && getStationPersonnel(selectedStation).length === 0 && (
                    <p className="text-sm text-muted-foreground p-2">No personnel on this shift</p>
                  )}
                </div>
              </div>

              <Button onClick={handleEditAssignment} disabled={loading} className="w-full" data-testid="save-edit-assignment-btn">
                <Save className="h-4 w-4 mr-2" /> Save Assignment
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};
