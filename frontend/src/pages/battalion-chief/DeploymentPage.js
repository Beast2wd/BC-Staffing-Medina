import { useEffect, useState, useMemo } from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useAuth } from '../../context/AuthContext';
import { useStaffing } from '../../context/StaffingContext';
import { BattalionSelector } from '../../components/dashboard/BattalionSelector';
import { toast } from 'sonner';
import { Plus, Save, Trash2, Users, Calendar, Clock, Flame, Ambulance, ChevronDown, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { formatDisplayDate } from '../../utils/dateUtils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../components/ui/accordion';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../components/ui/tabs';

export const DeploymentPage = () => {
  const { api, canEdit } = useAuth();
  const { personnel, fetchAllData, selectedBattalion } = useStaffing();
  const [deployments, setDeployments] = useState([]);
  const [deploymentLog, setDeploymentLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [viewMode, setViewMode] = useState('all'); // 'all', 'by-name', 'by-month'
  const [formData, setFormData] = useState({
    personnel_id: '',
    deployment_type: '',
    start_date: '',
    end_date: '',
    location: '',
    notes: ''
  });

  const deploymentTypes = [
    'TIFMAS',
    'EMTF',
    'TX-TF1',
    'Mutual Aid',
    'Strike Team',
    'Task Force',
    'Training',
    'Special Assignment',
    'Administrative',
    'Other'
  ];

  useEffect(() => {
    fetchAllData();
    fetchDeployments();
    fetchDeploymentLog();
  }, [selectedBattalion]);

  const fetchDeployments = async () => {
    try {
      const response = await api.get('/deployments');
      setDeployments(response.data);
    } catch (error) {
      console.error('Error fetching deployments:', error);
    }
  };

  const fetchDeploymentLog = async () => {
    try {
      const response = await api.get('/deployment-log');
      setDeploymentLog(response.data);
    } catch (error) {
      console.error('Error fetching deployment log:', error);
    }
  };

  const handleAddDeployment = async () => {
    if (!formData.personnel_id || !formData.deployment_type || !formData.start_date || !formData.end_date) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    try {
      // Add to both deployments and deployment-log for sync
      const deploymentId = crypto.randomUUID();
      await api.post('/deployments', {
        id: deploymentId,
        ...formData
      });
      
      // Also add to deployment log if it's TIFMAS or EMTF
      if (['TIFMAS', 'EMTF'].includes(formData.deployment_type)) {
        const person = personnel.find(p => p.id === formData.personnel_id);
        await api.post('/deployment-log', {
          date: formData.start_date,
          incident_type: formData.deployment_type,
          incident_name: formData.location || formData.deployment_type,
          personnel_name: person ? `${person.name}` : formData.personnel_id,
          personnel_id: formData.personnel_id,
          position: 'AST',
          notes: formData.notes
        });
      }
      
      toast.success('Deployment created');
      setShowAddDialog(false);
      fetchDeployments();
      fetchDeploymentLog();
      setFormData({ personnel_id: '', deployment_type: '', start_date: '', end_date: '', location: '', notes: '' });
    } catch (error) {
      toast.error('Failed to create deployment');
    } finally {
      setLoading(false);
    }
  };

  const getPersonnelName = (personnelId) => {
    const person = personnel.find(p => p.id === personnelId);
    return person ? `${person.rank} ${person.name}` : personnelId;
  };

  const getPersonnelInfo = (personnelId) => {
    return personnel.find(p => p.id === personnelId);
  };

  const isActive = (deployment) => {
    const today = new Date().toISOString().split('T')[0];
    const startDate = deployment.start_date || deployment.date;
    const endDate = deployment.end_date || deployment.date;
    return startDate <= today && endDate >= today;
  };

  // Get active deployments from all sources
  const activeDeployments = useMemo(() => {
    const active = [];
    const seen = new Set();
    
    // Check deployments collection first
    deployments.forEach(d => {
      if (isActive(d)) {
        const key = `${d.personnel_name || d.personnel_id}-${d.deployment_type}-${d.start_date}`;
        if (!seen.has(key)) {
          seen.add(key);
          active.push({
            ...d,
            source: 'deployment',
            personnel_name: d.personnel_name || getPersonnelName(d.personnel_id)
          });
        }
      }
    });
    
    // Also check deployment log for entries with current date
    deploymentLog.forEach(log => {
      const logAsDeployment = {
        id: log.id,
        personnel_id: log.personnel_id,
        personnel_name: log.personnel_name,
        deployment_type: log.incident_type,
        location: log.incident_name,
        start_date: log.start_date || log.date,
        end_date: log.end_date || log.date,
        position: log.position,
        notes: log.notes,
        source: 'log'
      };
      
      // Check if not already added (by name + type + date) and is active
      const key = `${log.personnel_name}-${log.incident_type}-${log.start_date || log.date}`;
      if (!seen.has(key) && isActive(logAsDeployment)) {
        seen.add(key);
        active.push(logAsDeployment);
      }
    });
    
    return active;
  }, [deployments, deploymentLog, personnel]);

  // Combine all deployments (from both sources)
  const allDeployments = useMemo(() => {
    const combined = [];
    
    // Add regular deployments
    deployments.forEach(d => {
      combined.push({
        ...d,
        source: 'deployment',
        personnel_name: getPersonnelName(d.personnel_id),
        date: d.start_date
      });
    });
    
    // Add deployment log entries
    deploymentLog.forEach(log => {
      // Check if not already added from deployments
      const exists = combined.some(c => 
        c.date === log.date && 
        c.personnel_name?.includes(log.personnel_name?.split(',')[0])
      );
      if (!exists) {
        combined.push({
          id: log.id,
          personnel_name: log.personnel_name,
          deployment_type: log.incident_type,
          location: log.incident_name,
          start_date: log.date,
          end_date: log.date,
          position: log.position,
          notes: log.notes,
          source: 'log',
          date: log.date
        });
      }
    });
    
    // Sort by date descending
    combined.sort((a, b) => new Date(b.date) - new Date(a.date));
    return combined;
  }, [deployments, deploymentLog, personnel]);

  // Group deployments by personnel name
  const deploymentsByName = useMemo(() => {
    const grouped = {};
    allDeployments.forEach(d => {
      const name = d.personnel_name || 'Unknown';
      if (!grouped[name]) {
        grouped[name] = [];
      }
      grouped[name].push(d);
    });
    // Sort names alphabetically
    return Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));
  }, [allDeployments]);

  // Group deployments by month
  const deploymentsByMonth = useMemo(() => {
    const grouped = {};
    allDeployments.forEach(d => {
      const date = new Date(d.date || d.start_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!grouped[monthKey]) {
        grouped[monthKey] = { name: monthName, deployments: [] };
      }
      grouped[monthKey].deployments.push(d);
    });
    // Sort by month descending (most recent first)
    return Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]));
  }, [allDeployments]);

  // Calculate days deployed for a person
  const calculateDaysDeployed = (personDeployments) => {
    let totalDays = 0;
    personDeployments.forEach(d => {
      if (d.start_date && d.end_date) {
        const start = new Date(d.start_date);
        const end = new Date(d.end_date);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        totalDays += days;
      } else {
        totalDays += 1; // Single day deployment from log
      }
    });
    return totalDays;
  };

  const getTypeBadgeColor = (type) => {
    switch (type?.toUpperCase()) {
      case 'TIFMAS': return 'bg-orange-500/20 text-orange-500 border-orange-500';
      case 'EMTF': return 'bg-blue-500/20 text-blue-500 border-blue-500';
      default: return 'bg-purple-500/20 text-purple-500 border-purple-500';
    }
  };

  const getTypeIcon = (type) => {
    switch (type?.toUpperCase()) {
      case 'TIFMAS': return <Flame className="h-4 w-4 text-orange-500" />;
      case 'EMTF': return <Ambulance className="h-4 w-4 text-blue-500" />;
      default: return <Users className="h-4 w-4 text-purple-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-background" data-testid="deployment-page">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-3xl uppercase tracking-wider font-bold">
              Deployments
            </h1>
            <p className="text-muted-foreground mt-1">
              Track personnel deployments and special assignments
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <BattalionSelector />
            {canEdit && (
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button data-testid="add-deployment-btn">
                    <Plus className="h-4 w-4 mr-2" /> Add Deployment
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="font-heading uppercase">New Deployment</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Personnel</Label>
                      <Select 
                        value={formData.personnel_id} 
                        onValueChange={(v) => setFormData({...formData, personnel_id: v})}
                      >
                        <SelectTrigger data-testid="personnel-select">
                          <SelectValue placeholder="Select Personnel" />
                        </SelectTrigger>
                        <SelectContent>
                          {personnel.map(person => (
                            <SelectItem key={person.id} value={person.id}>
                              {person.rank} {person.name} ({person.shift} Shift)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Deployment Type</Label>
                      <Select 
                        value={formData.deployment_type} 
                        onValueChange={(v) => setFormData({...formData, deployment_type: v})}
                      >
                        <SelectTrigger data-testid="type-select">
                          <SelectValue placeholder="Select Type" />
                        </SelectTrigger>
                        <SelectContent>
                          {deploymentTypes.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Date</Label>
                        <Input
                          type="date"
                          value={formData.start_date}
                          onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                          data-testid="start-date-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>End Date</Label>
                        <Input
                          type="date"
                          value={formData.end_date}
                          onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                          data-testid="end-date-input"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Location / Incident Name</Label>
                      <Input
                        value={formData.location}
                        onChange={(e) => setFormData({...formData, location: e.target.value})}
                        placeholder="Deployment location or incident name..."
                        data-testid="location-input"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({...formData, notes: e.target.value})}
                        placeholder="Optional notes..."
                        data-testid="notes-input"
                      />
                    </div>

                    <Button onClick={handleAddDeployment} disabled={loading} className="w-full" data-testid="save-deployment-btn">
                      <Save className="h-4 w-4 mr-2" /> Save Deployment
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Users className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeDeployments.length}</p>
                  <p className="text-xs text-muted-foreground">Active Deployments</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{allDeployments.length}</p>
                  <p className="text-xs text-muted-foreground">Total Deployments</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <Flame className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{allDeployments.filter(d => d.deployment_type === 'TIFMAS').length}</p>
                  <p className="text-xs text-muted-foreground">TIFMAS</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Ambulance className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{allDeployments.filter(d => d.deployment_type === 'EMTF').length}</p>
                  <p className="text-xs text-muted-foreground">EMTF</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Deployments */}
        <Card className="mb-6" data-testid="active-deployments-card">
          <CardHeader>
            <CardTitle className="font-heading uppercase text-green-500">Active Deployments</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Personnel</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeDeployments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No active deployments
                    </TableCell>
                  </TableRow>
                ) : (
                  activeDeployments.map(deployment => {
                    const person = deployment.personnel_id ? getPersonnelInfo(deployment.personnel_id) : null;
                    return (
                      <TableRow key={deployment.id} data-testid={`deployment-row-${deployment.id}`}>
                        <TableCell className="font-medium">
                          {deployment.personnel_name || getPersonnelName(deployment.personnel_id)}
                        </TableCell>
                        <TableCell>{person?.station_id?.replace('sta-', 'Station ') || deployment.station || '-'}</TableCell>
                        <TableCell>
                          {(person?.shift || deployment.shift) ? (
                            <span className={`px-2 py-1 rounded text-xs ${
                              (person?.shift || deployment.shift) === 'A' ? 'bg-red-500/20 text-red-500' :
                              (person?.shift || deployment.shift) === 'B' ? 'bg-green-500/20 text-green-500' :
                              'bg-blue-500/20 text-blue-500'
                            }`}>
                              {person?.shift || deployment.shift}
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getTypeBadgeColor(deployment.deployment_type)}>
                            {deployment.deployment_type}
                          </Badge>
                        </TableCell>
                        <TableCell>{deployment.location}</TableCell>
                        <TableCell>{formatDisplayDate(deployment.start_date)}</TableCell>
                        <TableCell>{formatDisplayDate(deployment.end_date)}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{deployment.notes || '-'}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* All Deployments with Tabs */}
        <Card data-testid="all-deployments-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading uppercase">All Deployments</CardTitle>
              <Tabs value={viewMode} onValueChange={setViewMode}>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="by-name">By Name</TabsTrigger>
                  <TabsTrigger value="by-month">By Month</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {viewMode === 'all' && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Personnel</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Location / Incident</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allDeployments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No deployments recorded
                      </TableCell>
                    </TableRow>
                  ) : (
                    allDeployments.map((deployment, idx) => (
                      <TableRow key={deployment.id || idx}>
                        <TableCell className="font-medium">{deployment.personnel_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getTypeBadgeColor(deployment.deployment_type)}>
                            {getTypeIcon(deployment.deployment_type)}
                            <span className="ml-1">{deployment.deployment_type}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>{deployment.location}</TableCell>
                        <TableCell>{formatDisplayDate(deployment.date || deployment.start_date)}</TableCell>
                        <TableCell>
                          {deployment.position && (
                            <Badge variant="secondary">{deployment.position}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs ${
                            deployment.source === 'deployment' && isActive(deployment) 
                              ? 'bg-green-500/20 text-green-500' 
                              : 'bg-gray-500/20 text-gray-500'
                          }`}>
                            {deployment.source === 'deployment' && isActive(deployment) ? 'Active' : 'Completed'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}

            {viewMode === 'by-name' && (
              <Accordion type="multiple" className="w-full">
                {deploymentsByName.map(([name, personDeployments]) => (
                  <AccordionItem key={name} value={name}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <Users className="h-4 w-4 text-primary" />
                          <span className="font-medium">{name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{personDeployments.length} deployments</Badge>
                          <Badge variant="secondary">{calculateDaysDeployed(personDeployments)} days</Badge>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Location / Incident</TableHead>
                            <TableHead>Position</TableHead>
                            <TableHead>Days</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {personDeployments.map((d, idx) => {
                            const days = d.start_date && d.end_date 
                              ? Math.ceil((new Date(d.end_date) - new Date(d.start_date)) / (1000 * 60 * 60 * 24)) + 1
                              : 1;
                            return (
                              <TableRow key={d.id || idx}>
                                <TableCell>{formatDisplayDate(d.date || d.start_date)}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={getTypeBadgeColor(d.deployment_type)}>
                                    {d.deployment_type}
                                  </Badge>
                                </TableCell>
                                <TableCell>{d.location}</TableCell>
                                <TableCell>
                                  {d.position && <Badge variant="secondary">{d.position}</Badge>}
                                </TableCell>
                                <TableCell>{days}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}

            {viewMode === 'by-month' && (
              <Accordion type="multiple" className="w-full">
                {deploymentsByMonth.map(([monthKey, monthData]) => (
                  <AccordionItem key={monthKey} value={monthKey}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <Calendar className="h-4 w-4 text-primary" />
                          <span className="font-medium">{monthData.name}</span>
                        </div>
                        <Badge variant="outline">{monthData.deployments.length} deployments</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Personnel</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Location / Incident</TableHead>
                            <TableHead>Position</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {monthData.deployments.map((d, idx) => (
                            <TableRow key={d.id || idx}>
                              <TableCell>{formatDisplayDate(d.date || d.start_date)}</TableCell>
                              <TableCell className="font-medium">{d.personnel_name}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={getTypeBadgeColor(d.deployment_type)}>
                                  {d.deployment_type}
                                </Badge>
                              </TableCell>
                              <TableCell>{d.location}</TableCell>
                              <TableCell>
                                {d.position && <Badge variant="secondary">{d.position}</Badge>}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
