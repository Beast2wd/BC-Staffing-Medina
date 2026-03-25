import { useEffect, useState } from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useAuth } from '../../context/AuthContext';
import { useStaffing } from '../../context/StaffingContext';
import { toast } from 'sonner';
import { Plus, Save, Edit2, Trash2, Truck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';

export const StationManagementPage = () => {
  const { api } = useAuth();
  const { stations, battalions, fetchStations, fetchBattalions } = useStaffing();
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingStation, setEditingStation] = useState(null);
  const [formData, setFormData] = useState({
    station_number: '',
    name: '',
    battalion_id: 'bat-8110',
    address: '',
    minimum_staffing: 3,
    apparatus: ''
  });

  useEffect(() => {
    fetchBattalions();
    fetchStations();
  }, []);

  const resetForm = () => {
    setFormData({
      station_number: '',
      name: '',
      battalion_id: 'bat-8110',
      address: '',
      minimum_staffing: 3,
      apparatus: ''
    });
    setEditingStation(null);
  };

  const handleAddStation = async () => {
    if (!formData.station_number || !formData.name) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    try {
      const apparatusList = formData.apparatus
        .split(',')
        .map(a => a.trim())
        .filter(a => a.length > 0);

      const stationData = {
        station_number: formData.station_number,
        name: formData.name,
        battalion_id: formData.battalion_id,
        address: formData.address,
        minimum_staffing: parseInt(formData.minimum_staffing) || 3,
        apparatus: apparatusList
      };

      if (editingStation) {
        await api.put(`/stations/${editingStation.id}`, stationData);
        toast.success('Station updated');
      } else {
        await api.post('/stations', stationData);
        toast.success('Station created');
      }
      
      setShowAddDialog(false);
      fetchStations();
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save station');
    } finally {
      setLoading(false);
    }
  };

  const handleEditStation = (station) => {
    setEditingStation(station);
    setFormData({
      station_number: station.station_number,
      name: station.name,
      battalion_id: station.battalion_id,
      address: station.address || '',
      minimum_staffing: station.minimum_staffing || 3,
      apparatus: station.apparatus?.join(', ') || ''
    });
    setShowAddDialog(true);
  };

  const getBattalionName = (battalionId) => {
    const battalion = battalions.find(b => b.id === battalionId);
    return battalion ? `Battalion ${battalion.battalion_number}` : battalionId;
  };

  return (
    <div className="min-h-screen bg-background" data-testid="station-management-page">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-3xl uppercase tracking-wider font-bold">
              Station Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage fire stations and apparatus
            </p>
          </div>
          
          <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button data-testid="add-station-btn">
                <Plus className="h-4 w-4 mr-2" /> Add Station
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="font-heading uppercase">
                  {editingStation ? 'Edit Station' : 'Add New Station'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Station Number *</Label>
                    <Input
                      value={formData.station_number}
                      onChange={(e) => setFormData({...formData, station_number: e.target.value})}
                      placeholder="e.g., 10"
                      data-testid="station-number-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Min. Staffing</Label>
                    <Input
                      type="number"
                      value={formData.minimum_staffing}
                      onChange={(e) => setFormData({...formData, minimum_staffing: e.target.value})}
                      min={1}
                      data-testid="min-staffing-input"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Station Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g., Station 10"
                    data-testid="station-name-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Battalion</Label>
                  <Select 
                    value={formData.battalion_id} 
                    onValueChange={(v) => setFormData({...formData, battalion_id: v})}
                  >
                    <SelectTrigger data-testid="battalion-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {battalions.map(battalion => (
                        <SelectItem key={battalion.id} value={battalion.id}>
                          Battalion {battalion.battalion_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    placeholder="Station address"
                    data-testid="address-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Apparatus (comma-separated)</Label>
                  <Input
                    value={formData.apparatus}
                    onChange={(e) => setFormData({...formData, apparatus: e.target.value})}
                    placeholder="Engine 10, Ladder 10, Medic 10"
                    data-testid="apparatus-input"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter apparatus names separated by commas
                  </p>
                </div>

                <Button onClick={handleAddStation} disabled={loading} className="w-full" data-testid="save-station-btn">
                  <Save className="h-4 w-4 mr-2" /> {editingStation ? 'Update' : 'Create'} Station
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
          {stations.map(station => (
            <Card key={station.id} className="hover:border-primary/50 transition-colors" data-testid={`station-card-${station.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-heading text-xl uppercase">
                    Station {station.station_number}
                  </CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleEditStation(station)}
                    data-testid={`edit-station-${station.id}`}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Battalion:</span>
                  <Badge variant="outline">{getBattalionName(station.battalion_id)}</Badge>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Min. Staffing:</span>
                  <span className="font-semibold">{station.minimum_staffing || 3}</span>
                </div>

                {station.address && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Address:</span>
                    <p className="text-xs mt-1">{station.address}</p>
                  </div>
                )}

                <div className="pt-2 border-t">
                  <div className="flex items-center gap-2 mb-2">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Apparatus</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {station.apparatus?.length > 0 ? (
                      station.apparatus.map((app, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {app}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">No apparatus configured</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Stations Table */}
        <Card data-testid="stations-table-card">
          <CardHeader>
            <CardTitle className="font-heading uppercase">
              All Stations ({stations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Station #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Battalion</TableHead>
                  <TableHead>Min. Staffing</TableHead>
                  <TableHead>Apparatus</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No stations found
                    </TableCell>
                  </TableRow>
                ) : (
                  stations.map(station => (
                    <TableRow key={station.id} data-testid={`station-row-${station.id}`}>
                      <TableCell className="font-mono font-bold">{station.station_number}</TableCell>
                      <TableCell className="font-medium">{station.name}</TableCell>
                      <TableCell>{getBattalionName(station.battalion_id)}</TableCell>
                      <TableCell className="text-center">{station.minimum_staffing || 3}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {station.apparatus?.map((app, idx) => (
                            <span key={idx} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {app}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs max-w-[150px] truncate">
                        {station.address || '-'}
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEditStation(station)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
