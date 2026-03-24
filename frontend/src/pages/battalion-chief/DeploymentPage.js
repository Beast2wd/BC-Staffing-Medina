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
import { Plus, Save, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';

export const DeploymentPage = () => {
  const { api, canEdit } = useAuth();
  const { personnel, fetchAllData, selectedBattalion } = useStaffing();
  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formData, setFormData] = useState({
    personnel_id: '',
    deployment_type: '',
    start_date: '',
    end_date: '',
    location: '',
    notes: ''
  });

  const deploymentTypes = [
    'Mutual Aid',
    'Strike Team',
    'Task Force',
    'Training',
    'Special Assignment',
    'Administrative',
    'Other'
  ];

  useEffect(() => {
    fetchAllData();
    fetchDeployments();
  }, [selectedBattalion]);

  const fetchDeployments = async () => {
    try {
      const response = await api.get('/deployments');
      setDeployments(response.data);
    } catch (error) {
      console.error('Error fetching deployments:', error);
    }
  };

  const handleAddDeployment = async () => {
    if (!formData.personnel_id || !formData.deployment_type || !formData.start_date || !formData.end_date) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    try {
      await api.post('/deployments', {
        id: crypto.randomUUID(),
        ...formData
      });
      toast.success('Deployment created');
      setShowAddDialog(false);
      fetchDeployments();
      setFormData({ personnel_id: '', deployment_type: '', start_date: '', end_date: '', location: '', notes: '' });
    } catch (error) {
      toast.error('Failed to create deployment');
    } finally {
      setLoading(false);
    }
  };

  const getPersonnelName = (personnelId) => {
    const person = personnel.find(p => p.id === personnelId);
    return person ? `${person.rank} ${person.name}` : personnelId;
  };

  const getPersonnelInfo = (personnelId) => {
    return personnel.find(p => p.id === personnelId);
  };

  const isActive = (deployment) => {
    const today = new Date().toISOString().split('T')[0];
    return deployment.start_date <= today && deployment.end_date >= today;
  };

  return (
    <div className="min-h-screen bg-background" data-testid="deployment-page">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-3xl uppercase tracking-wider font-bold">
              Deployments
            </h1>
            <p className="text-muted-foreground mt-1">
              Track personnel deployments and special assignments
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <BattalionSelector />
            {canEdit && (
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button data-testid="add-deployment-btn">
                    <Plus className="h-4 w-4 mr-2" /> Add Deployment
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="font-heading uppercase">New Deployment</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Personnel</Label>
                      <Select 
                        value={formData.personnel_id} 
                        onValueChange={(v) => setFormData({...formData, personnel_id: v})}
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
                      <Label>Deployment Type</Label>
                      <Select 
                        value={formData.deployment_type} 
                        onValueChange={(v) => setFormData({...formData, deployment_type: v})}
                      >
                        <SelectTrigger data-testid="type-select">
                          <SelectValue placeholder="Select Type" />
                        </SelectTrigger>
                        <SelectContent>
                          {deploymentTypes.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Date</Label>
                        <Input
                          type="date"
                          value={formData.start_date}
                          onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                          data-testid="start-date-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>End Date</Label>
                        <Input
                          type="date"
                          value={formData.end_date}
                          onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                          data-testid="end-date-input"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Location</Label>
                      <Input
                        value={formData.location}
                        onChange={(e) => setFormData({...formData, location: e.target.value})}
                        placeholder="Deployment location..."
                        data-testid="location-input"
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

                    <Button onClick={handleAddDeployment} disabled={loading} className="w-full" data-testid="save-deployment-btn">
                      <Save className="h-4 w-4 mr-2" /> Save Deployment
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Active Deployments */}
        <Card className="mb-6" data-testid="active-deployments-card">
          <CardHeader>
            <CardTitle className="font-heading uppercase text-green-500">Active Deployments</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Personnel</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deployments.filter(isActive).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No active deployments
                    </TableCell>
                  </TableRow>
                ) : (
                  deployments.filter(isActive).map(deployment => {
                    const person = getPersonnelInfo(deployment.personnel_id);
                    return (
                      <TableRow key={deployment.id} data-testid={`deployment-row-${deployment.id}`}>
                        <TableCell className="font-medium">{getPersonnelName(deployment.personnel_id)}</TableCell>
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
                        <TableCell>{deployment.deployment_type}</TableCell>
                        <TableCell>{deployment.location}</TableCell>
                        <TableCell>{deployment.start_date}</TableCell>
                        <TableCell>{deployment.end_date}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{deployment.notes || '-'}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* All Deployments */}
        <Card data-testid="all-deployments-card">
          <CardHeader>
            <CardTitle className="font-heading uppercase">All Deployments</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Personnel</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deployments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No deployments recorded
                    </TableCell>
                  </TableRow>
                ) : (
                  deployments.map(deployment => (
                    <TableRow key={deployment.id}>
                      <TableCell className="font-medium">{getPersonnelName(deployment.personnel_id)}</TableCell>
                      <TableCell>{deployment.deployment_type}</TableCell>
                      <TableCell>{deployment.location}</TableCell>
                      <TableCell>{deployment.start_date}</TableCell>
                      <TableCell>{deployment.end_date}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${
                          isActive(deployment) ? 'bg-green-500/20 text-green-500' : 'bg-gray-500/20 text-gray-500'
                        }`}>
                          {isActive(deployment) ? 'Active' : 'Completed'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
