import { useEffect, useState, useCallback, memo, useRef } from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { Flame, Trophy, CheckCircle, XCircle, Send, Calendar, MapPin, AlertTriangle, Edit2, Trash2, Upload, Download, History, Clock, User, FileText, AlertCircle, Undo2 } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
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
const TIFMASEditDialog = memo(({ open, entry, onClose, onSave, onDelete, api }) => {
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this roster entry?')) return;
    setDeleting(true);
    try {
      await api.delete(`/deployment-roster/${entry.id}`);
      toast.success('Entry deleted successfully');
      onDelete && onDelete();
      onClose();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete entry');
    } finally {
      setDeleting(false);
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
        
        <DialogFooter className="flex justify-between sm:justify-between">
          <Button 
            variant="destructive" 
            onClick={handleDelete} 
            disabled={deleting}
            data-testid="delete-entry-in-dialog"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
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
  
  // CSV Import state
  const [importing, setImporting] = useState(false);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState([]);
  const [importFilename, setImportFilename] = useState('');
  const fileInputRef = useRef(null);
  
  // Import History state
  const [activeTab, setActiveTab] = useState('roster');
  const [importHistory, setImportHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Import validation state
  const [importValidation, setImportValidation] = useState({ warnings: [], errors: [] });
  
  // History cleanup state
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [cleanupPeriod, setCleanupPeriod] = useState('90');
  const [cleaningHistory, setCleaningHistory] = useState(false);
  
  // Rollback state
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);
  const [rollbackEntry, setRollbackEntry] = useState(null);
  const [rollingBack, setRollingBack] = useState(false);

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

  // CSV parsing function
  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (const char of lines[i]) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });
      
      // Push all rows, validation will catch missing names
      data.push(row);
    }
    
    return data;
  };

  // Validate import data
  const validateImportData = (data) => {
    const warnings = [];
    const errors = [];
    const names = new Set();
    const existingNames = new Set(roster.map(r => r.name?.toLowerCase().trim()));
    
    data.forEach((row, idx) => {
      const rowNum = idx + 2; // Account for header row
      
      // Check for missing name
      if (!row.name || !row.name.trim()) {
        errors.push(`Row ${rowNum}: Missing required field 'name'`);
        return;
      }
      
      const nameLower = row.name.toLowerCase().trim();
      
      // Check for duplicates within the file
      if (names.has(nameLower)) {
        warnings.push(`Row ${rowNum}: Duplicate name "${row.name}" found in file`);
      } else {
        names.add(nameLower);
      }
      
      // Check if name already exists in roster
      if (existingNames.has(nameLower)) {
        warnings.push(`Row ${rowNum}: "${row.name}" already exists in roster (will be skipped)`);
      }
      
      // Validate boolean fields
      const boolFields = ['eligible_tifmas', 'eligible_emtf', 'ff1', 'crew_boss', 'engine_boss', 'astl', 'wpu', 'medl', 'mist', 'tech_spec'];
      const validBoolValues = ['true', 'false', 'yes', 'no', '1', '0', 'x', ''];
      boolFields.forEach(field => {
        const val = (row[field] || '').toLowerCase().trim();
        if (val && !validBoolValues.includes(val)) {
          warnings.push(`Row ${rowNum}: Invalid value "${row[field]}" for ${field} (expected true/false/yes/no)`);
        }
      });
      
      // Validate pack test level
      const validPackTests = ['arduous', 'moderate', 'light', ''];
      const packTest = (row.pack_test_level || '').toLowerCase().trim();
      if (packTest && !validPackTests.includes(packTest)) {
        warnings.push(`Row ${rowNum}: Unknown pack test level "${row.pack_test_level}" (expected Arduous/Moderate/Light)`);
      }
    });
    
    return { warnings, errors };
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }
    
    setImportFilename(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = parseCSV(e.target.result);
        if (data.length === 0) {
          toast.error('No valid data found in CSV');
          return;
        }
        
        // Validate the data
        const validation = validateImportData(data);
        setImportValidation(validation);
        
        if (validation.errors.length > 0) {
          toast.error(`Found ${validation.errors.length} error(s) in CSV data`);
        } else if (validation.warnings.length > 0) {
          toast.warning(`Found ${validation.warnings.length} warning(s) - review before importing`);
        }
        
        setImportPreviewData(data);
        setShowImportPreview(true);
      } catch (err) {
        toast.error('Error parsing CSV file');
        console.error(err);
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset for re-selection
  };

  const handleImport = async () => {
    if (importPreviewData.length === 0) return;
    
    setImporting(true);
    try {
      const response = await api.post('/deployment-roster/bulk-import-with-history', importPreviewData, {
        params: { filename: importFilename }
      });
      toast.success(`Import complete: ${response.data.added} added, ${response.data.skipped} skipped`);
      setShowImportPreview(false);
      setImportPreviewData([]);
      setImportFilename('');
      fetchRoster();
      fetchImportHistory();
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import roster data');
    } finally {
      setImporting(false);
    }
  };
  
  const fetchImportHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await api.get('/deployment-roster/import-history');
      setImportHistory(response.data.history || []);
    } catch (error) {
      console.error('Error fetching import history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleClearHistory = async () => {
    setCleaningHistory(true);
    try {
      const response = await api.delete('/deployment-roster/import-history', {
        params: { older_than_days: cleanupPeriod === 'all' ? 0 : parseInt(cleanupPeriod) }
      });
      toast.success(`Cleared ${response.data.deleted} history entries`);
      setShowCleanupDialog(false);
      fetchImportHistory();
    } catch (error) {
      console.error('Error clearing history:', error);
      toast.error('Failed to clear history');
    } finally {
      setCleaningHistory(false);
    }
  };

  const handleRollback = async () => {
    if (!rollbackEntry) return;
    
    setRollingBack(true);
    try {
      const response = await api.post(`/deployment-roster/import-history/${rollbackEntry.id}/rollback`);
      toast.success(`Rollback complete: ${response.data.deleted} entries removed`);
      setShowRollbackDialog(false);
      setRollbackEntry(null);
      fetchImportHistory();
      fetchRoster();
    } catch (error) {
      console.error('Error rolling back:', error);
      toast.error(error.response?.data?.detail || 'Failed to rollback import');
    } finally {
      setRollingBack(false);
    }
  };

  const openRollbackDialog = (entry) => {
    setRollbackEntry(entry);
    setShowRollbackDialog(true);
  };

  const downloadTemplate = () => {
    const headers = 'name,rank,ems_level,eligible_tifmas,eligible_emtf,pack_test_level,ff1,crew_boss,engine_boss,astl,wpu,medl,mist,tech_spec';
    const example = '"Smith, John",Captain,Paramedic,true,true,Arduous,true,true,false,false,false,false,false,false';
    const csv = `${headers}\n${example}`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'roster_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

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
              Texas Intrastate Fire Mutual Aid System
            </p>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <Badge variant="outline" className="bg-orange-500/20 text-orange-500 border-orange-500 px-4 py-2">
              <Trophy className="h-4 w-4 mr-2" />
              {roster.length} Eligible Personnel
            </Badge>
            
            {canEdit && (
              <div className="flex gap-2 flex-wrap justify-end">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="csv-file-input"
                />
                <Button 
                  variant="outline" 
                  onClick={downloadTemplate}
                  className="border-orange-500 text-orange-500 hover:bg-orange-500/10"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Template
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-orange-500 text-orange-500 hover:bg-orange-500/10"
                  data-testid="import-csv-btn"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import CSV
                </Button>
                <Button 
                  onClick={openDeployDialog}
                  disabled={selectedPersonnel.length === 0}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                  data-testid="deploy-personnel-btn"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Deploy ({selectedPersonnel.length})
                </Button>
              </div>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); if (val === 'history') fetchImportHistory(); }} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-4">
            <TabsTrigger value="roster" className="flex items-center gap-2">
              <Flame className="h-4 w-4" />
              Roster
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Import History
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="roster">
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
          </TabsContent>
          
          <TabsContent value="history">
            <Card>
              <CardHeader className="bg-orange-500/10 border-b border-orange-500/20 flex flex-row items-center justify-between">
                <CardTitle className="text-orange-500 flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Import History
                </CardTitle>
                {importHistory.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowCleanupDialog(true)}
                    className="border-red-500 text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear History
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
                  </div>
                ) : importHistory.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No import history found</p>
                    <p className="text-sm">Import a CSV file to see history here</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Imported By</TableHead>
                          <TableHead>Filename</TableHead>
                          <TableHead className="text-center">Total Rows</TableHead>
                          <TableHead className="text-center">Added</TableHead>
                          <TableHead className="text-center">Skipped</TableHead>
                          <TableHead className="text-center">Errors</TableHead>
                          <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importHistory.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              {new Date(entry.created_at).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                {entry.user_name}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                {entry.filename || 'Unknown'}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">{entry.total_rows}</TableCell>
                            <TableCell className="text-center">
                              <Badge className="bg-green-500">{entry.added}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline">{entry.skipped}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {entry.errors_count > 0 ? (
                                <Badge className="bg-red-500">{entry.errors_count}</Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {entry.rolled_back ? (
                                <Badge variant="outline" className="text-zinc-500">
                                  Rolled Back
                                </Badge>
                              ) : entry.added > 0 && entry.added_entry_ids?.length > 0 ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openRollbackDialog(entry)}
                                  className="border-amber-500 text-amber-500 hover:bg-amber-500/10"
                                  data-testid={`rollback-btn-${entry.id}`}
                                >
                                  <Undo2 className="h-4 w-4 mr-1" />
                                  Undo
                                </Button>
                              ) : (
                                <span className="text-muted-foreground text-xs">N/A</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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

      {/* Import Preview Dialog */}
      <Dialog open={showImportPreview} onOpenChange={setShowImportPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-orange-500" />
              Import Preview - {importPreviewData.length} Entries
            </DialogTitle>
            <DialogDescription>
              Review the data below. Existing entries (by name) will be skipped.
            </DialogDescription>
          </DialogHeader>
          
          {/* Validation Warnings/Errors */}
          {(importValidation.errors.length > 0 || importValidation.warnings.length > 0) && (
            <div className="space-y-3">
              {importValidation.errors.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-red-500 font-medium mb-2">
                    <XCircle className="h-4 w-4" />
                    {importValidation.errors.length} Error(s) - Must fix before importing
                  </div>
                  <ul className="text-sm text-red-400 space-y-1 max-h-24 overflow-auto">
                    {importValidation.errors.map((err, idx) => (
                      <li key={idx}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {importValidation.warnings.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-yellow-500 font-medium mb-2">
                    <AlertCircle className="h-4 w-4" />
                    {importValidation.warnings.length} Warning(s) - Review recommended
                  </div>
                  <ul className="text-sm text-yellow-400 space-y-1 max-h-32 overflow-auto">
                    {importValidation.warnings.slice(0, 10).map((warn, idx) => (
                      <li key={idx}>• {warn}</li>
                    ))}
                    {importValidation.warnings.length > 10 && (
                      <li className="text-yellow-500">... and {importValidation.warnings.length - 10} more warnings</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
          
          <div className="overflow-x-auto max-h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Rank</TableHead>
                  <TableHead>EMS Level</TableHead>
                  <TableHead>TIFMAS</TableHead>
                  <TableHead>EMTF</TableHead>
                  <TableHead>Pack Test</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importPreviewData.slice(0, 50).map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.rank || '-'}</TableCell>
                    <TableCell>{row.ems_level || '-'}</TableCell>
                    <TableCell>{row.eligible_tifmas || '-'}</TableCell>
                    <TableCell>{row.eligible_emtf || '-'}</TableCell>
                    <TableCell>{row.pack_test_level || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {importPreviewData.length > 50 && (
              <p className="text-muted-foreground text-sm mt-2 px-4">
                ... and {importPreviewData.length - 50} more entries
              </p>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportPreview(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleImport}
              disabled={importing || importValidation.errors.length > 0}
              className="bg-orange-500 hover:bg-orange-600"
              data-testid="confirm-import-btn"
            >
              {importing ? 'Importing...' : importValidation.errors.length > 0 ? 'Fix Errors First' : `Import ${importPreviewData.length} Entries`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear History Dialog */}
      <Dialog open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <Trash2 className="h-5 w-5" />
              Clear Import History
            </DialogTitle>
            <DialogDescription>
              Select how far back to clear import history. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Label className="text-sm font-medium">Clear entries older than:</Label>
            <Select value={cleanupPeriod} onValueChange={setCleanupPeriod}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="180">6 months</SelectItem>
                <SelectItem value="365">1 year</SelectItem>
                <SelectItem value="all">All history</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCleanupDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleClearHistory}
              disabled={cleaningHistory}
            >
              {cleaningHistory ? 'Clearing...' : 'Clear History'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rollback Import Dialog */}
      <Dialog open={showRollbackDialog} onOpenChange={setShowRollbackDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-500">
              <Undo2 className="h-5 w-5" />
              Undo CSV Import
            </DialogTitle>
            <DialogDescription>
              This will delete all {rollbackEntry?.added || 0} entries that were added in this import. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          {rollbackEntry && (
            <div className="py-4 space-y-2 bg-muted/50 rounded-lg p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Import Date:</span>
                <span>{new Date(rollbackEntry.created_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Filename:</span>
                <span>{rollbackEntry.filename}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Entries to Delete:</span>
                <Badge className="bg-red-500">{rollbackEntry.added}</Badge>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRollbackDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleRollback}
              disabled={rollingBack}
            >
              {rollingBack ? 'Rolling Back...' : `Delete ${rollbackEntry?.added || 0} Entries`}
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
        onDelete={fetchRoster}
        api={api}
      />
    </div>
  );
};
