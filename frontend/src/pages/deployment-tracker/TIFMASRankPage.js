import { useEffect, useState } from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { Flame, Trophy, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';

export const TIFMASRankPage = () => {
  const { api } = useAuth();
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchRoster = async () => {
    setLoading(true);
    try {
      const response = await api.get('/deployment-roster/tifmas-rank');
      setRoster(response.data);
    } catch (error) {
      console.error('Error fetching TIFMAS rank:', error);
      toast.error('Failed to load TIFMAS rankings');
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
    <div className="min-h-screen bg-background" data-testid="tifmas-rank-page">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-3xl uppercase tracking-wider font-bold flex items-center gap-2">
              <Flame className="h-8 w-8 text-orange-500" />
              TIFMAS Rank
            </h1>
            <p className="text-muted-foreground mt-1">
              Texas Intrastate Fire Mutual Aid System - Personnel ranked by deployment score
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-orange-500/20 text-orange-500 border-orange-500 px-4 py-2">
              <Trophy className="h-4 w-4 mr-2" />
              {roster.length} Eligible Personnel
            </Badge>
          </div>
        </div>

        <Card>
          <CardHeader className="bg-orange-500/10 border-b border-orange-500/20">
            <CardTitle className="text-orange-500 flex items-center gap-2">
              <Flame className="h-5 w-5" />
              TIFMAS Deployment Roster
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
                    <TableHead className="text-center">Last Deploy</TableHead>
                    <TableHead className="text-center">Deploys (12mo)</TableHead>
                    <TableHead className="text-center">FF1</TableHead>
                    <TableHead className="text-center">Crew Boss</TableHead>
                    <TableHead className="text-center">Engine Boss</TableHead>
                    <TableHead className="text-center">ASTL</TableHead>
                    <TableHead>Pack Test</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roster.map((entry, index) => (
                    <TableRow key={entry.id} className={index < 3 ? 'bg-orange-500/5' : ''}>
                      <TableCell className="text-center font-bold">
                        {index === 0 ? (
                          <span className="text-orange-500 text-lg">1st</span>
                        ) : index === 1 ? (
                          <span className="text-orange-400">2nd</span>
                        ) : index === 2 ? (
                          <span className="text-orange-300">3rd</span>
                        ) : (
                          <span className="text-muted-foreground">{index + 1}</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{entry.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{entry.rank}</Badge>
                      </TableCell>
                      <TableCell>{entry.ems_level}</TableCell>
                      <TableCell className="text-center">{entry.last_tifmas_deploy || '-'}</TableCell>
                      <TableCell className="text-center">{entry.deployments_last_12mo || 0}</TableCell>
                      <TableCell className="text-center"><BooleanBadge value={entry.ff1} /></TableCell>
                      <TableCell className="text-center"><BooleanBadge value={entry.crew_boss} /></TableCell>
                      <TableCell className="text-center"><BooleanBadge value={entry.engine_boss} /></TableCell>
                      <TableCell className="text-center"><BooleanBadge value={entry.astl} /></TableCell>
                      <TableCell>
                        <Badge variant={entry.pack_test_level === 'Arduous' ? 'default' : 'secondary'}>
                          {entry.pack_test_level || '-'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {roster.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                        No TIFMAS-eligible personnel found. Import roster data from the Roster page.
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
