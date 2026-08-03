import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { 
  Users, 
  RefreshCw, 
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Calendar
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../components/ui/tabs';

export const RotationScheduler = ({ onSelectPersonnel }) => {
  const { api } = useAuth();
  const [deploymentType, setDeploymentType] = useState('TIFMAS');
  const [suggestions, setSuggestions] = useState([]);
  const [totalEligible, setTotalEligible] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);

  const fetchSuggestions = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/deployment-roster/next-rotation/${deploymentType}?count=20`);
      setSuggestions(response.data.suggestions);
      setTotalEligible(response.data.total_eligible);
      setSelectedIds([]);
    } catch (error) {
      console.error('Failed to fetch rotation suggestions:', error);
      toast.error('Failed to load rotation suggestions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, [deploymentType]);

  const toggleSelection = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const handleRecordDecline = async (personId, personName) => {
    try {
      await api.post(`/deployment-roster/${personId}/decline?deployment_type=${deploymentType}`);
      toast.success(`Decline recorded for ${personName}`);
      fetchSuggestions();
    } catch (error) {
      toast.error('Failed to record decline');
    }
  };

  const handleProceedWithSelected = () => {
    const selected = suggestions.filter(s => selectedIds.includes(s.id));
    onSelectPersonnel?.(selected, deploymentType);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Rotation Scheduler
            </CardTitle>
            <CardDescription>
              Fair deployment selection based on rotation history
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchSuggestions} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={deploymentType} onValueChange={setDeploymentType}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="TIFMAS" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">
              TIFMAS
            </TabsTrigger>
            <TabsTrigger value="EMTF" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
              EMTF
            </TabsTrigger>
          </TabsList>

          <TabsContent value={deploymentType} className="mt-0">
            {/* Stats Summary */}
            <div className="flex gap-4 mb-4 p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm"><strong>{totalEligible}</strong> eligible personnel</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm"><strong>{selectedIds.length}</strong> selected</span>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-12">Select</TableHead>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Rank</TableHead>
                        <TableHead>Last Deploy</TableHead>
                        <TableHead className="text-center">12mo Count</TableHead>
                        <TableHead className="text-center">Declines</TableHead>
                        <TableHead className="w-24">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {suggestions.map((person) => (
                        <TableRow 
                          key={person.id}
                          className={selectedIds.includes(person.id) ? 'bg-primary/5' : ''}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.includes(person.id)}
                              onCheckedChange={() => toggleSelection(person.id)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground">
                            {person.rank}
                          </TableCell>
                          <TableCell className="font-medium">{person.name}</TableCell>
                          <TableCell>{person.person_rank}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className={person.last_deployment === 'Never' ? 'text-green-600 font-medium' : ''}>
                                {person.last_deployment}
                              </span>
                              {person.days_since_deployment !== null && (
                                <span className="text-xs text-muted-foreground">
                                  ({person.days_since_deployment}d ago)
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={person.deployments_12mo === 0 ? 'outline' : 'secondary'}>
                              {person.deployments_12mo}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {person.declined_count > 0 ? (
                              <Badge variant="destructive">{person.declined_count}</Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRecordDecline(person.id, person.name)}
                              title="Record decline"
                            >
                              <XCircle className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {selectedIds.length > 0 && (
                  <div className="mt-4 flex justify-end">
                    <Button onClick={handleProceedWithSelected}>
                      Proceed with {selectedIds.length} Selected
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Rotation Algorithm Explanation */}
        <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Fair Rotation Algorithm
          </h4>
          <p className="text-sm text-muted-foreground mb-2">
            Personnel are ranked based on these factors:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li><strong>Days since last deployment</strong> - More days = higher priority</li>
            <li><strong>Deployments in last 12 months</strong> - Fewer deployments = higher priority</li>
            <li><strong>Declined offers</strong> - Each decline reduces priority</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default RotationScheduler;
