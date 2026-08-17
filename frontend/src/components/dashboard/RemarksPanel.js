import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useAuth } from '../../context/AuthContext';
import { useStaffing } from '../../context/StaffingContext';
import { toast } from 'sonner';
import { Edit2, Save, X } from 'lucide-react';
import { formatDisplayDate } from '../../utils/dateUtils';

const REMARK_TABS = [
  { id: 'remarks', label: 'Remarks/Notes' },
  { id: 'overtime', label: 'Overtime' },
  { id: 'holiday', label: 'HOLIDAY' },
  { id: 'vacation', label: 'VACATION' },
  { id: 'sick', label: 'SICK' },
  { id: 'battalion_fill_in', label: 'Battalion Fill-In' },
];

export const RemarksPanel = () => {
  const { api, canEdit } = useAuth();
  const { selectedDate, selectedBattalion, leaveRecords, personnel } = useStaffing();
  const [activeTab, setActiveTab] = useState('remarks');
  const [remarks, setRemarks] = useState({});
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(false);

  // Calculate leave notes for vacation, sick, and holiday tabs
  const leaveNotes = useMemo(() => {
    const notes = { vacation: [], sick: [], holiday: [] };
    
    // Filter approved leave records that cover the selected date
    // Using hours-based single-day logic: for ≤24 hours, only show on start_date
    const activeLeaves = leaveRecords.filter(leave => {
      if (leave.status !== 'approved') return false;
      
      const hours = leave.hours || 24;
      const startDate = leave.start_date;
      
      // For 24 hours or less: only show on start_date (single day)
      if (hours <= 24) {
        return selectedDate === startDate;
      }
      
      // For >24 hours: calculate effective end date based on hours
      const shiftDays = Math.ceil(hours / 24);
      const endDateObj = new Date(startDate + 'T00:00:00');
      endDateObj.setDate(endDateObj.getDate() + shiftDays - 1);
      const effectiveEndDate = endDateObj.toISOString().split('T')[0];
      
      return selectedDate >= startDate && selectedDate <= effectiveEndDate;
    });
    
    activeLeaves.forEach(leave => {
      const person = personnel.find(p => p.id === leave.personnel_id);
      if (person && leave.notes && leave.notes.trim()) {
        const leaveType = leave.leave_type;
        if (notes[leaveType]) {
          notes[leaveType].push({
            personnelName: `${person.rank || ''} ${person.name}`.trim(),
            station: person.station_id?.replace('sta-', 'Station ').replace(/-/g, ' ') || '',
            shift: person.shift,
            notes: leave.notes,
            startDate: leave.start_date,
            endDate: leave.end_date,
            hours: leave.hours || 24
          });
        }
      }
    });
    
    return notes;
  }, [leaveRecords, personnel, selectedDate]);

  useEffect(() => {
    fetchRemarks();
  }, [selectedDate, selectedBattalion]);

  const fetchRemarks = async () => {
    try {
      const response = await api.get('/remarks', {
        params: {
          date: selectedDate,
          battalion_id: selectedBattalion
        }
      });
      
      // Organize remarks by category
      const organized = {};
      REMARK_TABS.forEach(tab => {
        const remark = response.data.find(r => r.content?.startsWith(`[${tab.id.toUpperCase()}]`));
        organized[tab.id] = remark?.content?.replace(`[${tab.id.toUpperCase()}] `, '') || '';
      });
      setRemarks(organized);
    } catch (error) {
      console.error('Error fetching remarks:', error);
    }
  };

  const handleEdit = () => {
    setEditContent(remarks[activeTab] || '');
    setEditMode(true);
  };

  const handleCancel = () => {
    setEditMode(false);
    setEditContent('');
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.post('/remarks', {
        id: crypto.randomUUID(),
        date: selectedDate,
        battalion_id: selectedBattalion,
        content: `[${activeTab.toUpperCase()}] ${editContent}`,
        created_by: 'current_user',
        created_at: new Date().toISOString()
      });
      
      setRemarks(prev => ({ ...prev, [activeTab]: editContent }));
      setEditMode(false);
      toast.success('Remarks saved');
    } catch (error) {
      toast.error('Failed to save remarks');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="h-full" data-testid="remarks-panel">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading text-lg uppercase tracking-wider">
            Remarks & Notes
          </CardTitle>
          {canEdit && !editMode && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleEdit}
              data-testid="edit-remarks-btn"
            >
              <Edit2 className="h-4 w-4 mr-1" /> Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap gap-1 h-auto bg-muted p-1 mb-4">
            {REMARK_TABS.map(tab => (
              <TabsTrigger 
                key={tab.id} 
                value={tab.id}
                className="text-xs px-2 py-1"
                data-testid={`remark-tab-${tab.id}`}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {REMARK_TABS.map(tab => (
            <TabsContent key={tab.id} value={tab.id}>
              {editMode ? (
                <div className="space-y-3">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder={`Enter ${tab.label} notes...`}
                    className="min-h-[200px] resize-none"
                    data-testid="remark-textarea"
                  />
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleSave} 
                      disabled={loading}
                      size="sm"
                      data-testid="save-remarks-btn"
                    >
                      <Save className="h-4 w-4 mr-1" /> Save
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleCancel}
                      size="sm"
                      data-testid="cancel-remarks-btn"
                    >
                      <X className="h-4 w-4 mr-1" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div 
                  className="min-h-[200px] p-3 bg-muted/50 rounded-md text-sm"
                  data-testid="remark-content"
                >
                  {/* Show leave notes from leave records for vacation/sick/holiday tabs */}
                  {['vacation', 'sick', 'holiday'].includes(tab.id) && leaveNotes[tab.id]?.length > 0 && (
                    <div className="mb-4 space-y-3">
                      <div className="font-semibold text-muted-foreground uppercase text-xs tracking-wide border-b pb-1 mb-2">
                        {tab.id === 'vacation' ? 'Vacation' : tab.id === 'sick' ? 'Sick Leave' : 'Holiday'} Notes from Leave Management
                      </div>
                      {leaveNotes[tab.id].map((note, idx) => (
                        <div key={idx} className="p-2 bg-background/50 rounded border-l-2 border-primary/50">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <span className="font-medium text-foreground">{note.personnelName}</span>
                            {note.station && <span>• {note.station}</span>}
                            {note.shift && (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                note.shift === 'A' ? 'bg-red-500/20 text-red-500' :
                                note.shift === 'B' ? 'bg-green-500/20 text-green-500' :
                                'bg-blue-500/20 text-blue-500'
                              }`}>
                                {note.shift} Shift
                              </span>
                            )}
                            <span>• {formatDisplayDate(note.startDate)}{note.hours > 24 ? ` - ${formatDisplayDate(note.endDate)}` : ''} ({note.hours}hrs)</span>
                          </div>
                          <div className="whitespace-pre-wrap">{note.notes}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Show manual remarks */}
                  {remarks[tab.id] ? (
                    <div className="whitespace-pre-wrap">
                      {['vacation', 'sick', 'holiday'].includes(tab.id) && leaveNotes[tab.id]?.length > 0 && (
                        <div className="font-semibold text-muted-foreground uppercase text-xs tracking-wide border-b pb-1 mb-2">
                          Manual Notes
                        </div>
                      )}
                      {remarks[tab.id]}
                    </div>
                  ) : (
                    !(['vacation', 'sick', 'holiday'].includes(tab.id) && leaveNotes[tab.id]?.length > 0) && (
                      <span className="text-muted-foreground italic">No {tab.label.toLowerCase()} notes for this date.</span>
                    )
                  )}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};
