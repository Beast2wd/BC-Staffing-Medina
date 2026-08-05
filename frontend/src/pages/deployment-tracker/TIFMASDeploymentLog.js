import { useState, useEffect } from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Checkbox } from '../../components/ui/checkbox';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { 
  Flame,
  Users, 
  RefreshCw, 
  Calendar,
  MapPin,
  Plus,
  Search,
  CheckCircle2,
  FileText,
  Clock,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { Textarea } from '../../components/ui/textarea';

export const TIFMASDeploymentLog = () => {
  const { api } = useAuth();
  const [personnel, setPersonnel] = useState([]);
  const [recentDeployments, setRecentDeployments] = useState([]);
  const [totalEligible, setTotalEligible] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [deployDialog, setDeployDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, deployment: null });
  const [deploymentData, setDeploymentData] = useState({
    incident_name: '',
    location: '',
    start_date: '',
    end_date: '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchPersonnel = async () => {
    try {
      setLoading(true);
      const response = await api.get('/deployment-roster/next-rotation/TIFMAS?count=100');
      setPersonnel(response.data.suggestions);
      setTotalEligible(response.data.total_eligible);
    } catch (error) {
      console.error('Failed to fetch TIFMAS personnel:', error);
      toast.error('Failed to load TIFMAS deployment log');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentDeployments = async () => {
    try {
      const response = await api.get('/deployment-history?deployment_type=TIFMAS&limit=10');
      setRecentDeployments(response.data.items || response.data || []);
    } catch (error) {
      console.error('Failed to fetch recent deployments:', error);
    }
  };

  useEffect(() => {
    fetchPersonnel();
    fetchRecentDeployments();
  }, []);

  const toggleSelection = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === filteredPersonnel.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPersonnel.map(p => p.id));
    }
  };

  const handleCreateDeployment = async () => {
    if (!deploymentData.incident_name || !deploymentData.location || !deploymentData.start_date) {
      toast.error('Please fill in incident name, location, and start date');
      return;
    }

    if (selectedIds.length === 0) {
      toast.error('Please select at least one person to deploy');
      return;
    }

    try {
      setSaving(true);
      const selectedPersonnel = personnel
        .filter(p => selectedIds.includes(p.id))
        .map(p => ({
          id: p.id,
          name: p.name,
          rank: p.person_rank,
          position: ''
        }));

      await api.post('/deployment-history', {
        deployment_type: 'TIFMAS',
        incident_name: deploymentData.incident_name,
        location: deploymentData.location,
        start_date: deploymentData.start_date,
        end_date: deploymentData.end_date,
        notes: deploymentData.notes,
        personnel: selectedPersonnel,
        status: 'active'
      });

      toast.success(`TIFMAS deployment created with ${selectedIds.length} personnel`);
      setDeployDialog(false);
      setSelectedIds([]);
      setDeploymentData({
        incident_name: '',
        location: '',
        start_date: '',
        end_date: '',
        notes: ''
      });
      
      // Refresh to show updated rotation order
      fetchPersonnel();
      fetchRecentDeployments();
    } catch (error) {
      console.error('Failed to create deployment:', error);
      toast.error('Failed to create deployment');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDeployment = async () => {
    if (!deleteDialog.deployment) return;
    
    try {
      setDeleting(true);
      await api.delete(`/deployment-history/${deleteDialog.deployment.id}`);
      toast.success('Deployment deleted and rotation stats reverted');
      setDeleteDialog({ open: false, deployment: null });
      
      // Refresh both lists
      fetchPersonnel();
      fetchRecentDeployments();
    } catch (error) {
      console.error('Failed to delete deployment:', error);
      toast.error('Failed to delete deployment');
    } finally {
      setDeleting(false);
    }
  };

  const filteredPersonnel = personnel.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.person_rank.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8" data-testid="tifmas-deployment-log">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-500/10 rounded-lg">
              <Flame className="h-8 w-8 text-orange-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" data-testid="tifmas-log-title">TIFMAS Deployment Log</h1>
              <p className="text-muted-foreground">Texas Intrastate Fire Mutual Aid System</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchPersonnel} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button 
              onClick={() => setDeployDialog(true)}
              disabled={selectedIds.length === 0}
              className="bg-orange-500 hover:bg-orange-600"
              data-testid="tifmas-deploy-selected-btn"
            >
              <Plus className="h-4 w-4 mr-2" />
              Deploy Selected ({selectedIds.length})
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-500/10 rounded-full">
                  <Users className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="tifmas-eligible-count">{totalEligible}</p>
                  <p className="text-sm text-muted-foreground">Eligible Personnel</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/10 rounded-full">
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{selectedIds.length}</p>
                  <p className="text-sm text-muted-foreground">Selected for Deployment</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-full">
                  <Clock className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {personnel.filter(p => p.last_deployment === 'Never').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Never Deployed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or rank..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="tifmas-search-input"
            />
          </div>
        </div>

        {/* Info Banner */}
        <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-lg">
          <p className="text-sm text-orange-800 dark:text-orange-200">
            <strong>Fair Rotation:</strong> Personnel are ordered by last deployment date. 
            Those who haven't deployed recently appear at the top. After a deployment, they move down the list.
          </p>
        </div>

        {/* Personnel Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-orange-50 dark:bg-orange-900/10">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.length === filteredPersonnel.length && filteredPersonnel.length > 0}
                        onCheckedChange={selectAll}
                      />
                    </TableHead>
                    <TableHead className="w-16">Order</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Rank</TableHead>
                    <TableHead>EMS Level</TableHead>
                    <TableHead>Last TIFMAS Deploy</TableHead>
                    <TableHead className="text-center">12mo Deployments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPersonnel.map((person, index) => (
                    <TableRow 
                      key={person.id}
                      className={`${selectedIds.includes(person.id) ? 'bg-orange-50 dark:bg-orange-900/10' : ''} 
                        ${person.last_deployment === 'Never' ? 'border-l-4 border-l-green-500' : ''}`}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(person.id)}
                          onCheckedChange={() => toggleSelection(person.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant={index < 3 ? "default" : "outline"} className={index < 3 ? "bg-orange-500" : ""}>
                          #{index + 1}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{person.name}</TableCell>
                      <TableCell>{person.person_rank}</TableCell>
                      <TableCell>{person.ems_level || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className={person.last_deployment === 'Never' ? 'text-green-600 font-semibold' : ''}>
                            {person.last_deployment}
                          </span>
                          {person.days_since_deployment !== null && person.last_deployment !== 'Never' && (
                            <span className="text-xs text-muted-foreground">
                              ({person.days_since_deployment} days ago)
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={person.deployments_12mo === 0 ? 'outline' : 'secondary'}>
                          {person.deployments_12mo}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent Deployments */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Recent TIFMAS Deployments
            </CardTitle>
            <CardDescription>
              View and manage recent deployments. Delete accidental deployments to revert rotation stats.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentDeployments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No recent TIFMAS deployments
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Incident</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Personnel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentDeployments.map((deployment) => (
                    <TableRow key={deployment.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {deployment.start_date}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{deployment.incident_name}</TableCell>
                      <TableCell>{deployment.location}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(deployment.personnel || []).slice(0, 3).map((p, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {p.name}
                            </Badge>
                          ))}
                          {(deployment.personnel || []).length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{deployment.personnel.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={deployment.status === 'active' ? 'default' : 'secondary'}>
                          {deployment.status || 'active'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteDialog({ open: true, deployment })}
                          data-testid={`delete-deployment-${deployment.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, deployment: null })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Delete Deployment?
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>This will permanently delete this deployment and revert rotation stats for all deployed personnel:</p>
                {deleteDialog.deployment && (
                  <div className="mt-3 p-3 bg-muted rounded-lg text-sm">
                    <p><strong>Incident:</strong> {deleteDialog.deployment.incident_name}</p>
                    <p><strong>Date:</strong> {deleteDialog.deployment.start_date}</p>
                    <p><strong>Personnel:</strong> {(deleteDialog.deployment.personnel || []).map(p => p.name).join(', ')}</p>
                  </div>
                )}
                <p className="text-amber-600 font-medium mt-2">
                  Personnel will move back up in the rotation order as if this deployment never happened.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteDeployment}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Deployment
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Deploy Dialog */}
        <Dialog open={deployDialog} onOpenChange={setDeployDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-500" />
                Create TIFMAS Deployment
              </DialogTitle>
              <DialogDescription>
                Deploy {selectedIds.length} selected personnel to a TIFMAS incident
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="incident">Incident Name *</Label>
                <Input
                  id="incident"
                  placeholder="e.g., Wildfire - Johnson County"
                  value={deploymentData.incident_name}
                  onChange={(e) => setDeploymentData(d => ({ ...d, incident_name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="location">Location *</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="location"
                    placeholder="e.g., Johnson County, TX"
                    className="pl-10"
                    value={deploymentData.location}
                    onChange={(e) => setDeploymentData(d => ({ ...d, location: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start">Start Date *</Label>
                  <Input
                    id="start"
                    type="date"
                    value={deploymentData.start_date}
                    onChange={(e) => setDeploymentData(d => ({ ...d, start_date: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="end">End Date</Label>
                  <Input
                    id="end"
                    type="date"
                    value={deploymentData.end_date}
                    onChange={(e) => setDeploymentData(d => ({ ...d, end_date: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes about the deployment..."
                  value={deploymentData.notes}
                  onChange={(e) => setDeploymentData(d => ({ ...d, notes: e.target.value }))}
                />
              </div>

              {/* Selected Personnel Preview */}
              <div>
                <Label>Selected Personnel ({selectedIds.length})</Label>
                <div className="mt-2 p-3 bg-muted rounded-lg max-h-32 overflow-y-auto">
                  <div className="flex flex-wrap gap-2">
                    {personnel
                      .filter(p => selectedIds.includes(p.id))
                      .map(p => (
                        <Badge key={p.id} variant="secondary">
                          {p.name}
                        </Badge>
                      ))}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDeployDialog(false)}>Cancel</Button>
              <Button 
                onClick={handleCreateDeployment} 
                disabled={saving}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {saving ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Create Deployment
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default TIFMASDeploymentLog;
