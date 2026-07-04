import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { 
  Building2, 
  ChevronRight,
  ChevronLeft,
  Check,
  Plus,
  Trash2,
  Loader2,
  Copy,
  FileText,
  Settings,
  Users,
  Building,
  Truck,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';

const STEPS = [
  { id: 'basic', title: 'Basic Info', icon: FileText },
  { id: 'template', title: 'Starting Point', icon: Copy },
  { id: 'structure', title: 'Structure', icon: Building },
  { id: 'review', title: 'Review', icon: CheckCircle2 },
];

const TenantOnboardingWizard = ({ isOpen, onClose, onSuccess, existingTenants = [] }) => {
  const { api } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [defaults, setDefaults] = useState({ shifts: [], ranks: [], apparatus_types: [] });
  
  // Form state
  const [formData, setFormData] = useState({
    // Basic Info
    name: '',
    subdomain: '',
    admin_email: '',
    admin_name: 'Admin User',
    admin_payroll: '100001',
    
    // Template
    template: 'small',
    copy_from_tenant_id: null,
    
    // Structure (customizable)
    shifts: ['A', 'B', 'C'],
    battalions: [],
    stations: [],
    apparatus_types: ['Engine', 'Medic', 'Ladder', 'Rescue'],
    ranks: [],
  });

  // Fetch templates on mount
  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen]);

  // Apply template when selected
  useEffect(() => {
    if (formData.template && formData.template !== 'copy' && templates.length > 0) {
      applyTemplate(formData.template);
    }
  }, [formData.template]);

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/tenants/templates');
      setTemplates(response.data.templates);
      setDefaults(response.data.defaults);
      setFormData(prev => ({
        ...prev,
        shifts: response.data.defaults.shifts,
        ranks: response.data.defaults.ranks,
        apparatus_types: response.data.defaults.apparatus_types.map(a => a.name)
      }));
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  };

  const applyTemplate = async (templateId) => {
    if (templateId === 'blank') {
      setFormData(prev => ({
        ...prev,
        battalions: [],
        stations: []
      }));
      return;
    }

    try {
      const response = await api.get(`/tenants/templates/${templateId}`);
      const template = response.data;
      
      setFormData(prev => ({
        ...prev,
        battalions: template.battalions || [],
        stations: template.stations || []
      }));
    } catch (error) {
      console.error('Failed to apply template:', error);
    }
  };

  const copyFromTenant = async (tenantId) => {
    try {
      const response = await api.get(`/tenants/copy-source/${tenantId}`);
      const source = response.data;
      
      setFormData(prev => ({
        ...prev,
        battalions: source.battalions || [],
        stations: source.stations || []
      }));
    } catch (error) {
      toast.error('Failed to load tenant configuration');
    }
  };

  const handleNext = () => {
    // Validate current step
    if (currentStep === 0) {
      if (!formData.name || !formData.subdomain || !formData.admin_email) {
        toast.error('Please fill in all required fields');
        return;
      }
      // Validate subdomain format
      if (!/^[a-z0-9-]+$/.test(formData.subdomain.toLowerCase())) {
        toast.error('Subdomain can only contain lowercase letters, numbers, and hyphens');
        return;
      }
    }
    
    setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await api.post('/tenants/onboard', {
        name: formData.name,
        subdomain: formData.subdomain.toLowerCase(),
        admin_email: formData.admin_email,
        admin_name: formData.admin_name,
        admin_payroll: formData.admin_payroll,
        template: formData.template,
        copy_from_tenant_id: formData.copy_from_tenant_id,
        shifts: formData.shifts,
        battalions: formData.battalions,
        stations: formData.stations,
        apparatus_types: formData.apparatus_types,
        ranks: formData.ranks
      });
      
      toast.success(`Tenant "${formData.name} BC Staffing" created successfully!`);
      onSuccess?.(response.data);
      handleClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create tenant');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCurrentStep(0);
    setFormData({
      name: '',
      subdomain: '',
      admin_email: '',
      admin_name: 'Admin User',
      admin_payroll: '100001',
      template: 'small',
      copy_from_tenant_id: null,
      shifts: ['A', 'B', 'C'],
      battalions: [],
      stations: [],
      apparatus_types: ['Engine', 'Medic', 'Ladder', 'Rescue'],
      ranks: [],
    });
    onClose();
  };

  const addBattalion = () => {
    const nextNum = formData.battalions.length > 0 
      ? String(parseInt(formData.battalions[formData.battalions.length - 1].number) + 10)
      : '8100';
    setFormData(prev => ({
      ...prev,
      battalions: [...prev.battalions, { number: nextNum, name: `Battalion ${nextNum}` }]
    }));
  };

  const removeBattalion = (index) => {
    setFormData(prev => ({
      ...prev,
      battalions: prev.battalions.filter((_, i) => i !== index)
    }));
  };

  const updateBattalion = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      battalions: prev.battalions.map((b, i) => i === index ? { ...b, [field]: value } : b)
    }));
  };

  const addStation = () => {
    const nextNum = formData.stations.length > 0 
      ? String(parseInt(formData.stations[formData.stations.length - 1].number) + 1)
      : '10';
    const defaultBattalion = formData.battalions.length > 0 ? formData.battalions[0].number : '';
    setFormData(prev => ({
      ...prev,
      stations: [...prev.stations, { 
        number: nextNum, 
        name: `Station ${nextNum}`, 
        battalion: defaultBattalion,
        min_staffing: 4
      }]
    }));
  };

  const removeStation = (index) => {
    setFormData(prev => ({
      ...prev,
      stations: prev.stations.filter((_, i) => i !== index)
    }));
  };

  const updateStation = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      stations: prev.stations.map((s, i) => i === index ? { ...s, [field]: value } : s)
    }));
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Basic Info
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Fire Department Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Lakewood County"
                data-testid="onboard-name-input"
              />
              <p className="text-xs text-muted-foreground">
                Will appear as: <span className="font-medium">{formData.name || '[Name]'} BC Staffing</span>
              </p>
            </div>

            <div className="space-y-2">
              <Label>Subdomain *</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={formData.subdomain}
                  onChange={(e) => setFormData({ ...formData, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  placeholder="lakewood"
                  className="flex-1"
                  data-testid="onboard-subdomain-input"
                />
                <span className="text-sm text-muted-foreground">.bcstaffing.com</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Admin Name *</Label>
                <Input
                  value={formData.admin_name}
                  onChange={(e) => setFormData({ ...formData, admin_name: e.target.value })}
                  placeholder="Admin User"
                />
              </div>
              <div className="space-y-2">
                <Label>Admin Payroll # *</Label>
                <Input
                  value={formData.admin_payroll}
                  onChange={(e) => setFormData({ ...formData, admin_payroll: e.target.value })}
                  placeholder="100001"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Admin Email *</Label>
              <Input
                type="email"
                value={formData.admin_email}
                onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                placeholder="admin@department.gov"
                data-testid="onboard-email-input"
              />
            </div>
          </div>
        );

      case 1: // Template Selection
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose a starting point for your department configuration. You can customize everything in the next step.
            </p>

            <div className="grid grid-cols-2 gap-4">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    formData.template === template.id
                      ? 'border-primary bg-primary/5 ring-2 ring-primary'
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => {
                    setFormData({ ...formData, template: template.id, copy_from_tenant_id: null });
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{template.name}</span>
                    {formData.template === template.id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{template.description}</p>
                  {template.station_count > 0 && (
                    <div className="flex gap-2">
                      <Badge variant="secondary">{template.battalion_count} battalions</Badge>
                      <Badge variant="secondary">{template.station_count} stations</Badge>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {existingTenants.length > 0 && (
              <div className="pt-4 border-t">
                <div
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    formData.template === 'copy'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary'
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => setFormData({ ...formData, template: 'copy' })}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Copy className="h-4 w-4" />
                    <span className="font-medium">Copy from Existing Tenant</span>
                    {formData.template === 'copy' && (
                      <Check className="h-4 w-4 text-primary ml-auto" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Clone the structure from another fire department
                  </p>
                </div>

                {formData.template === 'copy' && (
                  <div className="mt-4">
                    <Label>Select Tenant to Copy</Label>
                    <Select
                      value={formData.copy_from_tenant_id || ''}
                      onValueChange={(value) => {
                        setFormData({ ...formData, copy_from_tenant_id: value });
                        copyFromTenant(value);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a tenant..." />
                      </SelectTrigger>
                      <SelectContent>
                        {existingTenants.map((tenant) => (
                          <SelectItem key={tenant.id} value={tenant.id}>
                            {tenant.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 2: // Structure Customization
        return (
          <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-2">
            {/* Shifts */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Shift Schedule
              </Label>
              <div className="flex flex-wrap gap-2">
                {['A', 'B', 'C', 'D'].map((shift) => (
                  <label key={shift} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={formData.shifts.includes(shift)}
                      onCheckedChange={(checked) => {
                        setFormData(prev => ({
                          ...prev,
                          shifts: checked 
                            ? [...prev.shifts, shift].sort()
                            : prev.shifts.filter(s => s !== shift)
                        }));
                      }}
                    />
                    <span>Shift {shift}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Battalions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Battalions ({formData.battalions.length})
                </Label>
                <Button variant="outline" size="sm" onClick={addBattalion}>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
              {formData.battalions.length > 0 ? (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Number</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.battalions.map((bat, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Input
                              value={bat.number}
                              onChange={(e) => updateBattalion(index, 'number', e.target.value)}
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={bat.name}
                              onChange={(e) => updateBattalion(index, 'name', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => removeBattalion(index)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
                  No battalions configured. Click &quot;Add&quot; to create one.
                </p>
              )}
            </div>

            {/* Stations */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Stations ({formData.stations.length})
                </Label>
                <Button variant="outline" size="sm" onClick={addStation} disabled={formData.battalions.length === 0}>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
              {formData.stations.length > 0 ? (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Station #</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Battalion</TableHead>
                        <TableHead>Min Staff</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.stations.map((sta, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Input
                              value={sta.number}
                              onChange={(e) => updateStation(index, 'number', e.target.value)}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={sta.name}
                              onChange={(e) => updateStation(index, 'name', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={sta.battalion}
                              onValueChange={(value) => updateStation(index, 'battalion', value)}
                            >
                              <SelectTrigger className="w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {formData.battalions.map((bat) => (
                                  <SelectItem key={bat.number} value={bat.number}>
                                    {bat.number}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={sta.min_staffing}
                              onChange={(e) => updateStation(index, 'min_staffing', parseInt(e.target.value) || 0)}
                              className="w-16"
                            />
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => removeStation(index)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
                  {formData.battalions.length === 0 
                    ? 'Add at least one battalion first'
                    : 'No stations configured. Click "Add" to create one.'}
                </p>
              )}
            </div>

            {/* Apparatus Types */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Apparatus Types
              </Label>
              <div className="flex flex-wrap gap-2">
                {defaults.apparatus_types?.map((type) => (
                  <label key={type.name} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={formData.apparatus_types.includes(type.name)}
                      onCheckedChange={(checked) => {
                        setFormData(prev => ({
                          ...prev,
                          apparatus_types: checked 
                            ? [...prev.apparatus_types, type.name]
                            : prev.apparatus_types.filter(t => t !== type.name)
                        }));
                      }}
                    />
                    <span>{type.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 3: // Review
        return (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold text-lg mb-4">{formData.name} BC Staffing</h3>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Subdomain:</span>
                  <p className="font-medium">{formData.subdomain}.bcstaffing.com</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Admin:</span>
                  <p className="font-medium">{formData.admin_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Admin Email:</span>
                  <p className="font-medium">{formData.admin_email}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Admin Payroll #:</span>
                  <p className="font-medium">{formData.admin_payroll}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-2xl">{formData.shifts.length}</CardTitle>
                  <CardDescription>Shifts ({formData.shifts.join(', ')})</CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-2xl">{formData.battalions.length}</CardTitle>
                  <CardDescription>Battalions</CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-2xl">{formData.stations.length}</CardTitle>
                  <CardDescription>Stations</CardDescription>
                </CardHeader>
              </Card>
            </div>

            {formData.battalions.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Battalions</h4>
                <div className="flex flex-wrap gap-2">
                  {formData.battalions.map((bat) => (
                    <Badge key={bat.number} variant="secondary">{bat.name}</Badge>
                  ))}
                </div>
              </div>
            )}

            {formData.stations.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Stations</h4>
                <div className="flex flex-wrap gap-2">
                  {formData.stations.map((sta) => (
                    <Badge key={sta.number} variant="outline">
                      Station {sta.number} ({sta.battalion})
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-sm">
                <strong>Admin Credentials:</strong> The admin user will be created with payroll number <code className="bg-muted px-1 rounded">{formData.admin_payroll}</code> and temporary password <code className="bg-muted px-1 rounded">changeme123</code>. They will be required to change their password on first login.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Create New Tenant
          </DialogTitle>
          <DialogDescription>
            Set up a new fire department on BC Staffing
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            
            return (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center gap-2 ${
                  isActive ? 'text-primary' : isCompleted ? 'text-green-600' : 'text-muted-foreground'
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isActive ? 'bg-primary text-primary-foreground' : 
                    isCompleted ? 'bg-green-600 text-white' : 'bg-muted'
                  }`}>
                    {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className="text-sm font-medium hidden sm:inline">{step.title}</span>
                </div>
                {index < STEPS.length - 1 && (
                  <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground" />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="min-h-[300px]">
          {renderStepContent()}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={currentStep === 0 ? handleClose : handleBack}
          >
            {currentStep === 0 ? 'Cancel' : (
              <>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </>
            )}
          </Button>

          {currentStep < STEPS.length - 1 ? (
            <Button onClick={handleNext}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Create Tenant
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TenantOnboardingWizard;
