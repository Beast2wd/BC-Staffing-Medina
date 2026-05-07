import { useEffect, useState } from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { Ambulance, Trophy, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';

export const EMTFRankPage = () => {
  const { api } = useAuth();
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchRoster = async () => {
    setLoading(true);
    try {
      const response = await api.get('/deployment-roster/emtf-rank');
      setRoster(response.data);
    } catch (error) {
      console.error('Error fetching EMTF rank:', error);
      toast.error('Failed to load EMTF rankings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoster();
  }, []);

  const BooleanBadge = ({ value }) => (
    value ? 
      <CheckCircle className="h-4 w-4 text-green-500" /> : 
      <XCircle className="h-4 w-4 text-red-500/50" />
  );

  return (
    <div className="min-h-screen bg-background" data-testid="emtf-rank-page">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-3xl uppercase tracking-wider font-bold flex items-center gap-2">
              <Ambulance className="h-8 w-8 text-blue-500" />
              EMTF Rank
            </h1>
            <p className="text-muted-foreground mt-1">
              Emergency Medical Task Force - Personnel ranked by deployment score
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-blue-500/20 text-blue-500 border-blue-500 px-4 py-2">
              <Trophy className="h-4 w-4 mr-2" />
              {roster.length} Eligible Personnel
            </Badge>
          </div>
        </div>

        <Card>
          <CardHeader className="bg-blue-500/10 border-b border-blue-500/20">
            <CardTitle className="text-blue-500 flex items-center gap-2">
              <Ambulance className="h-5 w-5" />
              EMTF Deployment Ranking (Highest Score = Next to Deploy)
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
                    <TableHead className="text-right">EMTF Score</TableHead>
                    <TableHead className="text-center">Last Deploy</TableHead>
                    <TableHead className="text-center">Deploys (12mo)</TableHead>
                    <TableHead className="text-center">MIST</TableHead>
                    <TableHead className="text-center">MedL</TableHead>
                    <TableHead className="text-center">Tech-Spec</TableHead>
                    <TableHead>Pack Test</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roster.map((entry, index) => (
                    <TableRow key={entry.id} className={index < 3 ? 'bg-blue-500/5' : ''}>
                      <TableCell className="text-center font-bold">
                        {index === 0 ? (
                          <span className="text-blue-500 text-lg">1st</span>
                        ) : index === 1 ? (
                          <span className="text-blue-400">2nd</span>
                        ) : index === 2 ? (
                          <span className="text-blue-300">3rd</span>
                        ) : (
                          <span className="text-muted-foreground">{index + 1}</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{entry.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{entry.rank}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={entry.ems_level === 'Paramedic' ? 'default' : 'secondary'}>
                          {entry.ems_level}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-blue-500">
                        {entry.emtf_score?.toFixed(1) || '-'}
                      </TableCell>
                      <TableCell className="text-center">{entry.last_emtf_deploy || '-'}</TableCell>
                      <TableCell className="text-center">{entry.deployments_last_12mo || 0}</TableCell>
                      <TableCell className="text-center"><BooleanBadge value={entry.mist} /></TableCell>
                      <TableCell className="text-center"><BooleanBadge value={entry.medl} /></TableCell>
                      <TableCell className="text-center"><BooleanBadge value={entry.tech_spec} /></TableCell>
                      <TableCell>
                        <Badge variant={entry.pack_test_level === 'Arduous' ? 'default' : 'secondary'}>
                          {entry.pack_test_level || '-'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {roster.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                        No EMTF-eligible personnel found. Import roster data from the Roster page.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
