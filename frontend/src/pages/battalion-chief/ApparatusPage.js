import { useEffect, useState } from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useAuth } from '../../context/AuthContext';
import { useStaffing } from '../../context/StaffingContext';
import { BattalionSelector } from '../../components/dashboard/BattalionSelector';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Save, X, ChevronLeft, ChevronRight, UserMinus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { formatDisplayDate, formatDisplayDateWithDay } from '../../utils/dateUtils';

export const ApparatusPage = () => {
  const { api, canEdit } = useAuth();
  const { stations, personnel, fetchAllData, selectedDate, setSelectedDate, selectedBattalion, currentShift } = useStaffing();
  const [assignments, setAssignments] = useState([]);
  const [volunteerAssignments, setVolunteerAssignments] = useState([]);
  const [overtimeAssignments, setOvertimeAssignments] = useState([]);
  const [overtimePersonnelMap, setOvertimePersonnelMap] = useState({});
  const [partTimeAssignments, setPartTimeAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [removeAssignment, setRemoveAssignment] = useState(null);
  const [selectedRemovePersonnel, setSelectedRemovePersonnel] = useState(null);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [selectedStation, setSelectedStation] = useState('');
  const [selectedApparatus, setSelectedApparatus] = useState('');
  const [assignedPersonnel, setAssignedPersonnel] = useState([]);
  const [positionAssignments, setPositionAssignments] = useState({}); // {personnelId: 'A'|'B'|'C'|'D'}

  const RIDING_POSITIONS = ['A', 'B', 'C', 'D'];

  // Date navigation functions
  const navigateDate = (direction) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + direction);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const goToToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  useEffect(() => {
    fetchAllData();
    fetchAssignments();
    fetchVolunteerAssignments();
    fetchPartTimeAssignments();
    fetchOvertimeAssignments();
  }, [selectedDate, selectedBattalion, currentShift]);

  const fetchOvertimeAssignments = async () => {
    try {
      const response = await api.get('/overtime', {
        params: { date: selectedDate, battalion_id: selectedBattalion, status: 'assigned' }
      });
      setOvertimeAssignments(response.data);
      const missing = response.data.filter(o => !personnel.some(p => p.id === o.personnel_id));
      if (missing.length > 0) {
        const all = await api.get('/personnel');
        setOvertimePersonnelMap(Object.fromEntries(all.data.map(p => [p.id, p])));
      }
    } catch (error) {
      console.error('Error fetching overtime assignments:', error);
    }
  };

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
        params: { date: selectedDate, shift: currentShift }
      });
      setPartTimeAssignments(response.data);
    } catch (error) {
      console.error('Error fetching part-time assignments:', error);
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
        personnel_ids: assignedPersonnel,
        position_assignments: positionAssignments
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
    setPositionAssignments({});
  };

  const handleOpenEdit = (assignment, stationId, apparatusName) => {
    // If assignment exists, use it; otherwise create a placeholder for unassigned apparatus
    if (assignment) {
      setEditingAssignment(assignment);
      setSelectedStation(assignment.station_id);
      setSelectedApparatus(assignment.apparatus_name);
      setAssignedPersonnel(assignment.personnel_ids || []);
      setPositionAssignments(assignment.position_assignments || {});
    } else {
      setEditingAssignment({ station_id: stationId, apparatus_name: apparatusName });
      setSelectedStation(stationId);
      setSelectedApparatus(apparatusName);
      setAssignedPersonnel([]);
      setPositionAssignments({});
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
          personnel_ids: assignedPersonnel,
          position_assignments: positionAssignments
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
          personnel_ids: assignedPersonnel,
          position_assignments: positionAssignments
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

  const handleDeleteAssignment = async (assignment) => {
    // If assignment has more than one personnel, show the remove dialog
    if (assignment.personnel_ids && assignment.personnel_ids.length > 1) {
      setRemoveAssignment(assignment);
      setSelectedRemovePersonnel(null);
      setShowRemoveDialog(true);
    } else {
      // Only one or no personnel, confirm and delete the entire assignment
      if (!confirm('Are you sure you want to remove this assignment?')) return;
      
      try {
        await api.delete(`/apparatus-assignments/${assignment.id}`);
        toast.success('Assignment removed');
        fetchAssignments();
      } catch (error) {
        toast.error('Failed to remove assignment');
      }
    }
  };

  const handleRemoveSinglePersonnel = async () => {
    if (!removeAssignment || !selectedRemovePersonnel) {
      toast.error('Please select a riding position to remove');
      return;
    }

    setLoading(true);
    try {
      // Filter out the selected personnel
      const newPersonnelIds = removeAssignment.personnel_ids.filter(id => id !== selectedRemovePersonnel);
      const newPositionAssignments = { ...removeAssignment.position_assignments };
      delete newPositionAssignments[selectedRemovePersonnel];

      if (newPersonnelIds.length === 0) {
        // No personnel left, delete the entire assignment
        await api.delete(`/apparatus-assignments/${removeAssignment.id}`);
        toast.success('Assignment removed');
      } else {
        // Update the assignment with remaining personnel
        await api.put(`/apparatus-assignments/${removeAssignment.id}`, {
          personnel_ids: newPersonnelIds,
          position_assignments: newPositionAssignments
        });
        toast.success('Personnel removed from assignment');
      }

      setShowRemoveDialog(false);
      setRemoveAssignment(null);
      setSelectedRemovePersonnel(null);
      fetchAssignments();
    } catch (error) {
      toast.error('Failed to remove personnel');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAllPersonnel = async () => {
    if (!removeAssignment) return;
    
    if (!confirm('Are you sure you want to remove ALL personnel from this assignment?')) return;

    setLoading(true);
    try {
      await api.delete(`/apparatus-assignments/${removeAssignment.id}`);
      toast.success('Assignment removed');
      setShowRemoveDialog(false);
      setRemoveAssignment(null);
      setSelectedRemovePersonnel(null);
      fetchAssignments();
    } catch (error) {
      toast.error('Failed to remove assignment');
    } finally {
      setLoading(false);
    }
  };

  const getStationApparatus = (stationId) => {
    const station = stations.find(s => s.id === stationId);
    return station?.apparatus || [];
  };

  const getPersonnelName = (personnelId, assignment = null) => {
    // First check if the assignment has personnel_names from the API
    if (assignment?.personnel_names?.[personnelId]) {
      return assignment.personnel_names[personnelId];
    }
    // Check if it's a part-time employee (prefixed with pt-)
    if (personnelId.startsWith('pt-')) {
      const ptRecord = partTimeAssignments.find(pt => `pt-${pt.id}` === personnelId);
      if (ptRecord) {
        return `PT ${ptRecord.pt_employee_name || ptRecord.employee_name}`;
      }
    }
    // Check regular personnel (flag if working this date on overtime)
    const person = personnel.find(p => p.id === personnelId) || overtimePersonnelMap[personnelId];
    if (person) {
      const onOvertime = overtimeAssignments.some(o => o.personnel_id === personnelId);
      return `${onOvertime ? 'OT ' : ''}${person.rank} ${person.name}`;
    }
    // Check volunteers from current assignments
    const volunteer = volunteerAssignments.find(v => v.personnel_id === personnelId);
    if (volunteer) {
      return `Vol. ${volunteer.volunteer_name}`;
    }
    return personnelId;
  };

  // Get volunteers assigned to a specific station for the current date/shift
  const getStationVolunteers = (stationId) => {
    return volunteerAssignments.filter(v => v.assigned_station_id === stationId);
  };

  // Get part-time employees assigned to a specific station for the current date/shift
  const getStationPartTime = (stationId) => {
    return partTimeAssignments.filter(pt => pt.assigned_station_id === stationId);
  };

  const getStationPersonnel = (stationId) => {
    // Get regular personnel for this station and shift
    const regularPersonnel = personnel.filter(p => p.station_id === stationId && p.shift === currentShift);
    
    // Get volunteers assigned to this station for this date/shift
    const volunteers = getStationVolunteers(stationId).map(v => ({
      id: v.personnel_id,
      name: v.volunteer_name,
      rank: 'Volunteer',
      isVolunteer: true,
      phone: v.volunteer_phone || v.phone_number
    }));
    
    // Get personnel assigned overtime at this station on this date (any home shift)
    const overtimePersonnel = overtimeAssignments
      .filter(o => o.station_id === stationId && !regularPersonnel.some(p => p.id === o.personnel_id))
      .map(o => {
        const p = personnel.find(x => x.id === o.personnel_id) || overtimePersonnelMap[o.personnel_id];
        return {
          id: o.personnel_id,
          name: p?.name || 'Unknown',
          rank: p?.rank || '',
          isOvertime: true,
          overtimeHours: o.hours,
          homeShift: p?.shift,
          phone: p?.phone || o.phone_number || ''
        };
      });
    
    // Get part-time employees assigned to this station for this date/shift
    const partTimeEmployees = getStationPartTime(stationId).map(pt => ({
      id: `pt-${pt.id}`,  // Prefix to distinguish from regular personnel
      name: pt.pt_employee_name || pt.employee_name,
      rank: pt.pt_employee_rank || 'Part-Time',
      isPartTime: true,
      phone: pt.pt_employee_phone || '',
      employee_number: pt.pt_employee_number || pt.employee_number
    }));
    
    // Combine all lists
    return [...regularPersonnel, ...overtimePersonnel, ...volunteers, ...partTimeEmployees];
  };

  const handlePersonnelToggle = (personId, isChecked) => {
    if (isChecked) {
      setAssignedPersonnel([...assignedPersonnel, personId]);
      // Auto-assign next available position
      const usedPositions = Object.values(positionAssignments);
      const nextPosition = RIDING_POSITIONS.find(p => !usedPositions.includes(p)) || 'A';
      setPositionAssignments({...positionAssignments, [personId]: nextPosition});
    } else {
      setAssignedPersonnel(assignedPersonnel.filter(id => id !== personId));
      const newPositions = {...positionAssignments};
      delete newPositions[personId];
      setPositionAssignments(newPositions);
    }
  };

  const handlePositionChange = (personId, position) => {
    setPositionAssignments({...positionAssignments, [personId]: position});
  };

  const getPersonnelWithPosition = (assignment) => {
    const positions = assignment.position_assignments || {};
    return (assignment.personnel_ids || []).map(pid => ({
      id: pid,
      name: getPersonnelName(pid, assignment),
      position: positions[pid] || '-'
    })).sort((a, b) => {
      const posOrder = {'A': 1, 'B': 2, 'C': 3, 'D': 4, '-': 5};
      return (posOrder[a.position] || 5) - (posOrder[b.position] || 5);
    });
  };

  return (
    <div className="min-h-screen bg-background" data-testid="apparatus-page">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-3xl uppercase tracking-wider font-bold flex items-center gap-3">
              Apparatus Assignments
              <div className="flex items-center gap-1">
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => navigateDate(-1)}
                  className="h-8 w-8"
                  data-testid="prev-date"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => navigateDate(1)}
                  className="h-8 w-8"
                  data-testid="next-date"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-muted-foreground">
                {formatDisplayDateWithDay(selectedDate)}
              </p>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-36 h-7 text-xs"
                data-testid="date-picker"
              />
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={goToToday}
                className="h-7 text-xs"
                data-testid="today-btn"
              >
                Today
              </Button>
            </div>
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
                      <Label>Assigned Personnel & Riding Position</Label>
                      <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                        {selectedStation && getStationPersonnel(selectedStation).map(person => (
                          <div 
                            key={person.id} 
                            className={`flex items-center gap-2 p-1 hover:bg-muted rounded ${
                              person.isVolunteer ? 'bg-green-500/10 border-l-2 border-green-500' : 
                              person.isPartTime ? 'bg-purple-500/10 border-l-2 border-purple-500' : 
                              person.isOvertime ? 'bg-yellow-500/10 border-l-2 border-yellow-500' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={assignedPersonnel.includes(person.id)}
                              onChange={(e) => handlePersonnelToggle(person.id, e.target.checked)}
                              className="rounded"
                            />
                            <span className={`text-sm flex-1 ${
                              person.isVolunteer ? 'text-green-600 dark:text-green-400' : 
                              person.isPartTime ? 'text-purple-600 dark:text-purple-400' : 
                              person.isOvertime ? 'text-yellow-600 dark:text-yellow-400' : ''
                            }`}>
                              {person.isVolunteer ? `Vol. ${person.name}` : 
                               person.isPartTime ? `PT ${person.name}` : 
                               person.isOvertime ? `OT ${person.rank} ${person.name}` : `${person.rank} ${person.name}`}
                            </span>
                            {assignedPersonnel.includes(person.id) && (
                              <Select 
                                value={positionAssignments[person.id] || ''} 
                                onValueChange={(val) => handlePositionChange(person.id, val)}
                              >
                                <SelectTrigger className="w-20 h-7 text-xs">
                                  <SelectValue placeholder="Pos" />
                                </SelectTrigger>
                                <SelectContent>
                                  {RIDING_POSITIONS.map(pos => (
                                    <SelectItem key={pos} value={pos}>Position {pos}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        ))}
                        {selectedStation && getStationPersonnel(selectedStation).length === 0 && (
                          <p className="text-sm text-muted-foreground p-2">No personnel, volunteers, or part-time on this shift</p>
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
                  const stationApparatus = station.apparatus || [];
                  
                  // Create a map of apparatus to their assignments
                  const apparatusAssignmentMap = {};
                  stationAssignments.forEach(a => {
                    apparatusAssignmentMap[a.apparatus_name] = a;
                  });
                  
                  // Show all apparatus from the station configuration
                  return stationApparatus.map((app, idx) => {
                    const assignment = apparatusAssignmentMap[app];
                    
                    return (
                      <TableRow key={`${station.id}-${app}`} data-testid={`assignment-row-${station.id}-${idx}`}>
                        {idx === 0 && (
                          <TableCell rowSpan={stationApparatus.length} className="font-semibold align-top">
                            Station {station.station_number}
                          </TableCell>
                        )}
                        <TableCell>{app}</TableCell>
                        <TableCell>
                          {assignment && assignment.personnel_ids && assignment.personnel_ids.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {getPersonnelWithPosition(assignment).map(p => {
                                const isVol = p.name.startsWith('Vol.');
                                const isPT = p.name.startsWith('PT ');
                                return (
                                  <span 
                                    key={p.id} 
                                    className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                                      isVol ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 
                                      isPT ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400' : 'bg-muted'
                                    }`}
                                  >
                                    <span className="font-semibold text-primary">{p.position}</span>
                                    <span>{p.name}</span>
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">Not assigned</span>
                          )}
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleOpenEdit(assignment || null, station.id, app)}
                                title={assignment ? "Edit Assignment" : "Assign Personnel"}
                                data-testid={`edit-assignment-${station.id}-${app}`}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              {assignment && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-red-500"
                                  onClick={() => handleDeleteAssignment(assignment)}
                                  title="Remove Assignment"
                                  data-testid={`delete-assignment-${assignment.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  });
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
                <Label>Assigned Personnel & Riding Position</Label>
                <div className="max-h-64 overflow-y-auto border rounded-md p-2 space-y-1">
                  {selectedStation && getStationPersonnel(selectedStation).map(person => (
                    <div 
                      key={person.id} 
                      className={`flex items-center gap-2 p-2 hover:bg-muted rounded ${
                        person.isVolunteer ? 'bg-green-500/10 border-l-2 border-green-500' : 
                        person.isPartTime ? 'bg-purple-500/10 border-l-2 border-purple-500' : 
                        person.isOvertime ? 'bg-yellow-500/10 border-l-2 border-yellow-500' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={assignedPersonnel.includes(person.id)}
                        onChange={(e) => handlePersonnelToggle(person.id, e.target.checked)}
                        className="rounded"
                        data-testid={`checkbox-${person.id}`}
                      />
                      <span className={`text-sm flex-1 ${
                        person.isVolunteer ? 'text-green-600 dark:text-green-400' : 
                        person.isPartTime ? 'text-purple-600 dark:text-purple-400' : 
                        person.isOvertime ? 'text-yellow-600 dark:text-yellow-400' : ''
                      }`}>
                        {person.isVolunteer ? `Vol. ${person.name}` : 
                         person.isPartTime ? `PT ${person.name}` : 
                         person.isOvertime ? `OT ${person.rank} ${person.name}` : `${person.rank} ${person.name}`}
                      </span>
                      {assignedPersonnel.includes(person.id) && (
                        <Select 
                          value={positionAssignments[person.id] || ''} 
                          onValueChange={(val) => handlePositionChange(person.id, val)}
                        >
                          <SelectTrigger className="w-20 h-7 text-xs" data-testid={`position-select-${person.id}`}>
                            <SelectValue placeholder="Pos" />
                          </SelectTrigger>
                          <SelectContent>
                            {RIDING_POSITIONS.map(pos => (
                              <SelectItem key={pos} value={pos}>Position {pos}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ))}
                  {selectedStation && getStationPersonnel(selectedStation).length === 0 && (
                    <p className="text-sm text-muted-foreground p-2">No personnel, volunteers, or part-time on this shift</p>
                  )}
                </div>
              </div>

              <Button onClick={handleEditAssignment} disabled={loading} className="w-full" data-testid="save-edit-assignment-btn">
                <Save className="h-4 w-4 mr-2" /> Save Assignment
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Remove Personnel Dialog */}
        <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading uppercase flex items-center gap-2">
                <UserMinus className="h-5 w-5 text-red-500" />
                Remove Personnel
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {removeAssignment && (
                <>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium">
                      {stations.find(s => s.id === removeAssignment.station_id)?.station_number 
                        ? `Station ${stations.find(s => s.id === removeAssignment.station_id)?.station_number}` 
                        : 'Station'}
                    </p>
                    <p className="text-xs text-muted-foreground">{removeAssignment.apparatus_name}</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Select which riding position to remove:</Label>
                    <div className="border rounded-md p-2 space-y-1">
                      {getPersonnelWithPosition(removeAssignment).map(p => {
                        const isVol = p.name.startsWith('Vol.');
                        return (
                          <div 
                            key={p.id}
                            onClick={() => setSelectedRemovePersonnel(p.id)}
                            className={`flex items-center gap-3 p-3 rounded cursor-pointer transition-colors ${
                              selectedRemovePersonnel === p.id 
                                ? 'bg-red-500/20 border border-red-500' 
                                : 'hover:bg-muted border border-transparent'
                            } ${isVol ? 'border-l-2 border-l-green-500' : ''}`}
                            data-testid={`remove-option-${p.id}`}
                          >
                            <input
                              type="radio"
                              name="removePersonnel"
                              checked={selectedRemovePersonnel === p.id}
                              onChange={() => setSelectedRemovePersonnel(p.id)}
                              className="accent-red-500"
                            />
                            <span className={`font-semibold text-primary min-w-[24px]`}>
                              {p.position}
                            </span>
                            <span className={`flex-1 ${isVol ? 'text-green-600 dark:text-green-400' : ''}`}>
                              {p.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button 
                      onClick={handleRemoveSinglePersonnel} 
                      disabled={loading || !selectedRemovePersonnel} 
                      className="flex-1 bg-red-600 hover:bg-red-700"
                      data-testid="confirm-remove-single-btn"
                    >
                      <UserMinus className="h-4 w-4 mr-2" /> Remove Selected
                    </Button>
                  </div>

                  <div className="border-t pt-3">
                    <Button 
                      variant="outline"
                      onClick={handleRemoveAllPersonnel} 
                      disabled={loading} 
                      className="w-full text-red-500 border-red-500 hover:bg-red-500/10"
                      data-testid="remove-all-btn"
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Remove All Personnel
                    </Button>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};
