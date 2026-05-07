import { useEffect, useState } from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { FileText, Search, Plus, Edit2, Trash2, Upload } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Label } from '../../components/ui/label';

export const DeploymentLogPage = () => {
  const { api, user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editDialog, setEditDialog] = useState({ open: false, entry: null });
  const [formData, setFormData] = useState({});

  const canEdit = user?.role && ['admin', 'battalion_chief', 'captain', 'lieutenant'].includes(user.role);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const [logsRes, rosterRes] = await Promise.all([
        api.get('/deployment-log'),
        api.get('/deployment-roster')
      ]);
      setLogs(logsRes.data);
      setRoster(rosterRes.data);
    } catch (error) {
      console.error('Error fetching logs:', error);
      toast.error('Failed to load deployment log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return log.personnel_name?.toLowerCase().includes(term) ||
           log.incident_name?.toLowerCase().includes(term) ||
           log.incident_type?.toLowerCase().includes(term);
  });

  const openEditDialog = (entry = null) => {
    if (entry) {
      setFormData({ ...entry });
    } else {
      setFormData({
        date: new Date().toISOString().split('T')[0],
        incident_type: 'EMTF',
        incident_name: '',
        personnel_name: '',
        personnel_id: '',
        position: 'AST',
        notes: ''
      });
    }
    setEditDialog({ open: true, entry });
  };

  const handleSave = async () => {
    try {
      if (editDialog.entry) {
        await api.put(`/deployment-log/${editDialog.entry.id}`, formData);
        toast.success('Log entry updated');
      } else {
        await api.post('/deployment-log', formData);
        toast.success('Log entry created');
      }
      setEditDialog({ open: false, entry: null });
      fetchLogs();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Failed to save');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    try {
      await api.delete(`/deployment-log/${id}`);
      toast.success('Log entry deleted');
      fetchLogs();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete');
    }
  };

  const handleImport = async () => {
    const initialData = [
      { date: "2026-01-23", incident_type: "EMTF", incident_name: "WILDFIRE 2026-001", personnel_name: "Lara, Mike", position: "AST" },
      { date: "2026-01-23", incident_type: "EMTF", incident_name: "WILDFIRE 2026-001", personnel_name: "Lavoie, Steven", position: "AST" },
      { date: "2026-02-07", incident_type: "EMTF", incident_name: "Wildland Fire Support", personnel_name: "Cyr, Matt", position: "AST" },
      { date: "2026-02-07", incident_type: "EMTF", incident_name: "Wildland Fire Support", personnel_name: "Rios, Chris", position: "AST" },
      { date: "2026-04-20", incident_type: "EMTF", incident_name: "Kerrville", personnel_name: "Lopez, Lucas", position: "AST" },
      { date: "2026-04-20", incident_type: "EMTF", incident_name: "Kerrville", personnel_name: "Flores, Frank", position: "AST" },
    ];

    try {
      await api.post('/deployment-log/import', initialData);
      toast.success('Deployment log imported successfully');
      fetchLogs();
    } catch (error) {
      console.error('Error importing:', error);
      toast.error('Failed to import log');
    }
  };

  const getTypeBadgeColor = (type) => {
    switch (type?.toUpperCase()) {
      case 'TIFMAS': return 'bg-orange-500/20 text-orange-500 border-orange-500';
      case 'EMTF': return 'bg-blue-500/20 text-blue-500 border-blue-500';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen bg-background" data-testid="deployment-log-page">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-3xl uppercase tracking-wider font-bold flex items-center gap-2">
              <FileText className="h-8 w-8 text-primary" />
              Deployment Log
            </h1>
            <p className="text-muted-foreground mt-1">
              Record of all TIFMAS and EMTF deployments
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search..." 
                className="pl-10 w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {canEdit && (
              <>
                <Button variant="outline" onClick={handleImport}>
                  <Upload className="h-4 w-4 mr-2" /> Import Data
                </Button>
                <Button onClick={() => openEditDialog()}>
                  <Plus className="h-4 w-4 mr-2" /> Add Entry
                </Button>
              </>
            )}
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Incident Name</TableHead>
                  <TableHead>Personnel</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Notes</TableHead>
                  {canEdit && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.date}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getTypeBadgeColor(entry.incident_type)}>
                        {entry.incident_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{entry.incident_name}</TableCell>
                    <TableCell>{entry.personnel_name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{entry.position}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{entry.notes || '-'}</TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(entry)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {filteredLogs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 7 : 6} className="text-center py-8 text-muted-foreground">
                      {logs.length === 0 ? 'No deployment log entries. Click "Import Data" to load initial data.' : 'No matching entries found.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      {/* Edit Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => !open && setEditDialog({ open: false, entry: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editDialog.entry ? 'Edit Log Entry' : 'Add Log Entry'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input 
                  type="date"
                  value={formData.date || ''} 
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Deployment Type</Label>
                <Select value={formData.incident_type || ''} onValueChange={(v) => setFormData({...formData, incident_type: v})}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TIFMAS">TIFMAS</SelectItem>
                    <SelectItem value="EMTF">EMTF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Incident Name</Label>
              <Input 
                value={formData.incident_name || ''} 
                onChange={(e) => setFormData({...formData, incident_name: e.target.value})}
                placeholder="e.g., WILDFIRE 2026-001"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Personnel</Label>
                <Select value={formData.personnel_name || ''} onValueChange={(v) => {
                  const person = roster.find(r => r.name === v);
                  setFormData({...formData, personnel_name: v, personnel_id: person?.id || ''});
                }}>
                  <SelectTrigger><SelectValue placeholder="Select personnel" /></SelectTrigger>
                  <SelectContent>
                    {roster.map(r => (
                      <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Position</Label>
                <Select value={formData.position || ''} onValueChange={(v) => setFormData({...formData, position: v})}>
                  <SelectTrigger><SelectValue placeholder="Select position" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AST">AST (Assistant)</SelectItem>
                    <SelectItem value="FFT1">FFT1 (Firefighter Type 1)</SelectItem>
                    <SelectItem value="FFT2">FFT2 (Firefighter Type 2)</SelectItem>
                    <SelectItem value="CRWB">CRWB (Crew Boss)</SelectItem>
                    <SelectItem value="ENGB">ENGB (Engine Boss)</SelectItem>
                    <SelectItem value="TFLD">TFLD (Task Force Leader)</SelectItem>
                    <SelectItem value="DIVS">DIVS (Division Supervisor)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input 
                value={formData.notes || ''} 
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Optional notes"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false, entry: null })}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
