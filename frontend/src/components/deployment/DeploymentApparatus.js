import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Truck } from 'lucide-react';

const emptyForm = { deployment_type: 'TIFMAS', apparatus_name: '', location: '', departure_date: new Date().toISOString().split('T')[0], departure_time: '', return_date: '', return_time: '', notes: '' };

export const DeploymentApparatus = () => {
  const { api } = useAuth();
  const [entries, setEntries] = useState([]);
  const [apparatusOptions, setApparatusOptions] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await api.get('/deployment-apparatus');
      setEntries(res.data);
    } catch (error) {
      toast.error('Failed to load deployment apparatus');
    }
  }, [api]);

  useEffect(() => {
    fetchEntries();
    api.get('/stations').then(res => {
      const names = new Set();
      res.data.forEach(s => (s.apparatus || []).forEach(a => names.add(a)));
      setApparatusOptions([...names].sort());
    }).catch(() => {});
  }, [api, fetchEntries]);

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (entry) => {
    setEditing(entry);
    setForm({ deployment_type: entry.deployment_type, apparatus_name: entry.apparatus_name, location: entry.location || '', departure_date: entry.departure_date, departure_time: entry.departure_time || '', return_date: entry.return_date || '', return_time: entry.return_time || '', notes: entry.notes || '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.apparatus_name || !form.departure_date) {
      toast.error('Apparatus and departure date are required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/deployment-apparatus/${editing.id}`, form);
        toast.success('Apparatus entry updated');
      } else {
        await api.post('/deployment-apparatus', form);
        toast.success('Apparatus entry added');
      }
      setDialogOpen(false);
      fetchEntries();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save apparatus entry');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry) => {
    if (!window.confirm(`Delete ${entry.apparatus_name} departure on ${entry.departure_date}?`)) return;
    try {
      await api.delete(`/deployment-apparatus/${entry.id}`);
      toast.success('Apparatus entry deleted');
      fetchEntries();
    } catch (error) {
      toast.error('Failed to delete apparatus entry');
    }
  };

  const typeColor = (t) => t === 'TIFMAS' ? 'bg-orange-500' : 'bg-blue-500';

  return (
    <Card data-testid="deployment-apparatus">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2"><Truck className="h-5 w-5" /> Deployment Apparatus</CardTitle>
            <CardDescription>Apparatus sent out on deployment, with departure and return times</CardDescription>
          </div>
          <Button size="sm" onClick={openNew} data-testid="add-apparatus-btn">
            <Plus className="h-4 w-4 mr-2" /> Add Apparatus
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No apparatus deployments recorded</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Apparatus</TableHead>
                <TableHead>Incident / Location</TableHead>
                <TableHead>Departed Home Base</TableHead>
                <TableHead>Returned</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(e => (
                <TableRow key={e.id} data-testid={`apparatus-row-${e.id}`}>
                  <TableCell><Badge className={typeColor(e.deployment_type)}>{e.deployment_type}</Badge></TableCell>
                  <TableCell className="font-medium">{e.apparatus_name}</TableCell>
                  <TableCell>{e.location || '-'}</TableCell>
                  <TableCell>{e.departure_date}{e.departure_time ? ` @ ${e.departure_time}` : ''}</TableCell>
                  <TableCell>{e.return_date ? `${e.return_date}${e.return_time ? ` @ ${e.return_time}` : ''}` : <span className="text-muted-foreground italic">Still out</span>}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{e.notes || '-'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(e)} data-testid={`edit-apparatus-${e.id}`}><Edit2 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500" onClick={() => handleDelete(e)} data-testid={`delete-apparatus-${e.id}`}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg" data-testid="apparatus-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading uppercase">{editing ? 'Edit' : 'Add'} Deployment Apparatus</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Deployment Type</Label>
                <Select value={form.deployment_type} onValueChange={(v) => setForm({ ...form, deployment_type: v })}>
                  <SelectTrigger data-testid="apparatus-type-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TIFMAS">TIFMAS</SelectItem>
                    <SelectItem value="EMTF">EMTF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Apparatus</Label>
                <Select value={form.apparatus_name} onValueChange={(v) => setForm({ ...form, apparatus_name: v })}>
                  <SelectTrigger data-testid="apparatus-name-select"><SelectValue placeholder="Select apparatus" /></SelectTrigger>
                  <SelectContent>
                    {apparatusOptions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    {apparatusOptions.length === 0 && <SelectItem value="__none" disabled>No apparatus on stations</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Incident / Location</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Bastrop County Complex" data-testid="apparatus-location-input" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Departure Date</Label>
                <Input type="date" value={form.departure_date} onChange={(e) => setForm({ ...form, departure_date: e.target.value })} data-testid="apparatus-departure-date" />
              </div>
              <div>
                <Label>Departure Time</Label>
                <Input type="time" value={form.departure_time} onChange={(e) => setForm({ ...form, departure_time: e.target.value })} data-testid="apparatus-departure-time" />
              </div>
              <div>
                <Label>Return Date</Label>
                <Input type="date" value={form.return_date} onChange={(e) => setForm({ ...form, return_date: e.target.value })} data-testid="apparatus-return-date" />
              </div>
              <div>
                <Label>Return Time</Label>
                <Input type="time" value={form.return_time} onChange={(e) => setForm({ ...form, return_time: e.target.value })} data-testid="apparatus-return-time" />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} data-testid="apparatus-notes-input" />
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full" data-testid="apparatus-save-btn">
              {editing ? 'Save Changes' : 'Add Apparatus'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
