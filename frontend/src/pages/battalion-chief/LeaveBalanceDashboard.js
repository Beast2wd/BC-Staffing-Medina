import { useState, useEffect, useCallback, useMemo } from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { 
  Sun, 
  Thermometer, 
  Gift, 
  Search,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Users,
  Clock
} from 'lucide-react';

// Rank hierarchy for sorting (higher index = higher rank)
const RANK_ORDER = [
  'Volunteer Firefighter',
  'Firefighter',
  'Part-Time Firefighter',
  'Paramedic',
  'Driver Operator',
  'Lieutenant',
  'Captain',
  'Battalion Chief',
  'Deputy Chief',
  'Asst. Chief',
  'Assistant Chief',
  'Fire Chief',
  'Chief'
];

// Get rank priority (higher number = higher rank)
const getRankPriority = (rank) => {
  if (!rank) return -1;
  const index = RANK_ORDER.findIndex(r => 
    r.toLowerCase() === rank.toLowerCase() || 
    rank.toLowerCase().includes(r.toLowerCase())
  );
  return index >= 0 ? index : -1;
};

// Extract last name from full name
const getLastName = (name) => {
  if (!name) return '';
  const parts = name.trim().split(' ');
  return parts[parts.length - 1].toLowerCase();
};

const LeaveBalanceDashboard = () => {
  const { api } = useAuth();
  const [activeTab, setActiveTab] = useState('vacation');
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState([]);
  const [summary, setSummary] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchBalances = useCallback(async (leaveType) => {
    try {
      setLoading(true);
      const response = await api.get(`/leave-balances-by-type/${leaveType}`);
      setBalances(response.data.balances || []);
      setSummary(response.data.summary || null);
    } catch (error) {
      console.error('Failed to fetch balances:', error);
      toast.error('Failed to load leave balances');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchBalances(activeTab);
  }, [activeTab, fetchBalances]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchTerm('');
  };

  const handleRefresh = () => {
    fetchBalances(activeTab);
    toast.success('Balances refreshed');
  };

  // Filter and sort balances: group by shift, then by rank (descending), then by last name (alphabetical)
  const sortedAndGroupedBalances = useMemo(() => {
    // First filter by search term
    const filtered = balances.filter(b => 
      b.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.payroll_number?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort: by shift (A, B, C), then by rank (highest first), then by last name (alphabetical)
    const sorted = [...filtered].sort((a, b) => {
      // First sort by shift
      const shiftOrder = { 'A': 0, 'B': 1, 'C': 2 };
      const shiftCompare = (shiftOrder[a.shift] ?? 99) - (shiftOrder[b.shift] ?? 99);
      if (shiftCompare !== 0) return shiftCompare;

      // Then by rank (higher rank first)
      const rankCompare = getRankPriority(b.rank) - getRankPriority(a.rank);
      if (rankCompare !== 0) return rankCompare;

      // Finally by last name alphabetically
      return getLastName(a.name).localeCompare(getLastName(b.name));
    });

    // Group by shift
    const grouped = {};
    sorted.forEach(person => {
      const shift = person.shift || 'Unassigned';
      if (!grouped[shift]) {
        grouped[shift] = [];
      }
      grouped[shift].push(person);
    });

    return grouped;
  }, [balances, searchTerm]);

  // Get shift display info
  const getShiftBadgeClass = (shift) => {
    switch (shift) {
      case 'A': return 'bg-red-500 text-white';
      case 'B': return 'bg-green-500 text-white';
      case 'C': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getStatusBadge = (status, allowNegative) => {
    switch (status) {
      case 'negative':
        return <Badge variant="destructive" className="text-xs">Negative</Badge>;
      case 'low':
        return <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">Low</Badge>;
      case 'at_cap':
        return <Badge variant="outline" className="text-xs border-blue-500 text-blue-600">At Cap</Badge>;
      case 'near_cap':
        return <Badge variant="outline" className="text-xs border-green-500 text-green-600">Near Cap</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">Normal</Badge>;
    }
  };

  const getLeaveIcon = (type) => {
    switch (type) {
      case 'vacation':
        return <Sun className="h-5 w-5 text-blue-600" />;
      case 'sick':
        return <Thermometer className="h-5 w-5 text-red-600" />;
      case 'holiday':
        return <Gift className="h-5 w-5 text-green-600" />;
      default:
        return <Clock className="h-5 w-5" />;
    }
  };

  const getLeaveColor = (type) => {
    switch (type) {
      case 'vacation':
        return 'blue';
      case 'sick':
        return 'red';
      case 'holiday':
        return 'green';
      default:
        return 'gray';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold font-heading uppercase tracking-wider">Leave Balance Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">View and manage personnel leave balances in real-time</p>
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="vacation" className="flex items-center gap-2" data-testid="vacation-balance-tab">
              <Sun className="h-4 w-4" />
              Vacation
            </TabsTrigger>
            <TabsTrigger value="sick" className="flex items-center gap-2" data-testid="sick-balance-tab">
              <Thermometer className="h-4 w-4" />
              Sick
            </TabsTrigger>
            <TabsTrigger value="holiday" className="flex items-center gap-2" data-testid="holiday-balance-tab">
              <Gift className="h-4 w-4" />
              Holiday
            </TabsTrigger>
          </TabsList>

          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <Card>
                <CardContent className="p-4 text-center">
                  <Users className="h-5 w-5 mx-auto text-primary mb-1" />
                  <p className="text-2xl font-bold">{summary.total_personnel}</p>
                  <p className="text-xs text-muted-foreground">Personnel</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <TrendingUp className="h-5 w-5 mx-auto text-green-600 mb-1" />
                  <p className="text-2xl font-bold">{summary.total_hours.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">Total Hours</p>
                </CardContent>
              </Card>
              <Card className={summary.negative_count > 0 ? 'border-red-300' : ''}>
                <CardContent className="p-4 text-center">
                  <TrendingDown className="h-5 w-5 mx-auto text-red-600 mb-1" />
                  <p className="text-2xl font-bold text-red-600">{summary.negative_count}</p>
                  <p className="text-xs text-muted-foreground">Negative</p>
                </CardContent>
              </Card>
              <Card className={summary.low_count > 0 ? 'border-amber-300' : ''}>
                <CardContent className="p-4 text-center">
                  <AlertTriangle className="h-5 w-5 mx-auto text-amber-600 mb-1" />
                  <p className="text-2xl font-bold text-amber-600">{summary.low_count}</p>
                  <p className="text-xs text-muted-foreground">Low Balance</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  {getLeaveIcon(activeTab)}
                  <p className="text-2xl font-bold">{summary.at_cap_count}</p>
                  <p className="text-xs text-muted-foreground">At Cap</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or payroll number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="balance-search-input"
            />
          </div>

          {/* Balance Table - Same for all tabs */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                {getLeaveIcon(activeTab)}
                {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Balances
              </CardTitle>
              <CardDescription>
                {activeTab === 'vacation' && 'Monthly accrual, rollover caps apply. Can go negative.'}
                {activeTab === 'sick' && 'Monthly accrual, 1080hr max cap. Cannot go negative.'}
                {activeTab === 'holiday' && 'Accrued per holiday occurrence. Can go negative.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.keys(sortedAndGroupedBalances).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {searchTerm ? 'No matching personnel found' : 'No personnel found'}
                    </div>
                  ) : (
                    Object.entries(sortedAndGroupedBalances).map(([shift, personnel]) => (
                      <div key={shift} className="border rounded-lg overflow-hidden">
                        {/* Shift Header */}
                        <div className={`px-4 py-3 flex items-center gap-3 ${
                          shift === 'A' ? 'bg-red-500/10 border-b border-red-500/20' :
                          shift === 'B' ? 'bg-green-500/10 border-b border-green-500/20' :
                          shift === 'C' ? 'bg-blue-500/10 border-b border-blue-500/20' :
                          'bg-muted/50 border-b'
                        }`}>
                          <Badge className={getShiftBadgeClass(shift)}>
                            {shift} Shift
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {personnel.length} personnel
                          </span>
                          <span className="text-sm text-muted-foreground ml-auto">
                            Total: {personnel.reduce((sum, p) => sum + (p.current_balance || 0), 0).toFixed(1)} hrs
                          </span>
                        </div>
                        
                        {/* Shift Table */}
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30">
                              <TableHead>Name</TableHead>
                              <TableHead>Payroll #</TableHead>
                              <TableHead>Rank</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead className="text-right">Balance</TableHead>
                              <TableHead className="text-right">Cap</TableHead>
                              <TableHead className="text-center">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {personnel.map((person) => (
                              <TableRow key={person.personnel_id} data-testid={`balance-row-${person.payroll_number}`}>
                                <TableCell className="font-medium">{person.name}</TableCell>
                                <TableCell className="text-muted-foreground">{person.payroll_number}</TableCell>
                                <TableCell>
                                  <span className="text-sm">{person.rank || '—'}</span>
                                </TableCell>
                                <TableCell>
                                  <Badge 
                                    variant="secondary" 
                                    className={`text-xs ${person.personnel_type === 'operations' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}
                                  >
                                    {person.personnel_type === 'operations' ? 'Ops' : 'Admin'}
                                  </Badge>
                                </TableCell>
                                <TableCell className={`text-right font-mono font-bold ${person.current_balance < 0 ? 'text-red-600' : ''}`}>
                                  {person.current_balance.toFixed(1)} hrs
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  {person.cap ? `${person.cap} hrs` : '—'}
                                </TableCell>
                                <TableCell className="text-center">
                                  {getStatusBadge(person.status, person.allow_negative)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </Tabs>
      </main>
    </div>
  );
};

export default LeaveBalanceDashboard;
