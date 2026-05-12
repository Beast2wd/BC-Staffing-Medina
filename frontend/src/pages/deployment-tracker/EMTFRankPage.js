import { useEffect, useState } from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { Ambulance, Trophy, CheckCircle, XCircle, Send, Calendar, MapPin, AlertTriangle } from 'lucide-react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { formatDisplayDate } from '../../utils/dateUtils';

export const EMTFRankPage = () => {
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

  const fetchRoster = async () => {
    setLoading(true);
    try {
      const response = await api.get('/deployment-roster/emtf-rank');
      setRoster(response.data);
    } catch (error) {
      console.error('Error fetching EMTF rank:', error);
      toast.error('Failed to load EMTF rankings');
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
      const response = await api.post('/deployment-roster/deploy-emtf', {
        personnel_ids: selectedPersonnel,
        start_date: deploymentForm.start_date,
        end_date: deploymentForm.end_date,
        location: deploymentForm.location,
        notes: deploymentForm.notes
      });

      toast.success(response.data.message);
      
      // Show reminder about text/email setup
      if (response.data.reminder) {
        toast.info(response.data.reminder, { duration: 8000 });
      }

      // Reset state and refresh
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

  const BooleanBadge = ({ value }) => (
    value ? 
      <CheckCircle className="h-4 w-4 text-green-500" /> : 
      <XCircle className="h-4 w-4 text-red-500/50" />
  );

  return (
    <div className="min-h-screen bg-background" data-testid="emtf-rank-page">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-3xl uppercase tracking-wider font-bold flex items-center gap-2">
              <Ambulance className="h-8 w-8 text-blue-500" />
              EMTF Rank
            </h1>
            <p className="text-muted-foreground mt-1">
              Emergency Medical Task Force - Personnel ranked by deployment score
            </p>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <Badge variant="outline" className="bg-blue-500/20 text-blue-500 border-blue-500 px-4 py-2">
              <Trophy className="h-4 w-4 mr-2" />
              {roster.length} Eligible Personnel
            </Badge>
            
            {canEdit && (
              <Button 
                onClick={openDeployDialog}
                disabled={selectedPersonnel.length === 0}
                className="bg-blue-500 hover:bg-blue-600 text-white"
                data-testid="deploy-personnel-btn"
              >
                <Send className="h-4 w-4 mr-2" />
                Deploy Personnel ({selectedPersonnel.length})
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader className="bg-blue-500/10 border-b border-blue-500/20">
            <CardTitle className="text-blue-500 flex items-center gap-2">
              <Ambulance className="h-5 w-5" />
              EMTF Deployment Roster
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
                    <TableHead className="text-center">MIST</TableHead>
                    <TableHead className="text-center">MedL</TableHead>
                    <TableHead className="text-center">Tech-Spec</TableHead>
                    <TableHead>Pack Test</TableHead>
                    {canEdit && (
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
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roster.map((entry, index) => (
                    <TableRow 
                      key={entry.id} 
                      className={`${index < 3 ? 'bg-blue-500/5' : ''} ${selectedPersonnel.includes(entry.id) ? 'bg-blue-500/10' : ''}`}
                    >
                      <TableCell className="text-center font-bold">
                        {index === 0 ? (
                          <span className="text-blue-500 text-lg">1st</span>
                        ) : index === 1 ? (
                          <span className="text-blue-400">2nd</span>
                        ) : index === 2 ? (
                          <span className="text-blue-300">3rd</span>
                        ) : (
                          <span className="text-muted-foreground">{index + 1}</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{entry.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{entry.rank}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={entry.ems_level === 'Paramedic' ? 'default' : 'secondary'}>
                          {entry.ems_level}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {entry.last_emtf_deploy ? formatDisplayDate(entry.last_emtf_deploy) : '-'}
                      </TableCell>
                      <TableCell className="text-center">{entry.deployments_last_12mo || 0}</TableCell>
                      <TableCell className="text-center"><BooleanBadge value={entry.mist} /></TableCell>
                      <TableCell className="text-center"><BooleanBadge value={entry.medl} /></TableCell>
                      <TableCell className="text-center"><BooleanBadge value={entry.tech_spec} /></TableCell>
                      <TableCell>
                        <Badge variant={entry.pack_test_level === 'Arduous' ? 'default' : 'secondary'}>
                          {entry.pack_test_level || '-'}
                        </Badge>
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-center">
                          <Checkbox 
                            checked={selectedPersonnel.includes(entry.id)}
                            onCheckedChange={(checked) => handleSelectPersonnel(entry.id, checked)}
                            data-testid={`select-personnel-${entry.id}`}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {roster.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={canEdit ? 11 : 10} className="text-center py-8 text-muted-foreground">
                        No EMTF-eligible personnel found. Import roster data from the Roster page.
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
            <DialogTitle className="flex items-center gap-2 text-blue-500">
              <Ambulance className="h-5 w-5" />
              EMTF Deployment
            </DialogTitle>
            <DialogDescription>
              The following personnel have been selected for EMTF Deployment. Do you wish to proceed?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Selected Personnel List */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Selected Personnel ({selectedPersonnel.length})</Label>
              <div className="max-h-40 overflow-y-auto border rounded-md p-3 bg-muted/50">
                {getSelectedPersonnelDetails().map((person, idx) => (
                  <div key={person.id} className="flex items-center gap-2 py-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="font-medium">{person.name}</span>
                    <Badge variant="outline" className="text-xs">{person.rank}</Badge>
                    <Badge variant={person.ems_level === 'Paramedic' ? 'default' : 'secondary'} className="text-xs">
                      {person.ems_level}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Date Selection */}
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

            {/* Location/Incident Name */}
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

            {/* Notes */}
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

            {/* Reminder Notice */}
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
              className="bg-blue-500 hover:bg-blue-600"
              data-testid="deploy-confirm-btn"
            >
              {deploying ? 'Deploying...' : 'Yes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
