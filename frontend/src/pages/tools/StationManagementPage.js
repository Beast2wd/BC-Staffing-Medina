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
import { Plus, Save, Edit2, Trash2, Truck, Shield, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';

export const StationManagementPage = () => {
  const { api } = useAuth();
  const { stations, battalions, fetchStations, fetchBattalions, personnel, fetchPersonnel } = useStaffing();
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingStation, setEditingStation] = useState(null);
  const [showNewBattalion, setShowNewBattalion] = useState(false);
  const [newBattalionData, setNewBattalionData] = useState({ battalion_number: '', name: '' });
  const [editingBattalion, setEditingBattalion] = useState(null);
  const [showEditBattalionDialog, setShowEditBattalionDialog] = useState(false);
  const [editBattalionData, setEditBattalionData] = useState({ battalion_number: '', name: '' });
  const [formData, setFormData] = useState({
    station_number: '',
    name: '',
    battalion_id: '',
    address: '',
    minimum_staffing: 3,
    apparatus: ''
  });

  useEffect(() => {
    fetchBattalions();
    fetchStations();
    fetchPersonnel();
  }, []);

  // Set default battalion when battalions are loaded
  useEffect(() => {
    if (battalions.length > 0 && !formData.battalion_id) {
      setFormData(prev => ({ ...prev, battalion_id: battalions[0].id }));
    }
  }, [battalions]);

  const resetForm = () => {
    setFormData({
      station_number: '',
      name: '',
      battalion_id: battalions.length > 0 ? battalions[0].id : '',
      address: '',
      minimum_staffing: 3,
      apparatus: ''
    });
    setEditingStation(null);
    setShowNewBattalion(false);
    setNewBattalionData({ battalion_number: '', name: '' });
  };

  const handleCreateBattalion = async () => {
    if (!newBattalionData.battalion_number || !newBattalionData.name) {
      toast.error('Please fill in battalion number and name');
      return;
    }

    try {
      const response = await api.post('/battalions', {
        battalion_number: newBattalionData.battalion_number,
        name: newBattalionData.name
      });
      
      toast.success(`Battalion ${newBattalionData.battalion_number} created`);
      await fetchBattalions();
      
      // Select the newly created battalion
      setFormData(prev => ({ ...prev, battalion_id: response.data.id }));
      setShowNewBattalion(false);
      setNewBattalionData({ battalion_number: '', name: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create battalion');
    }
  };

  const handleBattalionChange = (value) => {
    if (value === 'new') {
      setShowNewBattalion(true);
    } else {
      setShowNewBattalion(false);
      setFormData(prev => ({ ...prev, battalion_id: value }));
    }
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

  const handleDeleteBattalion = async (battalion) => {
    const stationsInBattalion = stations.filter(s => s.battalion_id === battalion.id);
    
    if (stationsInBattalion.length > 0) {
      toast.error(`Cannot delete Battalion ${battalion.battalion_number}. ${stationsInBattalion.length} station(s) are still assigned to it.`);
      return;
    }

    if (!window.confirm(`Are you sure you want to delete Battalion ${battalion.battalion_number} (${battalion.name})?`)) {
      return;
    }

    try {
      await api.delete(`/battalions/${battalion.id}`);
      toast.success(`Battalion ${battalion.battalion_number} deleted`);
      fetchBattalions();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete battalion');
    }
  };

  const handleEditBattalion = (battalion) => {
    setEditingBattalion(battalion);
    setEditBattalionData({
      battalion_number: battalion.battalion_number,
      name: battalion.name
    });
    setShowEditBattalionDialog(true);
  };

  const handleSaveBattalion = async () => {
    if (!editBattalionData.battalion_number || !editBattalionData.name) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      await api.put(`/battalions/${editingBattalion.id}`, {
        id: editingBattalion.id,
        battalion_number: editBattalionData.battalion_number,
        name: editBattalionData.name
      });
      toast.success('Battalion updated');
      setShowEditBattalionDialog(false);
      setEditingBattalion(null);
      fetchBattalions();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update battalion');
    }
  };

  const handleDeleteStation = async (station) => {
    const personnelInStation = personnel.filter(p => p.station_id === station.id);
    
    if (personnelInStation.length > 0) {
      toast.error(`Cannot delete Station ${station.station_number}. ${personnelInStation.length} personnel are still assigned to it.`);
      return;
    }

    if (!window.confirm(`Are you sure you want to delete Station ${station.station_number} (${station.name})?`)) {
      return;
    }

    try {
      await api.delete(`/stations/${station.id}`);
      toast.success(`Station ${station.station_number} deleted`);
      fetchStations();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete station');
    }
  };

  // Get personnel count for a station
  const getPersonnelCount = (stationId) => {
    return personnel.filter(p => p.station_id === stationId).length;
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
                    value={showNewBattalion ? 'new' : formData.battalion_id} 
                    onValueChange={handleBattalionChange}
                  >
                    <SelectTrigger data-testid="battalion-select">
                      <SelectValue placeholder="Select battalion" />
                    </SelectTrigger>
                    <SelectContent>
                      {battalions.map(battalion => (
                        <SelectItem key={battalion.id} value={battalion.id}>
                          Battalion {battalion.battalion_number} - {battalion.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="new" className="text-primary font-medium">
                        <span className="flex items-center gap-2">
                          <Plus className="h-4 w-4" /> Create New Battalion
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* New Battalion Form */}
                {showNewBattalion && (
                  <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-primary">
                      <Shield className="h-4 w-4" />
                      Create New Battalion
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Battalion Number *</Label>
                        <Input
                          value={newBattalionData.battalion_number}
                          onChange={(e) => setNewBattalionData(prev => ({ ...prev, battalion_number: e.target.value }))}
                          placeholder="e.g., 8111"
                          data-testid="new-battalion-number"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Battalion Name *</Label>
                        <Input
                          value={newBattalionData.name}
                          onChange={(e) => setNewBattalionData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g., North Battalion"
                          data-testid="new-battalion-name"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        size="sm" 
                        onClick={handleCreateBattalion}
                        data-testid="create-battalion-btn"
                      >
                        <Plus className="h-3 w-3 mr-1" /> Create Battalion
                      </Button>
                      <Button 
                        type="button" 
                        size="sm" 
                        variant="ghost"
                        onClick={() => {
                          setShowNewBattalion(false);
                          setNewBattalionData({ battalion_number: '', name: '' });
                          if (battalions.length > 0) {
                            setFormData(prev => ({ ...prev, battalion_id: battalions[0].id }));
                          }
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

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
          {stations.map(station => {
            const personnelCount = getPersonnelCount(station.id);
            const canDelete = personnelCount === 0;
            return (
            <Card key={station.id} className="hover:border-primary/50 transition-colors" data-testid={`station-card-${station.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-heading text-xl uppercase">
                    Station {station.station_number}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleEditStation(station)}
                      data-testid={`edit-station-${station.id}`}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={canDelete ? 'text-red-500 hover:text-red-700 hover:bg-red-50' : 'text-muted-foreground/30 cursor-not-allowed'}
                      onClick={() => canDelete && handleDeleteStation(station)}
                      disabled={!canDelete}
                      title={canDelete ? 'Delete station' : `Cannot delete - ${personnelCount} personnel assigned`}
                      data-testid={`delete-station-${station.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Personnel:</span>
                  <Badge variant={personnelCount > 0 ? "default" : "secondary"} className="text-xs">
                    {personnelCount} assigned
                  </Badge>
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
          )})}
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

        {/* Battalions Overview */}
        <Card className="mt-6" data-testid="battalions-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading uppercase flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Battalions ({battalions.length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {battalions.map(battalion => {
                const stationsInBattalion = stations.filter(s => s.battalion_id === battalion.id);
                const canDelete = stationsInBattalion.length === 0;
                return (
                  <div 
                    key={battalion.id} 
                    className="border rounded-lg p-4 bg-muted/20"
                    data-testid={`battalion-card-${battalion.id}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-heading font-bold">Battalion {battalion.battalion_number}</h3>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{stationsInBattalion.length} stations</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => handleEditBattalion(battalion)}
                          title="Edit battalion"
                          data-testid={`edit-battalion-${battalion.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-7 w-7 p-0 ${canDelete ? 'text-red-500 hover:text-red-700 hover:bg-red-50' : 'text-muted-foreground/30 cursor-not-allowed'}`}
                          onClick={() => canDelete && handleDeleteBattalion(battalion)}
                          disabled={!canDelete}
                          title={canDelete ? 'Delete battalion' : 'Cannot delete - stations assigned'}
                          data-testid={`delete-battalion-${battalion.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{battalion.name}</p>
                    {stationsInBattalion.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {stationsInBattalion.map(s => (
                          <Badge key={s.id} variant="secondary" className="text-xs">
                            Station {s.station_number}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No stations assigned</p>
                    )}
                  </div>
                );
              })}
              {battalions.length === 0 && (
                <p className="text-muted-foreground col-span-full text-center py-4">
                  No battalions found. Create one when adding a station.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Edit Battalion Dialog */}
        <Dialog open={showEditBattalionDialog} onOpenChange={setShowEditBattalionDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-heading uppercase">Edit Battalion</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Battalion Number</Label>
                <Input
                  value={editBattalionData.battalion_number}
                  onChange={(e) => setEditBattalionData(prev => ({ ...prev, battalion_number: e.target.value }))}
                  placeholder="e.g., 8110"
                  data-testid="edit-battalion-number-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Battalion Name</Label>
                <Input
                  value={editBattalionData.name}
                  onChange={(e) => setEditBattalionData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., North Battalion"
                  data-testid="edit-battalion-name-input"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveBattalion} className="flex-1" data-testid="save-battalion-btn">
                  <Save className="h-4 w-4 mr-2" /> Save
                </Button>
                <Button variant="outline" onClick={() => setShowEditBattalionDialog(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};
