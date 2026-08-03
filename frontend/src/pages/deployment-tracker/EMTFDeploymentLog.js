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
  Ambulance,
  Users, 
  RefreshCw, 
  Calendar,
  MapPin,
  Plus,
  Search,
  CheckCircle2,
  FileText,
  Clock
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
import { Textarea } from '../../components/ui/textarea';

export const EMTFDeploymentLog = () => {
  const { api } = useAuth();
  const [personnel, setPersonnel] = useState([]);
  const [totalEligible, setTotalEligible] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [deployDialog, setDeployDialog] = useState(false);
  const [deploymentData, setDeploymentData] = useState({
    incident_name: '',
    location: '',
    start_date: '',
    end_date: '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);

  const fetchPersonnel = async () => {
    try {
      setLoading(true);
      const response = await api.get('/deployment-roster/next-rotation/EMTF?count=100');
      setPersonnel(response.data.suggestions);
      setTotalEligible(response.data.total_eligible);
    } catch (error) {
      console.error('Failed to fetch EMTF personnel:', error);
      toast.error('Failed to load EMTF deployment log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPersonnel();
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
        deployment_type: 'EMTF',
        incident_name: deploymentData.incident_name,
        location: deploymentData.location,
        start_date: deploymentData.start_date,
        end_date: deploymentData.end_date,
        notes: deploymentData.notes,
        personnel: selectedPersonnel,
        status: 'active'
      });

      toast.success(`EMTF deployment created with ${selectedIds.length} personnel`);
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
    } catch (error) {
      console.error('Failed to create deployment:', error);
      toast.error('Failed to create deployment');
    } finally {
      setSaving(false);
    }
  };

  const filteredPersonnel = personnel.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.person_rank.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8" data-testid="emtf-deployment-log">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <Ambulance className="h-8 w-8 text-blue-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" data-testid="emtf-log-title">EMTF Deployment Log</h1>
              <p className="text-muted-foreground">Emergency Medical Task Force</p>
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
              className="bg-blue-500 hover:bg-blue-600"
              data-testid="emtf-deploy-selected-btn"
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
                <div className="p-3 bg-blue-500/10 rounded-full">
                  <Users className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="emtf-eligible-count">{totalEligible}</p>
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
                <div className="p-3 bg-orange-500/10 rounded-full">
                  <Clock className="h-6 w-6 text-orange-500" />
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
              data-testid="emtf-search-input"
            />
          </div>
        </div>

        {/* Info Banner */}
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
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
                  <TableRow className="bg-blue-50 dark:bg-blue-900/10">
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
                    <TableHead>Last EMTF Deploy</TableHead>
                    <TableHead className="text-center">12mo Deployments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPersonnel.map((person, index) => (
                    <TableRow 
                      key={person.id}
                      className={`${selectedIds.includes(person.id) ? 'bg-blue-50 dark:bg-blue-900/10' : ''} 
                        ${person.last_deployment === 'Never' ? 'border-l-4 border-l-green-500' : ''}`}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(person.id)}
                          onCheckedChange={() => toggleSelection(person.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant={index < 3 ? "default" : "outline"} className={index < 3 ? "bg-blue-500" : ""}>
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

        {/* Deploy Dialog */}
        <Dialog open={deployDialog} onOpenChange={setDeployDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Ambulance className="h-5 w-5 text-blue-500" />
                Create EMTF Deployment
              </DialogTitle>
              <DialogDescription>
                Deploy {selectedIds.length} selected personnel to an EMTF incident
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="incident">Incident Name *</Label>
                <Input
                  id="incident"
                  placeholder="e.g., Hurricane Response - Coastal Region"
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
                    placeholder="e.g., Galveston County, TX"
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
                className="bg-blue-500 hover:bg-blue-600"
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

export default EMTFDeploymentLog;
