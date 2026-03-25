import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useAuth } from '../../context/AuthContext';
import { useStaffing } from '../../context/StaffingContext';
import { toast } from 'sonner';
import { Edit2, Save, X } from 'lucide-react';

const REMARK_TABS = [
  { id: 'overtime', label: 'Overtime' },
  { id: 'holiday', label: 'HOLIDAY' },
  { id: 'vacation', label: 'VACATION' },
  { id: 'sick', label: 'SICK' },
  { id: 'remarks', label: 'Remarks' },
  { id: 'district_fill_in', label: 'District Fill-In' },
  { id: 'sap_adjust', label: 'SAP Adjust' },
];

export const RemarksPanel = () => {
  const { api, canEdit } = useAuth();
  const { selectedDate, selectedBattalion } = useStaffing();
  const [activeTab, setActiveTab] = useState('overtime');
  const [remarks, setRemarks] = useState({});
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(false);

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
                  className="min-h-[200px] p-3 bg-muted/50 rounded-md text-sm whitespace-pre-wrap"
                  data-testid="remark-content"
                >
                  {remarks[tab.id] || (
                    <span className="text-muted-foreground italic">No {tab.label.toLowerCase()} notes for this date.</span>
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
