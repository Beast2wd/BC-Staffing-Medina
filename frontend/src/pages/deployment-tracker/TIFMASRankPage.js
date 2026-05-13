import { useEffect, useState, useCallback, memo } from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { Flame, Trophy, CheckCircle, XCircle, Send, Calendar, MapPin, AlertTriangle, Edit2 } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { formatDisplayDate } from '../../utils/dateUtils';

// Memoized Edit Dialog Component to prevent re-renders
const TIFMASEditDialog = memo(({ open, entry, onClose, onSave, api }) => {
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (entry) {
      setFormData({ ...entry });
    }
  }, [entry]);

  const handleFieldChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/deployment-roster/${entry.id}`, formData);
      toast.success('Entry updated successfully');
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="edit-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-500">
            <Edit2 className="h-5 w-5" />
            Edit TIFMAS Roster Entry
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input 
              defaultValue={formData.name || ''} 
              onChange={(e) => handleFieldChange('name', e.target.value)}
              data-testid="edit-name"
            />
          </div>
          <div className="space-y-2">
            <Label>Rank</Label>
            <Select value={formData.rank || ''} onValueChange={(v) => handleFieldChange('rank', v)}>
              <SelectTrigger data-testid="edit-rank">
                <SelectValue placeholder="Select rank" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Fire Chief">Fire Chief</SelectItem>
                <SelectItem value="Asst. Chief">Asst. Chief</SelectItem>
                <SelectItem value="Deputy Chief">Deputy Chief</SelectItem>
                <SelectItem value="Battalion Chief">Battalion Chief</SelectItem>
                <SelectItem value="Captain">Captain</SelectItem>
                <SelectItem value="Lieutenant">Lieutenant</SelectItem>
                <SelectItem value="Engineer">Engineer</SelectItem>
                <SelectItem value="Firefighter">Firefighter</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>EMS Level</Label>
            <Select value={formData.ems_level || ''} onValueChange={(v) => handleFieldChange('ems_level', v)}>
              <SelectTrigger data-testid="edit-ems-level">
                <SelectValue placeholder="Select EMS level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Paramedic">Paramedic</SelectItem>
                <SelectItem value="EMT-A">EMT-A</SelectItem>
                <SelectItem value="EMT-B">EMT-B</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Pack Test Level</Label>
            <Select value={formData.pack_test_level || ''} onValueChange={(v) => handleFieldChange('pack_test_level', v)}>
              <SelectTrigger data-testid="edit-pack-test">
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Arduous">Arduous</SelectItem>
                <SelectItem value="Moderate">Moderate</SelectItem>
                <SelectItem value="Light">Light</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Last TIFMAS Deploy</Label>
            <Input 
              type="date"
              defaultValue={formData.last_tifmas_deploy || ''} 
              onChange={(e) => handleFieldChange('last_tifmas_deploy', e.target.value)}
              data-testid="edit-last-deploy"
            />
          </div>
          <div className="space-y-2">
            <Label>Deploys (12mo)</Label>
            <Input 
              type="number"
              defaultValue={formData.deployments_last_12mo || 0} 
              onChange={(e) => handleFieldChange('deployments_last_12mo', parseInt(e.target.value) || 0)}
              data-testid="edit-deploys-count"
            />
          </div>
          
          <div className="col-span-2 pt-4 border-t">
            <Label className="text-sm font-medium mb-3 block">TIFMAS Certifications</Label>
            <div className="grid grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={formData.ff1} 
                  onCheckedChange={(c) => handleFieldChange('ff1', c)}
                  data-testid="edit-ff1"
                />
                <Label>FF1</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={formData.crew_boss} 
                  onCheckedChange={(c) => handleFieldChange('crew_boss', c)}
                  data-testid="edit-crew-boss"
                />
                <Label>Crew Boss</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={formData.engine_boss} 
                  onCheckedChange={(c) => handleFieldChange('engine_boss', c)}
                  data-testid="edit-engine-boss"
                />
                <Label>Engine Boss</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={formData.astl} 
                  onCheckedChange={(c) => handleFieldChange('astl', c)}
                  data-testid="edit-astl"
                />
                <Label>ASTL</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={formData.wpu} 
                  onCheckedChange={(c) => handleFieldChange('wpu', c)}
                  data-testid="edit-wpu"
                />
                <Label>WPU</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={formData.eligible_tifmas} 
                  onCheckedChange={(c) => handleFieldChange('eligible_tifmas', c)}
                  data-testid="edit-eligible-tifmas"
                />
                <Label>TIFMAS Eligible</Label>
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

TIFMASEditDialog.displayName = 'TIFMASEditDialog';

export const TIFMASRankPage = () => {
  const { api, canEdit } = useAuth();
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState([]);
  const [showDeployDialog, setShowDeployDialog] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deploymentForm, setDeploymentForm] = useState({
    start_date: '',
    end_date: '',
    location: '',
    notes: ''
  });
  
  // Edit state
  const [editDialog, setEditDialog] = useState({ open: false, entry: null });

  const fetchRoster = async () => {
    setLoading(true);
    try {
      const response = await api.get('/deployment-roster/tifmas-rank');
      setRoster(response.data);
    } catch (error) {
      console.error('Error fetching TIFMAS rank:', error);
      toast.error('Failed to load TIFMAS rankings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoster();
  }, []);

  const handleSelectPersonnel = (personId, checked) => {
    if (checked) {
      setSelectedPersonnel(prev => [...prev, personId]);
    } else {
      setSelectedPersonnel(prev => prev.filter(id => id !== personId));
    }
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedPersonnel(roster.map(p => p.id));
    } else {
      setSelectedPersonnel([]);
    }
  };

  const openDeployDialog = () => {
    if (selectedPersonnel.length === 0) {
      toast.error('Please select at least one personnel to deploy');
      return;
    }
    setShowDeployDialog(true);
  };

  const closeDeployDialog = () => {
    setShowDeployDialog(false);
    setDeploymentForm({
      start_date: '',
      end_date: '',
      location: '',
      notes: ''
    });
  };

  const handleDeploy = async () => {
    if (!deploymentForm.start_date || !deploymentForm.end_date || !deploymentForm.location) {
      toast.error('Please fill in all required fields (Start Date, End Date, Location/Incident Name)');
      return;
    }

    setDeploying(true);
    try {
      const response = await api.post('/deployment-roster/deploy-tifmas', {
        personnel_ids: selectedPersonnel,
        start_date: deploymentForm.start_date,
        end_date: deploymentForm.end_date,
        location: deploymentForm.location,
        notes: deploymentForm.notes
      });

      toast.success(response.data.message);
      
      if (response.data.reminder) {
        toast.info(response.data.reminder, { duration: 8000 });
      }

      setSelectedPersonnel([]);
      closeDeployDialog();
      fetchRoster();
    } catch (error) {
      console.error('Error deploying personnel:', error);
      toast.error('Failed to deploy personnel');
    } finally {
      setDeploying(false);
    }
  };

  const getSelectedPersonnelDetails = () => {
    return roster.filter(p => selectedPersonnel.includes(p.id));
  };

  const openEditDialog = useCallback((entry) => {
    setEditDialog({ open: true, entry });
  }, []);

  const closeEditDialog = useCallback(() => {
    setEditDialog({ open: false, entry: null });
  }, []);

  const BooleanBadge = ({ value }) => (
    value ? 
      <CheckCircle className="h-4 w-4 text-green-500" /> : 
      <XCircle className="h-4 w-4 text-red-500/50" />
  );

  return (
    <div className="min-h-screen bg-background" data-testid="tifmas-rank-page">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-3xl uppercase tracking-wider font-bold flex items-center gap-2">
              <Flame className="h-8 w-8 text-orange-500" />
              TIFMAS Rank
            </h1>
            <p className="text-muted-foreground mt-1">
              Texas Intrastate Fire Mutual Aid System - Personnel ranked by deployment score
            </p>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <Badge variant="outline" className="bg-orange-500/20 text-orange-500 border-orange-500 px-4 py-2">
              <Trophy className="h-4 w-4 mr-2" />
              {roster.length} Eligible Personnel
            </Badge>
            
            {canEdit && (
              <Button 
                onClick={openDeployDialog}
                disabled={selectedPersonnel.length === 0}
                className="bg-orange-500 hover:bg-orange-600 text-white"
                data-testid="deploy-personnel-btn"
              >
                <Send className="h-4 w-4 mr-2" />
                Deploy Personnel ({selectedPersonnel.length})
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader className="bg-orange-500/10 border-b border-orange-500/20">
            <CardTitle className="text-orange-500 flex items-center gap-2">
              <Flame className="h-5 w-5" />
              TIFMAS Deployment Roster
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-center">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Rank</TableHead>
                    <TableHead>EMS Level</TableHead>
                    <TableHead className="text-center">Last Deploy</TableHead>
                    <TableHead className="text-center">Deploys (12mo)</TableHead>
                    <TableHead className="text-center">FF1</TableHead>
                    <TableHead className="text-center">Crew Boss</TableHead>
                    <TableHead className="text-center">Engine Boss</TableHead>
                    <TableHead className="text-center">ASTL</TableHead>
                    <TableHead>Pack Test</TableHead>
                    {canEdit && (
                      <>
                        <TableHead className="text-center w-16">Edit</TableHead>
                        <TableHead className="text-center w-20">
                          <div className="flex flex-col items-center gap-1">
                            <span>Deploy</span>
                            <Checkbox 
                              checked={selectedPersonnel.length === roster.length && roster.length > 0}
                              onCheckedChange={handleSelectAll}
                              data-testid="select-all-checkbox"
                            />
                          </div>
                        </TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roster.map((entry, index) => (
                    <TableRow 
                      key={entry.id} 
                      className={`${selectedPersonnel.includes(entry.id) ? 'bg-orange-500/10' : ''}`}
                    >
                      <TableCell className="text-center font-bold">
                        <span className="text-muted-foreground">{index + 1}</span>
                      </TableCell>
                      <TableCell className="font-medium">{entry.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{entry.rank}</Badge>
                      </TableCell>
                      <TableCell>{entry.ems_level}</TableCell>
                      <TableCell className="text-center">
                        {entry.last_tifmas_deploy ? formatDisplayDate(entry.last_tifmas_deploy) : '-'}
                      </TableCell>
                      <TableCell className="text-center">{entry.deployments_last_12mo || 0}</TableCell>
                      <TableCell className="text-center"><BooleanBadge value={entry.ff1} /></TableCell>
                      <TableCell className="text-center"><BooleanBadge value={entry.crew_boss} /></TableCell>
                      <TableCell className="text-center"><BooleanBadge value={entry.engine_boss} /></TableCell>
                      <TableCell className="text-center"><BooleanBadge value={entry.astl} /></TableCell>
                      <TableCell>
                        <Badge variant={entry.pack_test_level === 'Arduous' ? 'default' : 'secondary'}>
                          {entry.pack_test_level || '-'}
                        </Badge>
                      </TableCell>
                      {canEdit && (
                        <>
                          <TableCell className="text-center">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => openEditDialog(entry)}
                              data-testid={`edit-personnel-${entry.id}`}
                            >
                              <Edit2 className="h-4 w-4 text-orange-500" />
                            </Button>
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox 
                              checked={selectedPersonnel.includes(entry.id)}
                              onCheckedChange={(checked) => handleSelectPersonnel(entry.id, checked)}
                              data-testid={`select-personnel-${entry.id}`}
                            />
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                  {roster.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={canEdit ? 13 : 11} className="text-center py-8 text-muted-foreground">
                        No TIFMAS-eligible personnel found. Import roster data from the Roster page.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Deploy Personnel Dialog */}
      <Dialog open={showDeployDialog} onOpenChange={setShowDeployDialog}>
        <DialogContent className="max-w-lg" data-testid="deploy-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-500">
              <Flame className="h-5 w-5" />
              TIFMAS Deployment
            </DialogTitle>
            <DialogDescription>
              The following personnel have been selected for TIFMAS Deployment. Do you wish to proceed?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Selected Personnel ({selectedPersonnel.length})</Label>
              <div className="max-h-40 overflow-y-auto border rounded-md p-3 bg-muted/50">
                {getSelectedPersonnelDetails().map((person, idx) => (
                  <div key={person.id} className="flex items-center gap-2 py-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="font-medium">{person.name}</span>
                    <Badge variant="outline" className="text-xs">{person.rank}</Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date" className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Start Date *
                </Label>
                <Input
                  id="start_date"
                  type="date"
                  value={deploymentForm.start_date}
                  onChange={(e) => setDeploymentForm(prev => ({ ...prev, start_date: e.target.value }))}
                  data-testid="deploy-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date" className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  End Date *
                </Label>
                <Input
                  id="end_date"
                  type="date"
                  value={deploymentForm.end_date}
                  onChange={(e) => setDeploymentForm(prev => ({ ...prev, end_date: e.target.value }))}
                  data-testid="deploy-end-date"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location" className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                Location / Incident Name *
              </Label>
              <Input
                id="location"
                value={deploymentForm.location}
                onChange={(e) => setDeploymentForm(prev => ({ ...prev, location: e.target.value }))}
                placeholder="Enter deployment location or incident name..."
                data-testid="deploy-location"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={deploymentForm.notes}
                onChange={(e) => setDeploymentForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any additional notes..."
                rows={2}
                data-testid="deploy-notes"
              />
            </div>

            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md text-sm">
              <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-600 dark:text-yellow-400">Notification Reminder</p>
                <p className="text-muted-foreground">
                  Text and email notifications to deployed personnel will need to be configured separately.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={closeDeployDialog}
              data-testid="deploy-cancel-btn"
            >
              No
            </Button>
            <Button
              onClick={handleDeploy}
              disabled={deploying}
              className="bg-orange-500 hover:bg-orange-600"
              data-testid="deploy-confirm-btn"
            >
              {deploying ? 'Deploying...' : 'Yes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Personnel Dialog - Memoized Component */}
      <TIFMASEditDialog 
        open={editDialog.open}
        entry={editDialog.entry}
        onClose={closeEditDialog}
        onSave={fetchRoster}
        api={api}
      />
    </div>
  );
};
