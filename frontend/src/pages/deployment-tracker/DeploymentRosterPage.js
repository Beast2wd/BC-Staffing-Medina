import { useEffect, useState, useMemo } from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { Users, Search, Plus, Edit2, Trash2, Upload, Download, CheckCircle, XCircle } from 'lucide-react';
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
import { Checkbox } from '../../components/ui/checkbox';

export const DeploymentRosterPage = () => {
  const { api, user } = useAuth();
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editDialog, setEditDialog] = useState({ open: false, entry: null });
  const [formData, setFormData] = useState({});

  const canEdit = user?.role && ['admin', 'battalion_chief', 'captain', 'lieutenant'].includes(user.role);

  const fetchRoster = async () => {
    setLoading(true);
    try {
      const response = await api.get('/deployment-roster');
      setRoster(response.data);
    } catch (error) {
      console.error('Error fetching roster:', error);
      toast.error('Failed to load roster');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoster();
  }, []);

  const filteredRoster = useMemo(() => {
    if (!searchTerm) return roster;
    const term = searchTerm.toLowerCase();
    return roster.filter(r => 
      r.name?.toLowerCase().includes(term) ||
      r.rank?.toLowerCase().includes(term) ||
      r.ems_level?.toLowerCase().includes(term)
    );
  }, [roster, searchTerm]);

  const openEditDialog = (entry = null) => {
    if (entry) {
      setFormData({ ...entry });
    } else {
      setFormData({
        name: '',
        rank: '',
        ems_level: '',
        seniority_date: '',
        eligible_tifmas: false,
        eligible_emtf: false,
        last_deployment: '',
        deployments_last_12mo: 0,
        tifmas_score: 0,
        emtf_score: 0,
        last_tifmas_deploy: '',
        last_emtf_deploy: '',
        ff1: false,
        crew_boss: false,
        engine_boss: false,
        mist: false,
        wpu: false,
        astl: false,
        medl: false,
        tech_spec: false,
        pack_test_level: 'Arduous'
      });
    }
    setEditDialog({ open: true, entry });
  };

  const handleSave = async () => {
    try {
      if (editDialog.entry) {
        await api.put(`/deployment-roster/${editDialog.entry.id}`, formData);
        toast.success('Entry updated');
      } else {
        await api.post('/deployment-roster', formData);
        toast.success('Entry created');
      }
      setEditDialog({ open: false, entry: null });
      fetchRoster();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Failed to save');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    try {
      await api.delete(`/deployment-roster/${id}`);
      toast.success('Entry deleted');
      fetchRoster();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete');
    }
  };

  const handleImport = async () => {
    // Import the initial data from Excel - maintaining exact order from spreadsheet
    const initialData = [
      { name: "Hicks, Ben", rank: "Fire Chief", ems_level: "Paramedic", seniority_date: "2022-12-14", eligible_tifmas: true, eligible_emtf: true, ff1: false, crew_boss: false, engine_boss: false, mist: false, wpu: false, astl: false, medl: false, tech_spec: false, pack_test_level: "Arduous" },
      { name: "Doucet, Brandon", rank: "Lieutenant", ems_level: "Paramedic", seniority_date: "2022-11-16", eligible_tifmas: true, eligible_emtf: true, ff1: false, crew_boss: false, engine_boss: false, mist: false, wpu: false, astl: false, medl: false, tech_spec: false, pack_test_level: "Arduous" },
      { name: "Appleby, Brandon", rank: "Lieutenant", ems_level: "Paramedic", seniority_date: "2025-03-25", eligible_tifmas: true, eligible_emtf: true, ff1: true, crew_boss: false, engine_boss: true, mist: false, wpu: false, astl: false, medl: false, tech_spec: false, pack_test_level: "Arduous" },
      { name: "Hanson, Jonathon", rank: "Firefighter", ems_level: "Paramedic", seniority_date: "2025-04-12", eligible_tifmas: false, eligible_emtf: true, ff1: false, crew_boss: false, engine_boss: false, mist: false, wpu: false, astl: false, medl: false, tech_spec: false, pack_test_level: "Moderate" },
      { name: "Malsbury, Miles", rank: "Firefighter", ems_level: "Paramedic", seniority_date: "2025-04-12", eligible_tifmas: true, eligible_emtf: true, ff1: false, crew_boss: false, engine_boss: false, mist: false, wpu: false, astl: false, medl: false, tech_spec: false, pack_test_level: "Arduous" },
      { name: "Scott, Xochitl", rank: "Firefighter", ems_level: "Paramedic", seniority_date: "2025-04-12", eligible_tifmas: false, eligible_emtf: true, ff1: false, crew_boss: false, engine_boss: false, mist: false, wpu: false, astl: false, medl: false, tech_spec: false, pack_test_level: "Moderate" },
      { name: "Robbins, Charles", rank: "Firefighter", ems_level: "Paramedic", seniority_date: "2025-11-06", eligible_tifmas: true, eligible_emtf: true, ff1: false, crew_boss: false, engine_boss: false, mist: true, wpu: false, astl: false, medl: false, tech_spec: false, pack_test_level: "Arduous" },
      { name: "Lara, Mike", rank: "Lieutenant", ems_level: "Paramedic", seniority_date: "2025-01-02", eligible_tifmas: true, eligible_emtf: true, ff1: false, crew_boss: false, engine_boss: false, mist: false, wpu: false, astl: false, medl: false, tech_spec: false, pack_test_level: "Arduous" },
      { name: "Lavoie, Steven", rank: "Firefighter", ems_level: "Paramedic", seniority_date: "2025-01-28", eligible_tifmas: true, eligible_emtf: true, ff1: false, crew_boss: false, engine_boss: false, mist: false, wpu: false, astl: false, medl: false, tech_spec: false, pack_test_level: "Arduous" },
      { name: "Cyr, Matt", rank: "Firefighter", ems_level: "Paramedic", seniority_date: "2025-04-12", eligible_tifmas: true, eligible_emtf: true, ff1: false, crew_boss: false, engine_boss: false, mist: false, wpu: false, astl: false, medl: false, tech_spec: false, pack_test_level: "Arduous" },
      { name: "Flores, Frank", rank: "Firefighter", ems_level: "Paramedic", seniority_date: "2025-01-13", eligible_tifmas: true, eligible_emtf: true, ff1: false, crew_boss: false, engine_boss: false, mist: false, wpu: false, astl: false, medl: false, tech_spec: false, pack_test_level: "Arduous" },
      { name: "Medina, Logan", rank: "Lieutenant", ems_level: "EMT-A", seniority_date: "2025-01-07", eligible_tifmas: true, eligible_emtf: true, ff1: false, crew_boss: false, engine_boss: false, mist: false, wpu: false, astl: false, medl: false, tech_spec: false, pack_test_level: "Arduous" },
      { name: "Dixon, Matthew", rank: "Firefighter", ems_level: "EMT-A", seniority_date: "", eligible_tifmas: false, eligible_emtf: false, ff1: false, crew_boss: false, engine_boss: false, mist: false, wpu: false, astl: false, medl: false, tech_spec: false, pack_test_level: "Arduous" },
      { name: "Fennell, Larry", rank: "Lieutenant", ems_level: "EMT-B", seniority_date: "2025-10-29", eligible_tifmas: true, eligible_emtf: true, ff1: false, crew_boss: false, engine_boss: false, mist: false, wpu: false, astl: false, medl: false, tech_spec: false, pack_test_level: "Arduous" },
      { name: "Castillo, Albert", rank: "Lieutenant", ems_level: "EMT-B", seniority_date: "2026-02-20", eligible_tifmas: true, eligible_emtf: true, ff1: false, crew_boss: false, engine_boss: false, mist: false, wpu: false, astl: false, medl: false, tech_spec: false, pack_test_level: "Arduous" },
      { name: "Floyd, Robert", rank: "Firefighter", ems_level: "EMT-B", seniority_date: "2022-05-18", eligible_tifmas: true, eligible_emtf: true, ff1: false, crew_boss: false, engine_boss: false, mist: false, wpu: false, astl: false, medl: false, tech_spec: false, pack_test_level: "Arduous" },
      { name: "Waldron, Collin", rank: "Firefighter", ems_level: "EMT-B", seniority_date: "2022-10-08", eligible_tifmas: true, eligible_emtf: true, ff1: false, crew_boss: false, engine_boss: false, mist: false, wpu: false, astl: false, medl: false, tech_spec: false, pack_test_level: "Arduous" },
      { name: "Sanchez, Brandon", rank: "Firefighter", ems_level: "EMT-B", seniority_date: "2023-02-27", eligible_tifmas: true, eligible_emtf: true, ff1: false, crew_boss: false, engine_boss: false, mist: false, wpu: false, astl: false, medl: false, tech_spec: false, pack_test_level: "Arduous" },
      { name: "Rios, Chris", rank: "Firefighter", ems_level: "EMT-B", seniority_date: "2023-09-05", eligible_tifmas: true, eligible_emtf: true, ff1: false, crew_boss: false, engine_boss: false, mist: false, wpu: false, astl: false, medl: false, tech_spec: false, pack_test_level: "Arduous" },
      { name: "Strickland, Colt", rank: "Firefighter", ems_level: "EMT-B", seniority_date: "2024-04-04", eligible_tifmas: true, eligible_emtf: true, ff1: false, crew_boss: false, engine_boss: false, mist: false, wpu: false, astl: false, medl: false, tech_spec: false, pack_test_level: "Arduous" },
      { name: "Leal, Efrain", rank: "Firefighter", ems_level: "EMT-B", seniority_date: "2025-02-18", eligible_tifmas: true, eligible_emtf: true, ff1: false, crew_boss: false, engine_boss: false, mist: false, wpu: false, astl: false, medl: false, tech_spec: false, pack_test_level: "Arduous" },
      { name: "Peterson, Amber", rank: "Firefighter", ems_level: "EMT-B", seniority_date: "2025-02-18", eligible_tifmas: true, eligible_emtf: true, ff1: false, crew_boss: false, engine_boss: false, mist: false, wpu: false, astl: false, medl: false, tech_spec: false, pack_test_level: "Arduous" },
      { name: "Hill, Bryan", rank: "Firefighter", ems_level: "EMT-B", seniority_date: "2025-04-12", eligible_tifmas: true, eligible_emtf: true, ff1: false, crew_boss: false, engine_boss: false, mist: false, wpu: false, astl: false, medl: false, tech_spec: false, pack_test_level: "Arduous" },
      { name: "Smith, Chris", rank: "Firefighter", ems_level: "EMT-B", seniority_date: "2025-04-18", eligible_tifmas: true, eligible_emtf: true, ff1: false, crew_boss: false, engine_boss: false, mist: false, wpu: false, astl: false, medl: false, tech_spec: false, pack_test_level: "Arduous" },
      { name: "Hart, Ethan", rank: "Firefighter", ems_level: "EMT-B", seniority_date: "2025-10-29", eligible_tifmas: true, eligible_emtf: true, ff1: false, crew_boss: false, engine_boss: false, mist: false, wpu: false, astl: false, medl: false, tech_spec: false, pack_test_level: "Arduous" },
      { name: "Reyes, Alejandro", rank: "Firefighter", ems_level: "EMT-B", seniority_date: "2025-10-29", eligible_tifmas: true, eligible_emtf: true, ff1: false, crew_boss: false, engine_boss: false, mist: false, wpu: false, astl: false, medl: false, tech_spec: false, pack_test_level: "Arduous" },
      { name: "Lopez, Lucas", rank: "Firefighter", ems_level: "EMT-B", seniority_date: "2022-06-29", eligible_tifmas: true, eligible_emtf: true, ff1: false, crew_boss: false, engine_boss: false, mist: false, wpu: false, astl: false, medl: false, tech_spec: false, pack_test_level: "Arduous" },
    ];

    try {
      await api.post('/deployment-roster/import', initialData);
      toast.success('Roster imported successfully');
      fetchRoster();
    } catch (error) {
      console.error('Error importing:', error);
      toast.error('Failed to import roster');
    }
  };

  const BooleanBadge = ({ value }) => (
    value ? 
      <CheckCircle className="h-4 w-4 text-green-500" /> : 
      <XCircle className="h-4 w-4 text-red-500/50" />
  );

  return (
    <div className="min-h-screen bg-background" data-testid="deployment-roster-page">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-3xl uppercase tracking-wider font-bold flex items-center gap-2">
              <Users className="h-8 w-8 text-primary" />
              Deployment Roster
            </h1>
            <p className="text-muted-foreground mt-1">
              Personnel deployment eligibility and certifications
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background">Name</TableHead>
                    <TableHead>Rank</TableHead>
                    <TableHead>EMS Level</TableHead>
                    <TableHead className="text-center">TIFMAS</TableHead>
                    <TableHead className="text-center">EMTF</TableHead>
                    <TableHead className="text-center">FF1</TableHead>
                    <TableHead className="text-center">Crew Boss</TableHead>
                    <TableHead className="text-center">Engine Boss</TableHead>
                    <TableHead className="text-center">MIST</TableHead>
                    <TableHead className="text-center">WPU</TableHead>
                    <TableHead className="text-center">ASTL</TableHead>
                    <TableHead className="text-center">MedL</TableHead>
                    <TableHead className="text-center">Tech-Spec</TableHead>
                    <TableHead>Pack Test</TableHead>
                    {canEdit && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRoster.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="sticky left-0 bg-background font-medium">{entry.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{entry.rank}</Badge>
                      </TableCell>
                      <TableCell>{entry.ems_level}</TableCell>
                      <TableCell className="text-center">
                        <BooleanBadge value={entry.eligible_tifmas} />
                      </TableCell>
                      <TableCell className="text-center">
                        <BooleanBadge value={entry.eligible_emtf} />
                      </TableCell>
                      <TableCell className="text-center"><BooleanBadge value={entry.ff1} /></TableCell>
                      <TableCell className="text-center"><BooleanBadge value={entry.crew_boss} /></TableCell>
                      <TableCell className="text-center"><BooleanBadge value={entry.engine_boss} /></TableCell>
                      <TableCell className="text-center"><BooleanBadge value={entry.mist} /></TableCell>
                      <TableCell className="text-center"><BooleanBadge value={entry.wpu} /></TableCell>
                      <TableCell className="text-center"><BooleanBadge value={entry.astl} /></TableCell>
                      <TableCell className="text-center"><BooleanBadge value={entry.medl} /></TableCell>
                      <TableCell className="text-center"><BooleanBadge value={entry.tech_spec} /></TableCell>
                      <TableCell>
                        <Badge variant={entry.pack_test_level === 'Arduous' ? 'default' : 'secondary'}>
                          {entry.pack_test_level || '-'}
                        </Badge>
                      </TableCell>
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
                  {filteredRoster.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={canEdit ? 15 : 14} className="text-center py-8 text-muted-foreground">
                        {roster.length === 0 ? 'No roster entries. Click "Import Data" to load the initial roster.' : 'No matching entries found.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Edit Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => !open && setEditDialog({ open: false, entry: null })}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editDialog.entry ? 'Edit Roster Entry' : 'Add Roster Entry'}</DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input 
                value={formData.name || ''} 
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Rank</Label>
              <Select value={formData.rank || ''} onValueChange={(v) => setFormData({...formData, rank: v})}>
                <SelectTrigger><SelectValue placeholder="Select rank" /></SelectTrigger>
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
              <Select value={formData.ems_level || ''} onValueChange={(v) => setFormData({...formData, ems_level: v})}>
                <SelectTrigger><SelectValue placeholder="Select EMS level" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Paramedic">Paramedic</SelectItem>
                  <SelectItem value="EMT-A">EMT-A</SelectItem>
                  <SelectItem value="EMT-B">EMT-B</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pack Test Level</Label>
              <Select value={formData.pack_test_level || ''} onValueChange={(v) => setFormData({...formData, pack_test_level: v})}>
                <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Arduous">Arduous</SelectItem>
                  <SelectItem value="Moderate">Moderate</SelectItem>
                  <SelectItem value="Light">Light</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>TIFMAS Score</Label>
              <Input 
                type="number"
                value={formData.tifmas_score || ''} 
                onChange={(e) => setFormData({...formData, tifmas_score: parseFloat(e.target.value) || 0})}
              />
            </div>
            <div className="space-y-2">
              <Label>EMTF Score</Label>
              <Input 
                type="number"
                value={formData.emtf_score || ''} 
                onChange={(e) => setFormData({...formData, emtf_score: parseFloat(e.target.value) || 0})}
              />
            </div>
            
            <div className="col-span-2 grid grid-cols-5 gap-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={formData.eligible_tifmas} 
                  onCheckedChange={(c) => setFormData({...formData, eligible_tifmas: c})}
                />
                <Label>TIFMAS Eligible</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={formData.eligible_emtf} 
                  onCheckedChange={(c) => setFormData({...formData, eligible_emtf: c})}
                />
                <Label>EMTF Eligible</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={formData.ff1} 
                  onCheckedChange={(c) => setFormData({...formData, ff1: c})}
                />
                <Label>FF1</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={formData.crew_boss} 
                  onCheckedChange={(c) => setFormData({...formData, crew_boss: c})}
                />
                <Label>Crew Boss</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={formData.engine_boss} 
                  onCheckedChange={(c) => setFormData({...formData, engine_boss: c})}
                />
                <Label>Engine Boss</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={formData.mist} 
                  onCheckedChange={(c) => setFormData({...formData, mist: c})}
                />
                <Label>MIST</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={formData.wpu} 
                  onCheckedChange={(c) => setFormData({...formData, wpu: c})}
                />
                <Label>WPU</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={formData.astl} 
                  onCheckedChange={(c) => setFormData({...formData, astl: c})}
                />
                <Label>ASTL</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={formData.medl} 
                  onCheckedChange={(c) => setFormData({...formData, medl: c})}
                />
                <Label>MedL</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={formData.tech_spec} 
                  onCheckedChange={(c) => setFormData({...formData, tech_spec: c})}
                />
                <Label>Tech-Spec</Label>
              </div>
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
