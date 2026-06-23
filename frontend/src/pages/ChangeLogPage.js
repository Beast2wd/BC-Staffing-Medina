import { useEffect, useState, useRef } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { useAuth } from '../context/AuthContext';
import { useStaffing } from '../context/StaffingContext';
import { useRealtimeUpdates } from '../contexts/WebSocketContext';
import { toast } from 'sonner';
import { 
  History, 
  Printer, 
  Download, 
  RefreshCw, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  FileText,
  Wifi
} from 'lucide-react';

export const ChangeLogPage = () => {
  const { api } = useAuth();
  const { selectedBattalion } = useStaffing();
  const [viewMode, setViewMode] = useState('daily'); // live, daily, weekly, monthly
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [liveChanges, setLiveChanges] = useState([]);
  const printRef = useRef(null);

  // Subscribe to all changes for live view
  const handleRealtimeUpdate = (data) => {
    if (viewMode === 'live') {
      const newChange = {
        id: Date.now(),
        timestamp: data.timestamp || new Date().toISOString(),
        type: data.type,
        event: data.event,
        modified_by: data.data?.modified_by || 'System',
        station_id: data.data?.station_id || data.station_id,
        details: formatChangeDetails(data),
        raw: data
      };
      setLiveChanges(prev => [newChange, ...prev].slice(0, 100)); // Keep last 100
    }
  };

  useRealtimeUpdates(['staffing', 'overtime', 'personnel', 'volunteer', 'parttime'], handleRealtimeUpdate);

  const formatChangeDetails = (data) => {
    const type = data.type?.replace('_update', '') || 'unknown';
    const event = data.event || 'change';
    let details = `${type} ${event}`;
    
    if (data.data?.apparatus_name) {
      details = `${data.data.apparatus_name} ${event}`;
    }
    if (data.data?.personnel_name) {
      details = `${data.data.personnel_name} - ${event}`;
    }
    if (data.data?.station_id) {
      const stationNum = data.data.station_id.replace('sta-', '');
      details += ` (Station ${stationNum})`;
    }
    
    return details;
  };

  const fetchChanges = async () => {
    setLoading(true);
    try {
      let startDate, endDate;
      const today = new Date(selectedDate);
      
      if (viewMode === 'daily') {
        startDate = selectedDate;
        endDate = selectedDate;
      } else if (viewMode === 'weekly') {
        const dayOfWeek = today.getDay();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - dayOfWeek);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        startDate = startOfWeek.toISOString().split('T')[0];
        endDate = endOfWeek.toISOString().split('T')[0];
      } else if (viewMode === 'monthly') {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        startDate = startOfMonth.toISOString().split('T')[0];
        endDate = endOfMonth.toISOString().split('T')[0];
      }

      // Fetch staffing records with change history
      const response = await api.get('/staffing', {
        params: { 
          battalion_id: selectedBattalion,
          start_date: startDate,
          end_date: endDate
        }
      });

      // Extract all changes from staffing records
      const allChanges = [];
      response.data.forEach(record => {
        const changeHistory = record.change_history || [];
        changeHistory.forEach(change => {
          // Filter by date range
          const changeDate = change.timestamp?.split('T')[0];
          if (changeDate >= startDate && changeDate <= endDate) {
            allChanges.push({
              id: `${record.id}-${change.timestamp}`,
              timestamp: change.timestamp,
              type: 'staffing_update',
              event: 'updated',
              modified_by: change.modified_by_name || change.modified_by || 'Unknown',
              station_id: record.station_id,
              date: record.date,
              details: formatStaffingChanges(change.changes),
              changes: change.changes
            });
          }
        });
      });

      // Sort by timestamp descending
      allChanges.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setChanges(allChanges);
    } catch (error) {
      console.error('Error fetching changes:', error);
      toast.error('Failed to fetch change history');
    } finally {
      setLoading(false);
    }
  };

  const formatStaffingChanges = (changes) => {
    if (!changes || Object.keys(changes).length === 0) return 'No details';
    
    const descriptions = [];
    for (const [key, value] of Object.entries(changes)) {
      if (key === 'categories') {
        descriptions.push('Updated staffing categories');
      } else if (key === 'personnel_assigned') {
        const oldCount = Array.isArray(value.old) ? value.old.length : 0;
        const newCount = Array.isArray(value.new) ? value.new.length : 0;
        descriptions.push(`Personnel: ${oldCount} → ${newCount}`);
      } else if (key === 'remarks') {
        descriptions.push('Updated remarks');
      } else {
        descriptions.push(`${key}: ${JSON.stringify(value.old)} → ${JSON.stringify(value.new)}`);
      }
    }
    return descriptions.join(', ');
  };

  useEffect(() => {
    if (viewMode !== 'live') {
      fetchChanges();
    }
  }, [viewMode, selectedDate, selectedBattalion]);

  const navigateDate = (direction) => {
    const current = new Date(selectedDate);
    if (viewMode === 'daily') {
      current.setDate(current.getDate() + direction);
    } else if (viewMode === 'weekly') {
      current.setDate(current.getDate() + (direction * 7));
    } else if (viewMode === 'monthly') {
      current.setMonth(current.getMonth() + direction);
    }
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const getDateRangeLabel = () => {
    const today = new Date(selectedDate);
    
    if (viewMode === 'live') {
      return 'Real-time Changes';
    } else if (viewMode === 'daily') {
      return today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } else if (viewMode === 'weekly') {
      const dayOfWeek = today.getDay();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - dayOfWeek);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else if (viewMode === 'monthly') {
      return today.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    }
    return '';
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Change Log - ${getDateRangeLabel()}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #1a1a2e; border-bottom: 2px solid #b91c1c; padding-bottom: 10px; }
          h2 { color: #666; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f4f4f4; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
          .badge-staffing { background-color: #dbeafe; color: #1e40af; }
          .badge-overtime { background-color: #fef3c7; color: #92400e; }
          .badge-apparatus { background-color: #d1fae5; color: #065f46; }
          .timestamp { color: #666; font-size: 12px; }
          .footer { margin-top: 30px; font-size: 12px; color: #888; border-top: 1px solid #ddd; padding-top: 10px; }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>Medina County Fire Department</h1>
        <h2>Change Log - ${getDateRangeLabel()}</h2>
        <p>Battalion: ${selectedBattalion?.replace('bat-', 'Battalion ')}</p>
        <p>Generated: ${new Date().toLocaleString()}</p>
        
        <table>
          <thead>
            <tr>
              <th>Date/Time</th>
              <th>Type</th>
              <th>Modified By</th>
              <th>Station</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            ${(viewMode === 'live' ? liveChanges : changes).map(change => `
              <tr>
                <td class="timestamp">${new Date(change.timestamp).toLocaleString()}</td>
                <td><span class="badge badge-${change.type?.includes('staffing') ? 'staffing' : change.type?.includes('overtime') ? 'overtime' : 'apparatus'}">${change.type?.replace('_update', '') || 'change'}</span></td>
                <td>${change.modified_by}</td>
                <td>${change.station_id ? `Station ${change.station_id.replace('sta-', '')}` : '-'}</td>
                <td>${change.details}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="footer">
          <p>Total Changes: ${(viewMode === 'live' ? liveChanges : changes).length}</p>
          <p>This report was generated from the Medina County BC Staffing System</p>
        </div>
        
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    
    printWindow.document.close();
  };

  const handleExport = () => {
    const data = viewMode === 'live' ? liveChanges : changes;
    const csvContent = [
      ['Date/Time', 'Type', 'Modified By', 'Station', 'Details'].join(','),
      ...data.map(change => [
        new Date(change.timestamp).toLocaleString(),
        change.type?.replace('_update', '') || 'change',
        change.modified_by,
        change.station_id ? `Station ${change.station_id.replace('sta-', '')}` : '-',
        `"${change.details.replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `change_log_${viewMode}_${selectedDate}.csv`;
    link.click();
    
    toast.success('Change log exported');
  };

  const displayChanges = viewMode === 'live' ? liveChanges : changes;

  const getTypeBadgeColor = (type) => {
    if (type?.includes('staffing')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    if (type?.includes('overtime')) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    if (type?.includes('apparatus')) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    if (type?.includes('personnel')) return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
    if (type?.includes('volunteer')) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <History className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Change Log</h1>
              <p className="text-muted-foreground">Track all staffing changes and modifications</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Selector */}
            <Select value={viewMode} onValueChange={setViewMode}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="live">
                  <div className="flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-green-500" />
                    Live
                  </div>
                </SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Navigation (not for live mode) */}
            {viewMode !== 'live' && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => navigateDate(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-[160px]"
                />
                <Button variant="outline" size="icon" onClick={() => navigateDate(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {viewMode !== 'live' && (
                <Button variant="outline" onClick={fetchChanges} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              )}
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>

        {/* Date Range Label */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">{getDateRangeLabel()}</CardTitle>
              </div>
              <Badge variant="outline">
                {displayChanges.length} change{displayChanges.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            {viewMode === 'live' && (
              <CardDescription className="flex items-center gap-2 mt-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                Watching for changes in real-time
              </CardDescription>
            )}
          </CardHeader>
        </Card>

        {/* Change Log Table */}
        <Card ref={printRef}>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Date/Time
                    </div>
                  </TableHead>
                  <TableHead className="w-[120px]">Type</TableHead>
                  <TableHead className="w-[150px]">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Modified By
                    </div>
                  </TableHead>
                  <TableHead className="w-[100px]">Station</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Details
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayChanges.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {viewMode === 'live' 
                        ? 'Waiting for changes... Make a staffing change to see it appear here.'
                        : loading 
                          ? 'Loading...' 
                          : 'No changes found for this period.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  displayChanges.map((change) => (
                    <TableRow key={change.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">
                        {new Date(change.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge className={getTypeBadgeColor(change.type)}>
                          {change.type?.replace('_update', '') || 'change'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {change.modified_by}
                      </TableCell>
                      <TableCell>
                        {change.station_id 
                          ? `Station ${change.station_id.replace('sta-', '')}` 
                          : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {change.details}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        {displayChanges.length > 0 && (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{displayChanges.length}</div>
                <div className="text-sm text-muted-foreground">Total Changes</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">
                  {displayChanges.filter(c => c.type?.includes('staffing')).length}
                </div>
                <div className="text-sm text-muted-foreground">Staffing Changes</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">
                  {displayChanges.filter(c => c.type?.includes('overtime')).length}
                </div>
                <div className="text-sm text-muted-foreground">Overtime Changes</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">
                  {new Set(displayChanges.map(c => c.modified_by)).size}
                </div>
                <div className="text-sm text-muted-foreground">Users</div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default ChangeLogPage;
