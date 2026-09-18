import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { Download, RefreshCw, Users, Clock } from 'lucide-react';

const today = () => new Date().toISOString().split('T')[0];
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; };

export const BackfillRoster = () => {
  const { api } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ start_date: daysAgo(90), end_date: today(), deployment_type: 'all' });

  const fetchRoster = useCallback(async () => {
    setLoading(true);
    try {
      const params = { start_date: filters.start_date, end_date: filters.end_date };
      if (filters.deployment_type !== 'all') params.deployment_type = filters.deployment_type;
      const res = await api.get('/deployments/backfill-roster', { params });
      setData(res.data);
    } catch (error) {
      toast.error('Failed to load backfill roster');
    } finally {
      setLoading(false);
    }
  }, [api, filters]);

  useEffect(() => { fetchRoster(); }, [fetchRoster]);

  const exportCSV = () => {
    if (!data) return;
    const rows = [['Deployment Type', 'Deployed Personnel', 'Location', 'Deploy Start', 'Deploy End', 'Backfill Personnel', 'Rank', 'OT Date', 'Hours', 'Shift', 'Station', 'Notes']];
    data.deployments.forEach(d => {
      if (d.backfills.length === 0) {
        rows.push([d.deployment_type, d.personnel_name, d.location, d.start_date, d.end_date, '(no backfill recorded)', '', '', '', '', '', '']);
      }
      d.backfills.forEach(b => rows.push([d.deployment_type, d.personnel_name, d.location, d.start_date, d.end_date, b.personnel_name, b.rank, b.date, b.hours, b.shift_type, b.station_name, b.notes]));
    });
    const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `backfill-roster-${filters.start_date}-to-${filters.end_date}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Backfill roster exported');
  };

  const typeColor = (t) => t === 'TIFMAS' ? 'bg-orange-500' : 'bg-blue-500';

  return (
    <div className="space-y-6" data-testid="backfill-roster">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Overtime Backfill Roster</CardTitle>
              <CardDescription>Who covered on overtime for each person out on deployment</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportCSV} disabled={!data} data-testid="backfill-export-btn">
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={fetchRoster} disabled={loading} data-testid="backfill-refresh-btn">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={filters.start_date} onChange={(e) => setFilters({ ...filters, start_date: e.target.value })} data-testid="backfill-start-date" />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={filters.end_date} onChange={(e) => setFilters({ ...filters, end_date: e.target.value })} data-testid="backfill-end-date" />
            </div>
            <div>
              <Label>Deployment Type</Label>
              <Select value={filters.deployment_type} onValueChange={(v) => setFilters({ ...filters, deployment_type: v })}>
                <SelectTrigger data-testid="backfill-type-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="TIFMAS">TIFMAS</SelectItem>
                  <SelectItem value="EMTF">EMTF</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {data && (
        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold" data-testid="backfill-total-deployments">{data.deployments.length}</p>
            <p className="text-sm text-muted-foreground">Deployments</p>
          </CardContent></Card>
          <Card><CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold" data-testid="backfill-total-shifts">{data.total_backfill_shifts}</p>
            <p className="text-sm text-muted-foreground">Backfill Shifts</p>
          </CardContent></Card>
          <Card><CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-yellow-500" data-testid="backfill-total-hours">{data.total_backfill_hours}</p>
            <p className="text-sm text-muted-foreground">Backfill OT Hours</p>
          </CardContent></Card>
        </div>
      )}

      {data?.deployments.length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No deployments in this date range</CardContent></Card>
      )}

      {data?.deployments.map(d => (
        <Card key={d.deployment_id} data-testid={`backfill-deployment-${d.deployment_id}`}>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <Badge className={typeColor(d.deployment_type)}>{d.deployment_type}</Badge>
                <div>
                  <p className="font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> {d.personnel_name}</p>
                  <p className="text-xs text-muted-foreground">{d.location || 'No location'} · {d.start_date} → {d.end_date}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span className="font-semibold text-yellow-500">{d.backfill_hours} hrs</span>
                <span className="text-muted-foreground">· {d.backfill_shifts} shift{d.backfill_shifts === 1 ? '' : 's'}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {d.backfills.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No overtime backfill recorded for this deployment yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Backfill Personnel</TableHead>
                    <TableHead>Rank</TableHead>
                    <TableHead>OT Date</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Shift</TableHead>
                    <TableHead>Station</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.backfills.map(b => (
                    <TableRow key={b.overtime_id} data-testid={`backfill-row-${b.overtime_id}`}>
                      <TableCell className="font-medium">{b.personnel_name}</TableCell>
                      <TableCell>{b.rank}</TableCell>
                      <TableCell>{b.date}</TableCell>
                      <TableCell>{b.hours}</TableCell>
                      <TableCell>{b.shift_type}h</TableCell>
                      <TableCell>{b.station_name}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{b.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
