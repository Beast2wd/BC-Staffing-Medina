import { useState, useEffect } from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { 
  History, 
  RefreshCw, 
  Filter,
  Calendar,
  Users,
  MapPin,
  FileText,
  Download,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Clock,
  XCircle,
  BarChart3
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../../components/ui/collapsible';

const getStatusBadge = (status) => {
  switch (status) {
    case 'active':
      return <Badge className="bg-green-500"><Clock className="h-3 w-3 mr-1" />Active</Badge>;
    case 'completed':
      return <Badge variant="secondary"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
    case 'cancelled':
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const getTypeBadge = (type) => {
  if (type === 'TIFMAS') {
    return <Badge className="bg-orange-500">TIFMAS</Badge>;
  }
  return <Badge className="bg-blue-500">EMTF</Badge>;
};

export const DeploymentHistoryPage = () => {
  const { api } = useAuth();
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState([]);
  
  // Filters
  const [filters, setFilters] = useState({
    deployment_type: '',
    status: '',
    start_date: '',
    end_date: '',
    personnel_name: ''
  });

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      
      const response = await api.get(`/deployment-history?${params.toString()}`);
      setHistory(response.data);
    } catch (error) {
      console.error('Failed to fetch deployment history:', error);
      toast.error('Failed to load deployment history');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/deployment-history/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  useEffect(() => {
    fetchHistory();
    fetchStats();
  }, []);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    fetchHistory();
  };

  const clearFilters = () => {
    setFilters({
      deployment_type: '',
      status: '',
      start_date: '',
      end_date: '',
      personnel_name: ''
    });
    setTimeout(fetchHistory, 100);
  };

  const toggleRowExpand = (id) => {
    setExpandedRows(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const exportToCSV = () => {
    const headers = ['Type', 'Incident', 'Location', 'Start Date', 'End Date', 'Status', 'Personnel Count', 'Personnel Names'];
    const rows = history.map(h => [
      h.deployment_type,
      h.incident_name,
      h.location,
      h.start_date,
      h.end_date,
      h.status,
      h.total_personnel,
      h.personnel?.map(p => p.name).join('; ') || ''
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deployment-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Deployment history exported');
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <History className="h-6 w-6" />
              Deployment History
            </h1>
            <p className="text-muted-foreground">Track and review all TIFMAS and EMTF deployments</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => { fetchHistory(); fetchStats(); }}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <BarChart3 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.total_deployments}</p>
                    <p className="text-sm text-muted-foreground">Total Deployments</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-orange-500/10 rounded-full">
                    <FileText className="h-6 w-6 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.tifmas_deployments}</p>
                    <p className="text-sm text-muted-foreground">TIFMAS</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-500/10 rounded-full">
                    <FileText className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.emtf_deployments}</p>
                    <p className="text-sm text-muted-foreground">EMTF</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-500/10 rounded-full">
                    <Users className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.unique_personnel}</p>
                    <p className="text-sm text-muted-foreground">Personnel Deployed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <Label className="text-xs">Deployment Type</Label>
                <Select value={filters.deployment_type || "all"} onValueChange={(v) => handleFilterChange('deployment_type', v === "all" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="TIFMAS">TIFMAS</SelectItem>
                    <SelectItem value="EMTF">EMTF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={filters.status || "all"} onValueChange={(v) => handleFilterChange('status', v === "all" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Start Date</Label>
                <Input
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => handleFilterChange('start_date', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">End Date</Label>
                <Input
                  type="date"
                  value={filters.end_date}
                  onChange={(e) => handleFilterChange('end_date', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Personnel Name</Label>
                <Input
                  placeholder="Search..."
                  value={filters.personnel_name}
                  onChange={(e) => handleFilterChange('personnel_name', e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button size="sm" onClick={applyFilters}>Apply Filters</Button>
              <Button size="sm" variant="outline" onClick={clearFilters}>Clear</Button>
            </div>
          </CardContent>
        </Card>

        {/* History Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No deployment history found</p>
                <p className="text-sm">Deployments will appear here once created</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Incident Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Personnel</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((deployment) => (
                    <Collapsible key={deployment.id} asChild>
                      <>
                        <TableRow className="cursor-pointer hover:bg-muted/30" onClick={() => toggleRowExpand(deployment.id)}>
                          <TableCell>
                            {expandedRows.includes(deployment.id) 
                              ? <ChevronUp className="h-4 w-4" />
                              : <ChevronDown className="h-4 w-4" />
                            }
                          </TableCell>
                          <TableCell>{getTypeBadge(deployment.deployment_type)}</TableCell>
                          <TableCell className="font-medium">{deployment.incident_name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                              {deployment.location}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              {deployment.start_date} - {deployment.end_date || 'Ongoing'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              <Users className="h-3 w-3 mr-1" />
                              {deployment.total_personnel}
                            </Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(deployment.status)}</TableCell>
                        </TableRow>
                        {expandedRows.includes(deployment.id) && (
                          <TableRow>
                            <TableCell colSpan={7} className="bg-muted/20 p-4">
                              <div className="space-y-3">
                                <div>
                                  <h4 className="font-semibold mb-2">Deployed Personnel</h4>
                                  <div className="flex flex-wrap gap-2">
                                    {deployment.personnel?.map((p, i) => (
                                      <Badge key={i} variant="secondary" className="py-1">
                                        {p.name} {p.position && `(${p.position})`}
                                      </Badge>
                                    )) || <span className="text-muted-foreground text-sm">No personnel data</span>}
                                  </div>
                                </div>
                                {deployment.notes && (
                                  <div>
                                    <h4 className="font-semibold mb-1">Notes</h4>
                                    <p className="text-sm text-muted-foreground">{deployment.notes}</p>
                                  </div>
                                )}
                                <div className="text-xs text-muted-foreground">
                                  Created by {deployment.created_by} on {new Date(deployment.created_at).toLocaleDateString()}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    </Collapsible>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Top Deployers */}
        {stats?.top_deployers?.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Top Deployers ({stats.year})</CardTitle>
              <CardDescription>Personnel with the most deployments this year</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.top_deployers.map((person, index) => (
                  <div key={person.name} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 flex items-center justify-center bg-primary/10 rounded-full text-sm font-bold">
                        {index + 1}
                      </span>
                      <span className="font-medium">{person.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-orange-500">{person.tifmas} TIFMAS</Badge>
                      <Badge className="bg-blue-500">{person.emtf} EMTF</Badge>
                      <Badge variant="outline">{person.total} Total</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default DeploymentHistoryPage;
