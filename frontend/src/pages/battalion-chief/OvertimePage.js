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
import { Plus, Save, ChevronLeft, ChevronRight, Phone, Trash2, Clock, Send, Mail, MessageSquare, Users, User, Shield, Stethoscope, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';
import { formatDisplayDate, formatDisplayDateWithDay } from '../../utils/dateUtils';

export const OvertimePage = () => {
  const { api, canEdit } = useAuth();
  const { personnel, stations, fetchAllData, selectedDate, setSelectedDate, selectedBattalion, currentShift, fetchStaffingRecords, staffingRecords } = useStaffing();
  const [overtimeRecords, setOvertimeRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showBroadcastDialog, setShowBroadcastDialog] = useState(false);
  const [broadcastData, setBroadcastData] = useState({
    targetType: 'all', // 'all', 'rank', 'paramedic', 'individual'
    selectedRanks: [],
    selectedIndividuals: [],
    sendSMS: true,
    sendEmail: true,
    subject: 'Overtime Opportunity Available',
    message: ''
  });
  const [allUsers, setAllUsers] = useState([]);
  const [formData, setFormData] = useState({
    personnel_id: '',
    date: selectedDate,
    hours: 24,
    station_id: '',
    status: 'available',
    notes: '',
    phone_number: '',
    shift_type: '24'
  });

  useEffect(() => {
    fetchAllData();
    fetchAllUsers();
  }, [selectedBattalion]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, date: selectedDate }));
    fetchOvertimeRecords();
  }, [selectedDate]);

  const fetchAllUsers = async () => {
    try {
      const response = await api.get('/users');
      // Filter only active users with contact info
      setAllUsers(response.data.filter(u => u.is_active));
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchOvertimeRecords = async () => {
    try {
      const response = await api.get('/overtime', {
        params: { date: selectedDate, battalion_id: selectedBattalion }
      });
      setOvertimeRecords(response.data);
    } catch (error) {
      console.error('Error fetching overtime records:', error);
    }
  };

  const navigateDate = (direction) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + direction);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const handleAddRecord = async () => {
    if (!formData.personnel_id || !formData.station_id) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    try {
      await api.post('/overtime', {
        ...formData,
        battalion_id: selectedBattalion
      });
      toast.success('Overtime record created');
      setShowAddDialog(false);
      fetchOvertimeRecords();
      setFormData({ personnel_id: '', date: selectedDate, hours: 24, station_id: '', status: 'available', notes: '', phone_number: '', shift_type: '24' });
    } catch (error) {
      toast.error('Failed to create overtime record');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (recordId, newStatus) => {
    try {
      const record = overtimeRecords.find(r => r.id === recordId);
      const prevStatus = record.status;
      
      // Update the overtime record
      await api.put(`/overtime/${recordId}`, {
        ...record,
        status: newStatus
      });
      
      // Sync with daily worksheet
      if (newStatus === 'assigned' && prevStatus !== 'assigned') {
        // Add to daily worksheet overtime cell
        await syncOvertimeToWorksheet(record.station_id, 1);
      } else if (newStatus === 'declined' && prevStatus === 'assigned') {
        // Remove from daily worksheet overtime cell
        await syncOvertimeToWorksheet(record.station_id, -1);
      }
      
      toast.success('Status updated');
      fetchOvertimeRecords();
      fetchStaffingRecords();
      fetchAllData(); // Refresh personnel to get updated hours
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteRecord = async (recordId) => {
    if (!confirm('Are you sure you want to delete this overtime record?')) return;
    
    try {
      const record = overtimeRecords.find(r => r.id === recordId);
      
      // If it was assigned, also update the worksheet
      if (record?.status === 'assigned') {
        await syncOvertimeToWorksheet(record.station_id, -1);
      }
      
      await api.delete(`/overtime/${recordId}`);
      toast.success('Overtime record deleted');
      fetchOvertimeRecords();
      fetchStaffingRecords();
      fetchAllData(); // Refresh personnel to get updated hours
    } catch (error) {
      toast.error('Failed to delete overtime record');
    }
  };

  const handleUpdateStation = async (recordId, newStationId) => {
    try {
      const record = overtimeRecords.find(r => r.id === recordId);
      if (!record) return;
      
      const oldStationId = record.station_id;
      
      // Update the overtime record with new station
      await api.put(`/overtime/${recordId}`, {
        ...record,
        station_id: newStationId
      });
      
      // If the record is assigned, update the daily worksheet
      if (record.status === 'assigned') {
        // Remove from old station
        await syncOvertimeToWorksheet(oldStationId, -1);
        // Add to new station
        await syncOvertimeToWorksheet(newStationId, 1);
      }
      
      toast.success('OT Station updated');
      fetchOvertimeRecords();
      fetchStaffingRecords();
    } catch (error) {
      toast.error('Failed to update station');
    }
  };

  const syncOvertimeToWorksheet = async (stationId, change) => {
    try {
      // Find existing staffing record for the station
      const existingRecord = staffingRecords.find(r => r.station_id === stationId);
      
      if (existingRecord) {
        const currentOT = existingRecord.categories?.overtime || 0;
        await api.put(`/staffing/${existingRecord.id}`, {
          categories: { ...existingRecord.categories, overtime: Math.max(0, currentOT + change) }
        });
      } else {
        // Create new staffing record
        await api.post('/staffing', {
          date: selectedDate,
          station_id: stationId,
          battalion_id: selectedBattalion,
          shift: currentShift,
          personnel_assigned: [],
          categories: { overtime: Math.max(0, change) },
          remarks: ''
        });
      }
    } catch (error) {
      console.error('Error syncing overtime to worksheet:', error);
    }
  };

  const getPersonnelName = (personnelId) => {
    const person = personnel.find(p => p.id === personnelId);
    return person ? `${person.rank} ${person.name}` : personnelId;
  };

  const getPersonnelPhone = (personnelId) => {
    const person = personnel.find(p => p.id === personnelId);
    return person?.contact_phone || '-';
  };

  const getStationName = (stationId) => {
    const station = stations.find(s => s.id === stationId);
    return station ? `Station ${station.station_number}` : stationId;
  };

  const getStatusBadge = (status) => {
    const colors = {
      available: 'bg-green-500',
      assigned: 'bg-blue-500',
      declined: 'bg-red-500'
    };
    return <Badge className={colors[status] || 'bg-gray-500'}>{status}</Badge>;
  };

  // Broadcast notification helpers
  const RANK_HIERARCHY = ['Fire Chief', 'Asst. Chief', 'Deputy Chief', 'Battalion Chief', 'Captain', 'Lieutenant', 'Firefighter', 'Part-Time Firefighter', 'Volunteer'];
  
  const getRecipients = () => {
    let recipients = [];
    
    switch (broadcastData.targetType) {
      case 'all':
        recipients = allUsers.filter(u => u.email || u.phone_number);
        break;
      case 'rank':
        recipients = allUsers.filter(u => 
          broadcastData.selectedRanks.includes(u.rank) && (u.email || u.phone_number)
        );
        break;
      case 'paramedic':
        // Filter personnel who have paramedic certification
        const paramedicIds = personnel.filter(p => 
          p.certifications?.includes('Paramedic')
        ).map(p => p.id);
        recipients = allUsers.filter(u => 
          paramedicIds.some(pId => u.payroll_number === personnel.find(p => p.id === pId)?.payroll_number) &&
          (u.email || u.phone_number)
        );
        // Also include users with 'Paramedic' in their rank name
        const additionalParamedics = allUsers.filter(u => 
          u.rank?.toLowerCase().includes('paramedic') && (u.email || u.phone_number)
        );
        recipients = [...new Map([...recipients, ...additionalParamedics].map(r => [r.id, r])).values()];
        break;
      case 'individual':
        recipients = allUsers.filter(u => 
          broadcastData.selectedIndividuals.includes(u.id) && (u.email || u.phone_number)
        );
        break;
      default:
        recipients = [];
    }
    
    return recipients;
  };

  const handleRankToggle = (rank) => {
    setBroadcastData(prev => ({
      ...prev,
      selectedRanks: prev.selectedRanks.includes(rank)
        ? prev.selectedRanks.filter(r => r !== rank)
        : [...prev.selectedRanks, rank]
    }));
  };

  const handleIndividualToggle = (userId) => {
    setBroadcastData(prev => ({
      ...prev,
      selectedIndividuals: prev.selectedIndividuals.includes(userId)
        ? prev.selectedIndividuals.filter(id => id !== userId)
        : [...prev.selectedIndividuals, userId]
    }));
  };

  const handleSendBroadcast = async () => {
    const recipients = getRecipients();
    
    if (recipients.length === 0) {
      toast.error('No recipients selected or no contact info available');
      return;
    }
    
    if (!broadcastData.message.trim()) {
      toast.error('Please enter a message');
      return;
    }
    
    if (!broadcastData.sendSMS && !broadcastData.sendEmail) {
      toast.error('Please select at least one notification method (SMS or Email)');
      return;
    }
    
    setLoading(true);
    try {
      await api.post('/notifications/broadcast', {
        recipients: recipients.map(r => ({
          id: r.id,
          name: r.name,
          email: r.email,
          phone: r.phone_number
        })),
        subject: broadcastData.subject,
        message: broadcastData.message,
        send_sms: broadcastData.sendSMS,
        send_email: broadcastData.sendEmail,
        date: selectedDate
      });
      
      toast.success(`Notification sent to ${recipients.length} recipient(s)`);
      setShowBroadcastDialog(false);
      setBroadcastData({
        targetType: 'all',
        selectedRanks: [],
        selectedIndividuals: [],
        sendSMS: true,
        sendEmail: true,
        subject: 'Overtime Opportunity Available',
        message: ''
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send notification');
    } finally {
      setLoading(false);
    }
  };

  const openBroadcastDialog = () => {
    // Pre-fill the message with context
    const stationNeeds = staffingRecords.filter(s => 
      s.categories?.overtime > 0 || s.personnel_assigned?.length < 3
    ).map(s => {
      const station = stations.find(st => st.id === s.station_id);
      return station ? `Station ${station.station_number}` : '';
    }).filter(Boolean);
    
    const defaultMessage = `Overtime opportunity available for ${formatDisplayDateWithDay(selectedDate)}.\n\n${stationNeeds.length > 0 ? `Stations needing coverage: ${stationNeeds.join(', ')}\n\n` : ''}Please contact the on-duty Battalion Chief if interested.`;
    
    setBroadcastData(prev => ({
      ...prev,
      message: defaultMessage
    }));
    setShowBroadcastDialog(true);
  };

  const availableCount = overtimeRecords.filter(r => r.status === 'available').length;
  const assignedCount = overtimeRecords.filter(r => r.status === 'assigned').length;
  const totalHoursAssigned = overtimeRecords.filter(r => r.status === 'assigned').reduce((sum, r) => sum + r.hours, 0);

  return (
    <div className="min-h-screen bg-background" data-testid="overtime-page">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-3xl uppercase tracking-wider font-bold">
              Overtime Available
            </h1>
            <p className="text-muted-foreground mt-1">
              Personnel available for overtime
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <BattalionSelector />
            {canEdit && (
              <>
                <Button 
                  variant="outline" 
                  onClick={openBroadcastDialog}
                  data-testid="send-notification-btn"
                >
                  <Send className="h-4 w-4 mr-2" /> Send Notification
                </Button>
                <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                  <DialogTrigger asChild>
                    <Button data-testid="add-overtime-btn">
                      <Plus className="h-4 w-4 mr-2" /> Add Available
                    </Button>
                  </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="font-heading uppercase">Add Overtime Availability</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Personnel</Label>
                      <Select 
                        value={formData.personnel_id} 
                        onValueChange={(v) => {
                          const person = personnel.find(p => p.id === v);
                          setFormData({
                            ...formData, 
                            personnel_id: v,
                            phone_number: person?.contact_phone || ''
                          });
                        }}
                      >
                        <SelectTrigger data-testid="personnel-select">
                          <SelectValue placeholder="Select Personnel" />
                        </SelectTrigger>
                        <SelectContent>
                          {personnel.map(person => (
                            <SelectItem key={person.id} value={person.id}>
                              {person.rank} {person.name} ({person.shift} Shift)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Phone Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={formData.phone_number}
                          onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                          placeholder="(555) 555-5555"
                          className="pl-10"
                          data-testid="phone-input"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({...formData, date: e.target.value})}
                        data-testid="date-input"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Assign to Station</Label>
                      <Select 
                        value={formData.station_id} 
                        onValueChange={(v) => setFormData({...formData, station_id: v})}
                      >
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
                      <Label>Shift Type</Label>
                      <Select 
                        value={formData.shift_type} 
                        onValueChange={(v) => setFormData({...formData, shift_type: v, hours: parseInt(v)})}
                      >
                        <SelectTrigger data-testid="shift-type-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="12">12-Hour Shift</SelectItem>
                          <SelectItem value="24">24-Hour Shift</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Hours</Label>
                      <Input
                        type="number"
                        value={formData.hours}
                        onChange={(e) => setFormData({...formData, hours: parseFloat(e.target.value)})}
                        data-testid="hours-input"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({...formData, notes: e.target.value})}
                        placeholder="Optional notes..."
                        data-testid="notes-input"
                      />
                    </div>

                    <Button onClick={handleAddRecord} disabled={loading} className="w-full" data-testid="save-overtime-btn">
                      <Save className="h-4 w-4 mr-2" /> Save
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Broadcast Notification Dialog */}
              <Dialog open={showBroadcastDialog} onOpenChange={setShowBroadcastDialog}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="font-heading uppercase flex items-center gap-2">
                      <Send className="h-5 w-5" /> Overtime Notification Broadcast
                    </DialogTitle>
                  </DialogHeader>
                  
                  <div className="space-y-6 py-4">
                    {/* Target Audience Selection */}
                    <div className="space-y-3">
                      <Label className="text-base font-semibold">Target Audience</Label>
                      <RadioGroup 
                        value={broadcastData.targetType} 
                        onValueChange={(v) => setBroadcastData(prev => ({ ...prev, targetType: v }))}
                        className="grid grid-cols-2 gap-3"
                      >
                        <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                          <RadioGroupItem value="all" id="all" />
                          <Label htmlFor="all" className="flex items-center gap-2 cursor-pointer">
                            <Users className="h-4 w-4" /> All Personnel
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                          <RadioGroupItem value="rank" id="rank" />
                          <Label htmlFor="rank" className="flex items-center gap-2 cursor-pointer">
                            <Shield className="h-4 w-4" /> By Rank
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                          <RadioGroupItem value="paramedic" id="paramedic" />
                          <Label htmlFor="paramedic" className="flex items-center gap-2 cursor-pointer">
                            <Stethoscope className="h-4 w-4" /> Paramedics Only
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                          <RadioGroupItem value="individual" id="individual" />
                          <Label htmlFor="individual" className="flex items-center gap-2 cursor-pointer">
                            <User className="h-4 w-4" /> Specific Individuals
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Rank Selection (shown when targetType is 'rank') */}
                    {broadcastData.targetType === 'rank' && (
                      <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                        <Label className="text-sm font-medium">Select Ranks</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {RANK_HIERARCHY.map(rank => (
                            <div key={rank} className="flex items-center space-x-2">
                              <Checkbox 
                                id={`rank-${rank}`}
                                checked={broadcastData.selectedRanks.includes(rank)}
                                onCheckedChange={() => handleRankToggle(rank)}
                              />
                              <Label htmlFor={`rank-${rank}`} className="text-sm cursor-pointer">
                                {rank}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Individual Selection (shown when targetType is 'individual') */}
                    {broadcastData.targetType === 'individual' && (
                      <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                        <Label className="text-sm font-medium">Select Individuals</Label>
                        <div className="max-h-48 overflow-y-auto space-y-2">
                          {allUsers.filter(u => u.email || u.phone_number).map(user => (
                            <div key={user.id} className="flex items-center space-x-2 p-2 hover:bg-accent rounded">
                              <Checkbox 
                                id={`user-${user.id}`}
                                checked={broadcastData.selectedIndividuals.includes(user.id)}
                                onCheckedChange={() => handleIndividualToggle(user.id)}
                              />
                              <Label htmlFor={`user-${user.id}`} className="text-sm cursor-pointer flex-1">
                                <span className="font-medium">{user.rank} {user.name}</span>
                                <span className="text-muted-foreground ml-2 text-xs">
                                  {user.phone_number && <Phone className="h-3 w-3 inline mr-1" />}
                                  {user.email && <Mail className="h-3 w-3 inline" />}
                                </span>
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notification Methods */}
                    <div className="space-y-3">
                      <Label className="text-base font-semibold">Notification Method</Label>
                      <div className="flex gap-6">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="send-sms"
                            checked={broadcastData.sendSMS}
                            onCheckedChange={(checked) => setBroadcastData(prev => ({ ...prev, sendSMS: checked }))}
                          />
                          <Label htmlFor="send-sms" className="flex items-center gap-2 cursor-pointer">
                            <MessageSquare className="h-4 w-4" /> SMS Text
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="send-email"
                            checked={broadcastData.sendEmail}
                            onCheckedChange={(checked) => setBroadcastData(prev => ({ ...prev, sendEmail: checked }))}
                          />
                          <Label htmlFor="send-email" className="flex items-center gap-2 cursor-pointer">
                            <Mail className="h-4 w-4" /> Email
                          </Label>
                        </div>
                      </div>
                    </div>

                    {/* Message Composition */}
                    <div className="space-y-3">
                      <Label className="text-base font-semibold">Message</Label>
                      {broadcastData.sendEmail && (
                        <div className="space-y-2">
                          <Label className="text-sm">Email Subject</Label>
                          <Input
                            value={broadcastData.subject}
                            onChange={(e) => setBroadcastData(prev => ({ ...prev, subject: e.target.value }))}
                            placeholder="Overtime Opportunity Available"
                            data-testid="broadcast-subject"
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label className="text-sm">Message Body</Label>
                        <Textarea
                          value={broadcastData.message}
                          onChange={(e) => setBroadcastData(prev => ({ ...prev, message: e.target.value }))}
                          placeholder="Enter your message..."
                          className="min-h-[120px]"
                          data-testid="broadcast-message"
                        />
                      </div>
                    </div>

                    {/* Recipients Preview */}
                    <div className="space-y-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold text-blue-400">Recipients Preview</Label>
                        <Badge variant="secondary">{getRecipients().length} recipient(s)</Badge>
                      </div>
                      <div className="max-h-32 overflow-y-auto text-sm">
                        {getRecipients().length === 0 ? (
                          <p className="text-muted-foreground">No recipients selected or no contact info available</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {getRecipients().slice(0, 10).map(r => (
                              <Badge key={r.id} variant="outline" className="text-xs">
                                {r.name}
                                {r.phone_number && <Phone className="h-3 w-3 ml-1 inline" />}
                                {r.email && <Mail className="h-3 w-3 ml-1 inline" />}
                              </Badge>
                            ))}
                            {getRecipients().length > 10 && (
                              <Badge variant="outline" className="text-xs">
                                +{getRecipients().length - 10} more
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                      <Button 
                        variant="outline" 
                        onClick={() => setShowBroadcastDialog(false)} 
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleSendBroadcast} 
                        disabled={loading || getRecipients().length === 0}
                        className="flex-1"
                        data-testid="send-broadcast-btn"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {loading ? 'Sending...' : `Send to ${getRecipients().length} Recipient(s)`}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              </>
            )}
          </div>
        </div>

        {/* Date Navigation */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-4">
              <Button variant="outline" onClick={() => navigateDate(-1)} data-testid="prev-date">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="text-center min-w-[200px]">
                <p className="text-lg font-heading font-semibold">
                  {formatDisplayDateWithDay(selectedDate)}
                </p>
                <p className="text-sm text-muted-foreground">{currentShift} Shift</p>
              </div>
              <Button variant="outline" onClick={() => navigateDate(1)} data-testid="next-date">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-500">{availableCount}</p>
                <p className="text-sm text-muted-foreground">Available</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-500">{assignedCount}</p>
                <p className="text-sm text-muted-foreground">Assigned</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-yellow-500">{totalHoursAssigned}</p>
                <p className="text-sm text-muted-foreground">Hours Assigned</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold">{overtimeRecords.length}</p>
                <p className="text-sm text-muted-foreground">Total Records</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card data-testid="overtime-records-card">
          <CardHeader>
            <CardTitle className="font-heading uppercase">Overtime List</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Personnel</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Regular Station</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>OT Station</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Total OT Hrs</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  {canEdit && <TableHead className="w-40">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {overtimeRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 10 : 9} className="text-center text-muted-foreground py-8">
                      No overtime records for this date
                    </TableCell>
                  </TableRow>
                ) : (
                  overtimeRecords.map(record => {
                    const person = personnel.find(p => p.id === record.personnel_id);
                    return (
                      <TableRow key={record.id} data-testid={`overtime-row-${record.id}`}>
                        <TableCell className="font-medium">{getPersonnelName(record.personnel_id)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {record.phone_number || getPersonnelPhone(record.personnel_id)}
                          </div>
                        </TableCell>
                        <TableCell>{person?.station_id?.replace('sta-', 'Station ') || '-'}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs ${
                            person?.shift === 'A' ? 'bg-red-500/20 text-red-500' :
                            person?.shift === 'B' ? 'bg-green-500/20 text-green-500' :
                            'bg-blue-500/20 text-blue-500'
                          }`}>
                            {person?.shift || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {canEdit ? (
                            <Select 
                              value={record.station_id} 
                              onValueChange={(v) => handleUpdateStation(record.id, v)}
                            >
                              <SelectTrigger className="h-8 text-xs w-28" data-testid={`ot-station-select-${record.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {stations.map(station => (
                                  <SelectItem key={station.id} value={station.id}>
                                    Station {station.station_number}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            getStationName(record.station_id)
                          )}
                        </TableCell>
                        <TableCell>{record.hours} hrs</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3 text-yellow-500" />
                            <span className="font-medium text-yellow-500">
                              {person?.overtime_hours_worked || 0} hrs
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(record.status)}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{record.notes || '-'}</TableCell>
                        {canEdit && (
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Select 
                                value={record.status} 
                                onValueChange={(v) => handleUpdateStatus(record.id, v)}
                              >
                                <SelectTrigger className="h-8 text-xs w-24">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="available">Available</SelectItem>
                                  <SelectItem value="assigned">Assigned</SelectItem>
                                  <SelectItem value="declined">Declined</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                onClick={() => handleDeleteRecord(record.id)}
                                title="Delete"
                                data-testid={`delete-overtime-${record.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
