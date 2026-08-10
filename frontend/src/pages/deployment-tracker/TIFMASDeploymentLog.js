import { useState, useEffect, useRef } from 'react';
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
  AlertTriangle,
  Upload,
  UserPlus,
  Download,
  Edit2,
  RotateCcw
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';

export const TIFMASDeploymentLog = () => {
  const { api } = useAuth();
  const fileInputRef = useRef(null);
  const [personnel, setPersonnel] = useState([]);
  const [allPersonnel, setAllPersonnel] = useState([]); // For manual entry dropdown
  const [recentDeployments, setRecentDeployments] = useState([]);
  const [totalEligible, setTotalEligible] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [deployDialog, setDeployDialog] = useState(false);
  const [manualEntryDialog, setManualEntryDialog] = useState(false);
  const [importDialog, setImportDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, deployment: null });
  const [deploymentData, setDeploymentData] = useState({
    incident_name: '',
    location: '',
    start_date: '',
    end_date: '',
    notes: ''
  });
  const [manualEntryData, setManualEntryData] = useState({
    personnel_id: '',
    personnel_name: '',
    personnel_rank: '',
    incident_name: '',
    location: '',
    start_date: '',
    end_date: '',
    notes: ''
  });
  const [editStatsDialog, setEditStatsDialog] = useState({ open: false, person: null });
  const [editStatsData, setEditStatsData] = useState({
    last_tifmas_deploy: '',
    deployments_12mo: 0
  });
  const [csvData, setCsvData] = useState([]);
  const [csvPreview, setCsvPreview] = useState([]);
  const [importing, setImporting] = useState(false);
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

  const fetchAllPersonnel = async () => {
    try {
      const response = await api.get('/deployment-roster');
      const roster = response.data.roster || response.data || [];
      setAllPersonnel(roster.filter(p => p.tifmas_eligible));
    } catch (error) {
      console.error('Failed to fetch all personnel:', error);
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
    fetchAllPersonnel();
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

  // Manual Entry Handler
  const handleManualEntry = async () => {
    if (!manualEntryData.personnel_id || !manualEntryData.incident_name || !manualEntryData.start_date) {
      toast.error('Please select personnel and fill in incident name and start date');
      return;
    }

    try {
      setSaving(true);
      await api.post('/deployment-history', {
        deployment_type: 'TIFMAS',
        incident_name: manualEntryData.incident_name,
        location: manualEntryData.location,
        start_date: manualEntryData.start_date,
        end_date: manualEntryData.end_date,
        notes: manualEntryData.notes,
        personnel: [{
          id: manualEntryData.personnel_id,
          name: manualEntryData.personnel_name,
          rank: manualEntryData.personnel_rank,
          position: ''
        }],
        status: manualEntryData.end_date ? 'completed' : 'active'
      });

      toast.success(`Historical TIFMAS deployment added for ${manualEntryData.personnel_name}`);
      setManualEntryDialog(false);
      setManualEntryData({
        personnel_id: '',
        personnel_name: '',
        personnel_rank: '',
        incident_name: '',
        location: '',
        start_date: '',
        end_date: '',
        notes: ''
      });
      
      fetchPersonnel();
      fetchRecentDeployments();
    } catch (error) {
      console.error('Failed to create manual entry:', error);
      toast.error('Failed to create deployment entry');
    } finally {
      setSaving(false);
    }
  };

  // CSV Import Handlers
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
        
        const data = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/['"]/g, ''));
          if (values.length >= 3) {
            const row = {};
            headers.forEach((header, idx) => {
              row[header] = values[idx] || '';
            });
            data.push(row);
          }
        }

        setCsvData(data);
        setCsvPreview(data.slice(0, 5));
        setImportDialog(true);
      } catch (error) {
        console.error('Failed to parse CSV:', error);
        toast.error('Failed to parse CSV file');
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  const handleImportCSV = async () => {
    if (csvData.length === 0) {
      toast.error('No data to import');
      return;
    }

    setImporting(true);
    let successCount = 0;
    let errorCount = 0;

    for (const row of csvData) {
      try {
        // Find personnel by name
        const personnelName = row.personnel_name || row.name || row.personnel;
        const matchedPerson = allPersonnel.find(p => 
          p.name.toLowerCase() === personnelName?.toLowerCase() ||
          p.name.toLowerCase().includes(personnelName?.toLowerCase())
        );

        if (!matchedPerson) {
          console.warn(`Personnel not found: ${personnelName}`);
          errorCount++;
          continue;
        }

        await api.post('/deployment-history', {
          deployment_type: 'TIFMAS',
          incident_name: row.incident_name || row.incident || 'Historical Deployment',
          location: row.location || '',
          start_date: row.start_date || row.date,
          end_date: row.end_date || '',
          notes: row.notes || 'Imported from CSV',
          personnel: [{
            id: matchedPerson.id,
            name: matchedPerson.name,
            rank: matchedPerson.rank || '',
            position: ''
          }],
          status: 'completed'
        });
        successCount++;
      } catch (error) {
        console.error('Failed to import row:', row, error);
        errorCount++;
      }
    }

    setImporting(false);
    setImportDialog(false);
    setCsvData([]);
    setCsvPreview([]);

    if (successCount > 0) {
      toast.success(`Successfully imported ${successCount} deployment records`);
      fetchPersonnel();
      fetchRecentDeployments();
    }
    if (errorCount > 0) {
      toast.error(`Failed to import ${errorCount} records (personnel not found or invalid data)`);
    }
  };

  const downloadTemplate = () => {
    const template = 'personnel_name,incident_name,location,start_date,end_date,notes\n"Last, First","Wildfire Response","Johnson County, TX","2024-01-15","2024-01-20","Example deployment"';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tifmas_deployment_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const openEditStats = (person) => {
    setEditStatsData({
      last_tifmas_deploy: person.last_deployment === 'Never' ? '' : (person.last_tifmas_deploy || ''),
      deployments_12mo: person.deployments_12mo || 0
    });
    setEditStatsDialog({ open: true, person });
  };

  const handleResetStats = async () => {
    if (!editStatsDialog.person) return;
    
    try {
      setSaving(true);
      await api.put(`/deployment-roster/${editStatsDialog.person.id}/reset-stats`, {
        reset_tifmas: true
      });
      toast.success(`TIFMAS stats reset for ${editStatsDialog.person.name}`);
      setEditStatsDialog({ open: false, person: null });
      fetchPersonnel();
    } catch (error) {
      console.error('Failed to reset stats:', error);
      toast.error('Failed to reset deployment stats');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStats = async () => {
    if (!editStatsDialog.person) return;
    
    try {
      setSaving(true);
      await api.put(`/deployment-roster/${editStatsDialog.person.id}/reset-stats`, {
        last_tifmas_deploy: editStatsData.last_tifmas_deploy || null,
        deployments_last_12mo: editStatsData.deployments_12mo
      });
      toast.success(`TIFMAS stats updated for ${editStatsDialog.person.name}`);
      setEditStatsDialog({ open: false, person: null });
      fetchPersonnel();
    } catch (error) {
      console.error('Failed to update stats:', error);
      toast.error('Failed to update deployment stats');
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
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={fetchPersonnel} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button 
              variant="outline"
              onClick={() => setManualEntryDialog(true)}
              data-testid="tifmas-manual-entry-btn"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Manual Entry
            </Button>
            <Button 
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              data-testid="tifmas-import-csv-btn"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
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
            Those who have not deployed recently appear at the top. After a deployment, they move down the list.
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
                    <TableHead className="w-16">Edit</TableHead>
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
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditStats(person)}
                          data-testid={`edit-stats-${person.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
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

        {/* Manual Entry Dialog */}
        <Dialog open={manualEntryDialog} onOpenChange={setManualEntryDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-orange-500" />
                Manual TIFMAS Entry
              </DialogTitle>
              <DialogDescription>
                Add a historical deployment record for a single person
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="manual-personnel">Personnel *</Label>
                <Select
                  value={manualEntryData.personnel_id}
                  onValueChange={(value) => {
                    const person = allPersonnel.find(p => p.id === value);
                    setManualEntryData(d => ({
                      ...d,
                      personnel_id: value,
                      personnel_name: person?.name || '',
                      personnel_rank: person?.rank || ''
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select personnel" />
                  </SelectTrigger>
                  <SelectContent>
                    {allPersonnel.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} - {p.rank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="manual-incident">Incident Name *</Label>
                <Input
                  id="manual-incident"
                  placeholder="e.g., Wildfire - Johnson County"
                  value={manualEntryData.incident_name}
                  onChange={(e) => setManualEntryData(d => ({ ...d, incident_name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="manual-location">Location</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="manual-location"
                    placeholder="e.g., Johnson County, TX"
                    className="pl-10"
                    value={manualEntryData.location}
                    onChange={(e) => setManualEntryData(d => ({ ...d, location: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="manual-start">Start Date *</Label>
                  <Input
                    id="manual-start"
                    type="date"
                    value={manualEntryData.start_date}
                    onChange={(e) => setManualEntryData(d => ({ ...d, start_date: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="manual-end">End Date</Label>
                  <Input
                    id="manual-end"
                    type="date"
                    value={manualEntryData.end_date}
                    onChange={(e) => setManualEntryData(d => ({ ...d, end_date: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="manual-notes">Notes</Label>
                <Textarea
                  id="manual-notes"
                  placeholder="Additional notes..."
                  value={manualEntryData.notes}
                  onChange={(e) => setManualEntryData(d => ({ ...d, notes: e.target.value }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setManualEntryDialog(false)}>Cancel</Button>
              <Button 
                onClick={handleManualEntry} 
                disabled={saving}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {saving ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Add Entry
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Import CSV Dialog */}
        <Dialog open={importDialog} onOpenChange={setImportDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-orange-500" />
                Import TIFMAS Deployments from CSV
              </DialogTitle>
              <DialogDescription>
                Preview and import historical deployment records
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {csvData.length} records found in file
                </p>
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>

              {csvPreview.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Personnel</TableHead>
                        <TableHead>Incident</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvPreview.map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{row.personnel_name || row.name || row.personnel}</TableCell>
                          <TableCell>{row.incident_name || row.incident}</TableCell>
                          <TableCell>{row.location}</TableCell>
                          <TableCell>{row.start_date || row.date}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {csvData.length > 5 && (
                    <p className="text-sm text-muted-foreground text-center py-2 border-t">
                      ... and {csvData.length - 5} more records
                    </p>
                  )}
                </div>
              )}

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                <p className="text-sm text-amber-600">
                  <AlertTriangle className="h-4 w-4 inline mr-2" />
                  Personnel names in CSV must match existing roster names exactly. Unmatched records will be skipped.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setImportDialog(false); setCsvData([]); setCsvPreview([]); }}>
                Cancel
              </Button>
              <Button 
                onClick={handleImportCSV} 
                disabled={importing || csvData.length === 0}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {importing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import {csvData.length} Records
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Stats Dialog */}
        <Dialog open={editStatsDialog.open} onOpenChange={(open) => !open && setEditStatsDialog({ open: false, person: null })}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-orange-500" />
                Edit TIFMAS Stats
              </DialogTitle>
              <DialogDescription>
                {editStatsDialog.person && (
                  <>Update or reset deployment stats for <strong>{editStatsDialog.person.name}</strong></>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-last-deploy">Last TIFMAS Deployment Date</Label>
                <Input
                  id="edit-last-deploy"
                  type="date"
                  value={editStatsData.last_tifmas_deploy}
                  onChange={(e) => setEditStatsData(d => ({ ...d, last_tifmas_deploy: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground mt-1">Leave blank to set as Never deployed</p>
              </div>
              <div>
                <Label htmlFor="edit-deployments">Deployments in Last 12 Months</Label>
                <Input
                  id="edit-deployments"
                  type="number"
                  min="0"
                  value={editStatsData.deployments_12mo}
                  onChange={(e) => setEditStatsData(d => ({ ...d, deployments_12mo: parseInt(e.target.value) || 0 }))}
                />
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                <p className="text-sm text-amber-600">
                  <AlertTriangle className="h-4 w-4 inline mr-2" />
                  Changing these stats will affect the persons position in the fair rotation order.
                </p>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button 
                variant="destructive" 
                onClick={handleResetStats}
                disabled={saving}
                className="w-full sm:w-auto"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Never
              </Button>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" onClick={() => setEditStatsDialog({ open: false, person: null })}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpdateStats} 
                  disabled={saving}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default TIFMASDeploymentLog;
