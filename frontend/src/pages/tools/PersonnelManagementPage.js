import { useEffect, useState, useCallback, memo } from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { useAuth } from '../../context/AuthContext';
import { useStaffing } from '../../context/StaffingContext';
import { BattalionSelector } from '../../components/dashboard/BattalionSelector';
import { toast } from 'sonner';
import { Plus, Save, Edit2, Trash2, Search, X, Key, UserCheck, UserPlus, Upload, Download, FileText, AlertCircle, CheckCircle2, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../../components/ui/command';
import { Textarea } from '../../components/ui/textarea';

const RANKS = [
  'Fire Chief', 
  'Asst. Chief', 
  'Deputy Chief', 
  'Battalion Chief', 
  'Captain', 
  'Lieutenant', 
  'Driver Operator', 
  'Paramedic',
  'Firefighter',
  'Volunteer Firefighter'
];

const COMMON_CERTIFICATIONS = [
  'EMT-B', 'EMT-P', 'AEMT', 'Firefighter I', 'Firefighter II', 
  'Fire Officer I', 'Fire Officer II', 'Hazmat Ops', 'Hazmat Tech',
  'Rescue Tech', 'Swift Water', 'Rope Rescue', 'Confined Space',
  'TCFP Structure', 'TCFP Wildland', 'ACLS', 'PALS', 'PHTLS'
];

// Separate form component to prevent re-renders
const PersonnelFormDialog = memo(({ 
  isOpen, 
  onClose, 
  onSave, 
  initialData, 
  stations, 
  isEdit, 
  loading,
  availableUsers = []
}) => {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [payrollNumber, setPayrollNumber] = useState('');
  const [name, setName] = useState('');
  const [rank, setRank] = useState('Firefighter');
  const [stationId, setStationId] = useState('');
  const [shift, setShift] = useState('A');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [certifications, setCertifications] = useState([]);
  const [certInput, setCertInput] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  // Leave allocation fields
  const [annualVacationDays, setAnnualVacationDays] = useState(15);
  const [annualVacationHours, setAnnualVacationHours] = useState(360);
  const [annualSickDays, setAnnualSickDays] = useState(12);
  const [annualSickHours, setAnnualSickHours] = useState(288);
  const [annualHolidayDays, setAnnualHolidayDays] = useState(11);
  const [annualHolidayHours, setAnnualHolidayHours] = useState(264);
  // Holiday accrual override fields
  const [holidayAccrualOverride, setHolidayAccrualOverride] = useState(false);
  const [holidayAccrualRateOverride, setHolidayAccrualRateOverride] = useState('');
  const [holidayCurrentBalance, setHolidayCurrentBalance] = useState(0);
  const [holidayPersonnelType, setHolidayPersonnelType] = useState('shift');
  const [holidayHireDate, setHolidayHireDate] = useState('');
  // Reset form when dialog opens with new data
  useEffect(() => {
    if (isOpen && initialData) {
      setPayrollNumber(initialData.payroll_number || '');
      setName(initialData.name || '');
      setRank(initialData.rank || 'Firefighter');
      setStationId(initialData.station_id || '');
      setShift(initialData.shift || 'A');
      setContactPhone(initialData.contact_phone || '');
      setContactEmail(initialData.contact_email || '');
      setCertifications(initialData.certifications || []);
      setSelectedUserId('');
      // Leave allocations - days and hours
      setAnnualVacationDays(initialData.annual_vacation_days ?? 15);
      setAnnualVacationHours(initialData.annual_vacation_hours ?? 360);
      setAnnualSickDays(initialData.annual_sick_days ?? 12);
      setAnnualSickHours(initialData.annual_sick_hours ?? 288);
      setAnnualHolidayDays(initialData.annual_holiday_days ?? 11);
      setAnnualHolidayHours(initialData.annual_holiday_hours ?? 264);
      // Holiday accrual override fields
      setHolidayAccrualOverride(initialData.holiday_accrual_override ?? false);
      setHolidayAccrualRateOverride(initialData.holiday_accrual_rate_override ?? '');
      setHolidayCurrentBalance(initialData.holiday_current_balance ?? 0);
      setHolidayPersonnelType(initialData.holiday_personnel_type ?? 'shift');
      setHolidayHireDate(initialData.holiday_hire_date ?? '');
    } else if (isOpen && !initialData) {
      // Reset for add mode
      setPayrollNumber('');
      setName('');
      setRank('Firefighter');
      setStationId('');
      setShift('A');
      setContactPhone('');
      setContactEmail('');
      setCertifications([]);
      setSelectedUserId('');
      // Default leave allocations - days and hours
      setAnnualVacationDays(15);
      setAnnualVacationHours(360);
      setAnnualSickDays(12);
      setAnnualSickHours(288);
      setAnnualHolidayDays(11);
      setAnnualHolidayHours(264);
      // Reset holiday accrual fields
      setHolidayAccrualOverride(false);
      setHolidayAccrualRateOverride('');
      setHolidayCurrentBalance(0);
      setHolidayPersonnelType('shift');
      setHolidayHireDate('');
    }
    setCertInput('');
    setUserSearchTerm('');
  }, [isOpen, initialData]);

  // Handle user selection - populate fields from selected user
  const handleSelectUser = (userId) => {
    const user = availableUsers.find(u => u.id === userId);
    if (user) {
      setSelectedUserId(userId);
      setPayrollNumber(user.payroll_number || '');
      setName(user.name || '');
      setRank(user.rank || 'Firefighter');
      setStationId(user.station_id || '');
      setShift(user.shift || 'A');
      setContactPhone(user.phone_number || '');
      setContactEmail(user.email || '');
    }
  };

  // Filter users based on search
  const filteredUsers = availableUsers.filter(user => {
    const searchLower = userSearchTerm.toLowerCase();
    return user.name.toLowerCase().includes(searchLower) || 
           user.payroll_number.includes(searchLower);
  });

  const addCertification = (cert) => {
    if (cert && !certifications.includes(cert)) {
      setCertifications([...certifications, cert]);
    }
    setCertInput('');
  };

  const removeCertification = (cert) => {
    setCertifications(certifications.filter(c => c !== cert));
  };

  const handleSave = () => {
    onSave({
      payroll_number: payrollNumber,
      name,
      rank,
      station_id: stationId,
      shift,
      contact_phone: contactPhone,
      contact_email: contactEmail,
      certifications,
      user_id: selectedUserId || null,  // Link to user if selected
      annual_vacation_days: parseInt(annualVacationDays) || 15,
      annual_vacation_hours: parseInt(annualVacationHours) || 360,
      annual_sick_days: parseInt(annualSickDays) || 12,
      annual_sick_hours: parseInt(annualSickHours) || 288,
      annual_holiday_days: parseInt(annualHolidayDays) || 11,
      annual_holiday_hours: parseInt(annualHolidayHours) || 264,
      // Holiday accrual override fields
      holiday_accrual_override: holidayAccrualOverride,
      holiday_accrual_rate_override: holidayAccrualOverride && holidayAccrualRateOverride ? parseFloat(holidayAccrualRateOverride) : null,
      holiday_current_balance: parseFloat(holidayCurrentBalance) || 0,
      holiday_personnel_type: holidayPersonnelType,
      holiday_hire_date: holidayHireDate || null
    });
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading uppercase">
            {isEdit ? 'Edit Personnel' : 'Add New Personnel'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* User Selection - Only show for Add mode */}
          {!isEdit && availableUsers.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Select from Users
              </Label>
              
              {/* Search input OUTSIDE the Select to prevent focus issues */}
              <Input
                placeholder="Search by name or employee #..."
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                className="mb-2"
                data-testid="user-search-input"
              />
              
              <Select value={selectedUserId} onValueChange={handleSelectUser}>
                <SelectTrigger data-testid="user-select">
                  <SelectValue placeholder="Select a user..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {filteredUsers.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      No matching users found
                    </div>
                  ) : (
                    filteredUsers.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{user.name}</span>
                          <span className="text-xs text-muted-foreground">#{user.payroll_number}</span>
                          <Badge variant="outline" className="text-xs">{user.rank}</Badge>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedUserId && (
                <p className="text-xs text-green-600">
                  User selected - demographics auto-filled below
                </p>
              )}
              <div className="border-t pt-2 mt-2">
                <p className="text-xs text-muted-foreground">Or enter details manually:</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Employee Number *</Label>
            <Input
              value={payrollNumber}
              onChange={(e) => setPayrollNumber(e.target.value)}
              placeholder="Enter employee number"
              data-testid="payroll-input"
              disabled={!!selectedUserId}
            />
          </div>

          <div className="space-y-2">
            <Label>Full Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter full name"
              data-testid="name-input"
              disabled={!!selectedUserId}
            />
          </div>

          <div className="space-y-2">
            <Label>Rank *</Label>
            <Select value={rank} onValueChange={setRank} disabled={!!selectedUserId}>
              <SelectTrigger data-testid="rank-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANKS.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Station *</Label>
              <Select value={stationId || "none"} onValueChange={(v) => setStationId(v === "none" ? "" : v)}>
                <SelectTrigger data-testid="station-select">
                  <SelectValue placeholder="Select Station" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {stations.map(station => (
                    <SelectItem key={station.id} value={station.id}>
                      Station {station.station_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Shift *</Label>
              <Select value={shift} onValueChange={setShift}>
                <SelectTrigger data-testid="shift-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A Shift</SelectItem>
                  <SelectItem value="B">B Shift</SelectItem>
                  <SelectItem value="C">C Shift</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Phone Number</Label>
            <Input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="(555) 555-5555"
              data-testid="phone-input"
            />
          </div>

          <div className="space-y-2">
            <Label>Email Address</Label>
            <Input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="email@example.com"
              data-testid="email-input"
            />
          </div>

          <div className="space-y-2">
            <Label>Certifications</Label>
            <div className="flex gap-2">
              <Select 
                value="" 
                onValueChange={(v) => { if (v) addCertification(v); }}
              >
                <SelectTrigger className="flex-1" data-testid="cert-select">
                  <SelectValue placeholder="Select certification" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_CERTIFICATIONS.filter(c => !certifications.includes(c)).map(cert => (
                    <SelectItem key={cert} value={cert}>{cert}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={certInput}
                onChange={(e) => setCertInput(e.target.value)}
                placeholder="Or type custom"
                className="w-32"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCertification(certInput);
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={() => addCertification(certInput)}>
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {certifications.map((cert, idx) => (
                <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                  {cert}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-red-500" 
                    onClick={() => removeCertification(cert)}
                  />
                </Badge>
              ))}
            </div>
          </div>

          {/* Leave Allocation Section */}
          <div className="space-y-3 pt-4 border-t">
            <Label className="text-sm font-semibold">
              Annual Leave Allocation
            </Label>
            
            {/* Vacation */}
            <div className="space-y-2">
              <Label className="text-xs text-blue-600 font-medium">Vacation</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Days/Year</Label>
                  <Input
                    type="number"
                    min="0"
                    max="365"
                    value={annualVacationDays}
                    onChange={(e) => {
                      const days = e.target.value;
                      setAnnualVacationDays(days);
                      // Auto-calculate hours (24 hours per day)
                      setAnnualVacationHours(parseInt(days) * 24 || 0);
                    }}
                    className="text-center h-8"
                    data-testid="vacation-days-input"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Hours/Year</Label>
                  <Input
                    type="number"
                    min="0"
                    max="8760"
                    value={annualVacationHours}
                    onChange={(e) => setAnnualVacationHours(e.target.value)}
                    className="text-center h-8"
                    data-testid="vacation-hours-input"
                  />
                </div>
              </div>
            </div>

            {/* Sick */}
            <div className="space-y-2">
              <Label className="text-xs text-red-600 font-medium">Sick</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Days/Year</Label>
                  <Input
                    type="number"
                    min="0"
                    max="365"
                    value={annualSickDays}
                    onChange={(e) => {
                      const days = e.target.value;
                      setAnnualSickDays(days);
                      setAnnualSickHours(parseInt(days) * 24 || 0);
                    }}
                    className="text-center h-8"
                    data-testid="sick-days-input"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Hours/Year</Label>
                  <Input
                    type="number"
                    min="0"
                    max="8760"
                    value={annualSickHours}
                    onChange={(e) => setAnnualSickHours(e.target.value)}
                    className="text-center h-8"
                    data-testid="sick-hours-input"
                  />
                </div>
              </div>
            </div>

            {/* Holiday */}
            <div className="space-y-2">
              <Label className="text-xs text-green-600 font-medium">Holiday</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Days/Year</Label>
                  <Input
                    type="number"
                    min="0"
                    max="365"
                    value={annualHolidayDays}
                    onChange={(e) => {
                      const days = e.target.value;
                      setAnnualHolidayDays(days);
                      setAnnualHolidayHours(parseInt(days) * 24 || 0);
                    }}
                    className="text-center h-8"
                    data-testid="holiday-days-input"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Hours/Year</Label>
                  <Input
                    type="number"
                    min="0"
                    max="8760"
                    value={annualHolidayHours}
                    onChange={(e) => setAnnualHolidayHours(e.target.value)}
                    className="text-center h-8"
                    data-testid="holiday-hours-input"
                  />
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Set annual leave allocation in days and/or hours. Days auto-calculate to hours (24hr shifts). 
              Defaults: Vacation 15d/360h, Sick 12d/288h, Holiday 11d/264h.
            </p>
          </div>

          {/* Holiday Accrual Override Section */}
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-green-600" />
                Holiday Accrual Settings
              </Label>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Custom Rate</Label>
                <Switch
                  checked={holidayAccrualOverride}
                  onCheckedChange={setHolidayAccrualOverride}
                  data-testid="holiday-accrual-override-switch"
                />
              </div>
            </div>

            {/* Personnel Type */}
            <div className="space-y-2">
              <Label className="text-xs">Personnel Type</Label>
              <Select
                value={holidayPersonnelType}
                onValueChange={setHolidayPersonnelType}
              >
                <SelectTrigger className="h-8" data-testid="holiday-personnel-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shift">Shift Personnel (24hr)</SelectItem>
                  <SelectItem value="administrative">Administrative (8hr)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Hire Date for Accrual */}
            <div className="space-y-2">
              <Label className="text-xs">Hire Date (for accrual start)</Label>
              <Input
                type="date"
                value={holidayHireDate}
                onChange={(e) => setHolidayHireDate(e.target.value)}
                className="h-8"
                data-testid="holiday-hire-date-input"
              />
            </div>

            {/* Custom Accrual Rate (only if override enabled) */}
            {holidayAccrualOverride && (
              <div className="space-y-2">
                <Label className="text-xs">Custom Accrual Rate (hrs/pay period)</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="e.g., 4.0"
                  value={holidayAccrualRateOverride}
                  onChange={(e) => setHolidayAccrualRateOverride(e.target.value)}
                  className="h-8"
                  data-testid="holiday-accrual-rate-input"
                />
                <p className="text-xs text-muted-foreground">
                  Overrides department default rate for this employee
                </p>
              </div>
            )}

            {/* Current Balance */}
            <div className="space-y-2">
              <Label className="text-xs">Current Holiday Balance (hours)</Label>
              <Input
                type="number"
                step="0.5"
                value={holidayCurrentBalance}
                onChange={(e) => setHolidayCurrentBalance(e.target.value)}
                className={`h-8 ${parseFloat(holidayCurrentBalance) < 0 ? 'border-red-500 text-red-600' : ''}`}
                data-testid="holiday-current-balance-input"
              />
              {parseFloat(holidayCurrentBalance) < 0 && (
                <p className="text-xs text-red-500">
                  Negative balance - will build back up with accrual
                </p>
              )}
            </div>
          </div>

          {!isEdit && !selectedUserId && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm">
              <p className="font-medium text-blue-600 dark:text-blue-400">Note:</p>
              <p className="text-muted-foreground">
                A user account will be automatically created with default password: <code className="bg-muted px-1 rounded">changeme123</code>
              </p>
              <p className="text-muted-foreground">User will be prompted to change password on first login.</p>
            </div>
          )}

          {!isEdit && selectedUserId && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm">
              <p className="font-medium text-green-600 dark:text-green-400">Linked to User</p>
              <p className="text-muted-foreground">
                This personnel record will be linked to the selected user account.
              </p>
            </div>
          )}

          <Button 
            onClick={handleSave} 
            disabled={loading} 
            className="w-full" 
            data-testid={isEdit ? "update-personnel-btn" : "save-personnel-btn"}
          >
            <Save className="h-4 w-4 mr-2" /> {isEdit ? 'Update' : 'Save'} Personnel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
});

PersonnelFormDialog.displayName = 'PersonnelFormDialog';

export const PersonnelManagementPage = () => {
  const { api } = useAuth();
  const { personnel, stations, fetchPersonnel, selectedBattalion, fetchAllData } = useStaffing();
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [passwordPerson, setPasswordPerson] = useState(null);
  const [tempPassword, setTempPassword] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterShift, setFilterShift] = useState('all');
  const [filterStation, setFilterStation] = useState('all');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importData, setImportData] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // Define rank order for sorting (lower number = higher rank)
  // Includes common aliases to ensure consistent sorting
  const rankOrder = {
    'Fire Chief': 1,
    'Chief': 1,
    'Asst. Chief': 2,
    'Assistant Chief': 2,
    'Deputy Chief': 3,
    'Battalion Chief': 4,
    'Captain': 5,
    'Lieutenant': 6,
    'Engineer': 7,
    'Driver Operator': 7,
    'Paramedic': 8,
    'Firefighter': 9,
    'Firefighter/Paramedic': 9,
    'Part-Time Firefighter': 10,
    'Part-Time Paramedic': 10,
    'Volunteer Firefighter': 11,
    'Volunteer': 11,
    'Admin': 12
  };

  // Helper to extract last name
  const getLastName = (fullName) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    return parts.length > 1 ? parts[parts.length - 1] : parts[0];
  };

  useEffect(() => {
    fetchAllData();
  }, [selectedBattalion]);

  // Fetch all active users for the dropdown
  const fetchAvailableUsers = async () => {
    try {
      const usersResponse = await api.get('/users');
      const users = usersResponse.data;
      
      // Show ALL active users (not just those without personnel records)
      const activeUsers = users.filter(u => u.is_active);
      
      setAvailableUsers(activeUsers);
    } catch (error) {
      console.error('Error fetching available users:', error);
    }
  };

  // Fetch available users when opening add dialog
  useEffect(() => {
    if (showAddDialog) {
      fetchAvailableUsers();
    }
  }, [showAddDialog]);

  const handleAddPersonnel = useCallback(async (formData) => {
    if (!formData.payroll_number || !formData.name || !formData.station_id) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    try {
      await api.post('/personnel', {
        ...formData,
        battalion_id: selectedBattalion
      });
      toast.success('Personnel added');
      setShowAddDialog(false);
      fetchPersonnel();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add personnel');
    } finally {
      setLoading(false);
    }
  }, [api, selectedBattalion, fetchPersonnel]);

  const handleEditPersonnel = useCallback(async (formData) => {
    if (!editingPerson) return;
    
    setLoading(true);
    try {
      await api.put(`/personnel/${editingPerson.id}`, {
        payroll_number: formData.payroll_number,
        name: formData.name,
        rank: formData.rank,
        station_id: formData.station_id,
        shift: formData.shift,
        certifications: formData.certifications,
        contact_phone: formData.contact_phone,
        contact_email: formData.contact_email,
        annual_vacation_days: formData.annual_vacation_days,
        annual_vacation_hours: formData.annual_vacation_hours,
        annual_sick_days: formData.annual_sick_days,
        annual_sick_hours: formData.annual_sick_hours,
        annual_holiday_days: formData.annual_holiday_days,
        annual_holiday_hours: formData.annual_holiday_hours,
        // Holiday accrual fields
        holiday_accrual_override: formData.holiday_accrual_override,
        holiday_accrual_rate_override: formData.holiday_accrual_rate_override,
        holiday_current_balance: formData.holiday_current_balance,
        holiday_personnel_type: formData.holiday_personnel_type,
        holiday_hire_date: formData.holiday_hire_date
      });
      toast.success('Personnel updated');
      setShowEditDialog(false);
      setEditingPerson(null);
      fetchPersonnel();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update personnel');
    } finally {
      setLoading(false);
    }
  }, [api, editingPerson, fetchPersonnel]);

  const openEditDialog = useCallback((person) => {
    setEditingPerson(person);
    setShowEditDialog(true);
  }, []);

  const handleDeletePersonnel = useCallback(async (personnelId) => {
    if (!confirm('Are you sure you want to deactivate this personnel?')) return;
    
    try {
      await api.delete(`/personnel/${personnelId}`);
      toast.success('Personnel deactivated');
      fetchPersonnel();
    } catch (error) {
      toast.error('Failed to deactivate personnel');
    }
  }, [api, fetchPersonnel]);

  const openPasswordDialog = useCallback((person) => {
    setPasswordPerson(person);
    setTempPassword('');
    setShowPasswordDialog(true);
  }, []);

  const handleSetPassword = useCallback(async () => {
    if (!passwordPerson || !tempPassword) {
      toast.error('Please enter a temporary password');
      return;
    }
    
    if (tempPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.post('/auth/set-temporary-password', {
        personnel_id: passwordPerson.id,
        temporary_password: tempPassword
      });
      toast.success(response.data.message);
      setShowPasswordDialog(false);
      setPasswordPerson(null);
      setTempPassword('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to set password');
    } finally {
      setLoading(false);
    }
  }, [api, passwordPerson, tempPassword]);

  // Download CSV template
  const handleDownloadTemplate = useCallback(async () => {
    try {
      const response = await api.get('/personnel/import/template', {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'personnel_import_template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded');
    } catch (error) {
      toast.error('Failed to download template');
    }
  }, [api]);

  // Export personnel to CSV
  const handleExportPersonnel = useCallback(async () => {
    try {
      const response = await api.get('/personnel/export', {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `personnel_export_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Personnel exported successfully');
    } catch (error) {
      toast.error('Failed to export personnel');
    }
  }, [api]);

  // Handle CSV file upload
  const handleFileUpload = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setImportData(e.target.result);
      setImportResults(null);
      setImportPreview(null);
      setShowPreview(false);
    };
    reader.readAsText(file);
  }, []);

  // Preview import data
  const handlePreviewImport = useCallback(async () => {
    if (!importData.trim()) {
      toast.error('No data to preview');
      return;
    }

    setImportLoading(true);
    setImportPreview(null);

    try {
      const response = await api.post('/personnel/import/preview', {
        csv_data: importData
      });

      setImportPreview(response.data);
      setShowPreview(true);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Preview failed');
    } finally {
      setImportLoading(false);
    }
  }, [api, importData]);

  // Process import
  const handleProcessImport = useCallback(async () => {
    if (!importData.trim()) {
      toast.error('No data to import');
      return;
    }

    setImportLoading(true);
    setImportResults(null);

    try {
      const response = await api.post('/personnel/import/process', {
        csv_data: importData
      });

      setImportResults(response.data);
      setShowPreview(false);
      
      if (response.data.errors?.length > 0) {
        toast.warning(`Import completed with ${response.data.errors.length} errors`);
      } else {
        toast.success(response.data.message);
      }

      // Refresh personnel list
      await fetchPersonnel();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Import failed');
      setImportResults({
        errors: [error.response?.data?.detail || 'Import failed'],
        created: 0,
        updated: 0
      });
    } finally {
      setImportLoading(false);
    }
  }, [api, importData, fetchPersonnel]);

  // Reset import dialog
  const handleCloseImportDialog = useCallback(() => {
    setShowImportDialog(false);
    setImportData('');
    setImportResults(null);
    setImportPreview(null);
    setShowPreview(false);
  }, []);

  const filteredPersonnel = personnel
    .filter(person => {
      const matchesSearch = person.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           person.payroll_number.includes(searchTerm);
      const matchesShift = filterShift === 'all' || person.shift === filterShift;
      const matchesStation = filterStation === 'all' || person.station_id === filterStation;
      return matchesSearch && matchesShift && matchesStation;
    })
    .sort((a, b) => {
      // First sort by rank
      const rankA = rankOrder[a.rank] || 999;
      const rankB = rankOrder[b.rank] || 999;
      if (rankA !== rankB) return rankA - rankB;
      
      // Then sort alphabetically by last name
      const lastNameA = getLastName(a.name).toLowerCase();
      const lastNameB = getLastName(b.name).toLowerCase();
      return lastNameA.localeCompare(lastNameB);
    });

  // Group personnel by station and shift
  const groupedPersonnel = filteredPersonnel.reduce((acc, person) => {
    const stationId = person.station_id || 'unassigned';
    const shift = person.shift || 'Unknown';
    
    if (!acc[stationId]) {
      acc[stationId] = { A: [], B: [], C: [] };
    }
    if (!acc[stationId][shift]) {
      acc[stationId][shift] = [];
    }
    acc[stationId][shift].push(person);
    return acc;
  }, {});

  // Sort stations by station number
  const sortedStations = Object.keys(groupedPersonnel).sort((a, b) => {
    if (a === 'unassigned') return 1;
    if (b === 'unassigned') return -1;
    const stationA = stations.find(s => s.id === a);
    const stationB = stations.find(s => s.id === b);
    return (stationA?.station_number || 999) - (stationB?.station_number || 999);
  });

  const getStationName = (stationId) => {
    if (stationId === 'unassigned') return 'Unassigned';
    const station = stations.find(s => s.id === stationId);
    return station ? `Station ${station.station_number}` : stationId;
  };

  const getShiftBadge = (shift) => {
    const colors = {
      'A': 'bg-red-500',
      'B': 'bg-green-500',
      'C': 'bg-blue-500'
    };
    return <Badge className={colors[shift] || 'bg-gray-500'}>{shift} Shift</Badge>;
  };

  const getShiftBorderColor = (shift) => {
    const colors = {
      'A': 'border-l-red-500',
      'B': 'border-l-green-500',
      'C': 'border-l-blue-500'
    };
    return colors[shift] || 'border-l-gray-500';
  };

  const getShiftBgColor = (shift) => {
    const colors = {
      'A': 'bg-red-500/5',
      'B': 'bg-green-500/5',
      'C': 'bg-blue-500/5'
    };
    return colors[shift] || 'bg-gray-500/5';
  };

  return (
    <div className="min-h-screen bg-background" data-testid="personnel-management-page">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-3xl uppercase tracking-wider font-bold">
              Personnel Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage fire department personnel
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <BattalionSelector />
            <Button 
              variant="outline" 
              onClick={handleExportPersonnel} 
              data-testid="export-personnel-btn"
            >
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowImportDialog(true)} 
              data-testid="import-personnel-btn"
            >
              <Upload className="h-4 w-4 mr-2" /> Import
            </Button>
            <Button onClick={() => setShowAddDialog(true)} data-testid="add-personnel-btn">
              <Plus className="h-4 w-4 mr-2" /> Add Personnel
            </Button>
          </div>
        </div>

        {/* Add Dialog */}
        <PersonnelFormDialog
          isOpen={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          onSave={handleAddPersonnel}
          initialData={null}
          stations={stations}
          isEdit={false}
          loading={loading}
          availableUsers={availableUsers}
        />

        {/* Edit Dialog */}
        <PersonnelFormDialog
          isOpen={showEditDialog}
          onClose={() => { setShowEditDialog(false); setEditingPerson(null); }}
          onSave={handleEditPersonnel}
          initialData={editingPerson}
          stations={stations}
          isEdit={true}
          loading={loading}
          availableUsers={[]}
        />

        {/* Set Password Dialog */}
        <Dialog open={showPasswordDialog} onOpenChange={(open) => { setShowPasswordDialog(open); if (!open) { setPasswordPerson(null); setTempPassword(''); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-heading uppercase">
                <Key className="h-5 w-5" />
                Set Temporary Password
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {passwordPerson && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium">{passwordPerson.rank} {passwordPerson.name}</p>
                  <p className="text-sm text-muted-foreground">Employee #: {passwordPerson.payroll_number}</p>
                </div>
              )}
              
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <UserCheck className="h-5 w-5 text-yellow-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-500">First Login Requirement</p>
                    <p className="text-muted-foreground">
                      The user will be prompted to change this password on their first login.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Temporary Password *</Label>
                <Input
                  type="text"
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  placeholder="Enter temporary password (min 6 chars)"
                  data-testid="temp-password-input"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum 6 characters. Share this password with the personnel member securely.
                </p>
              </div>

              <Button 
                onClick={handleSetPassword} 
                disabled={loading || !tempPassword} 
                className="w-full"
                data-testid="set-password-btn"
              >
                <Key className="h-4 w-4 mr-2" />
                {loading ? 'Setting...' : 'Set Password & Create Account'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Import CSV Dialog */}
        <Dialog open={showImportDialog} onOpenChange={(open) => { if (!open) handleCloseImportDialog(); else setShowImportDialog(true); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Import Personnel from CSV
              </DialogTitle>
              <DialogDescription>
                Upload a CSV file to bulk import or update personnel records. Existing personnel (matched by payroll number) will be updated.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {!showPreview && !importResults && (
                <>
                  {/* Download Template */}
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <p className="font-medium">CSV Template</p>
                        <p className="text-sm text-muted-foreground">Download a template with example data</p>
                      </div>
                    </div>
                    <Button variant="outline" onClick={handleDownloadTemplate}>
                      <Download className="h-4 w-4 mr-2" /> Download
                    </Button>
                  </div>

                  {/* File Upload */}
                  <div className="space-y-2">
                    <Label>Upload CSV File</Label>
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="cursor-pointer"
                      data-testid="csv-file-input"
                    />
                  </div>

                  {/* Or paste CSV data */}
                  <div className="space-y-2">
                    <Label>Or Paste CSV Data</Label>
                    <Textarea
                      value={importData}
                      onChange={(e) => { setImportData(e.target.value); setImportPreview(null); }}
                      placeholder="payroll_number,first_name,last_name,rank,shift,station_id,email,phone,certifications,hire_date&#10;100001,John,Smith,Captain,A,station_1,john@fire.gov,555-1234,EMT-P,2020-01-15"
                      rows={6}
                      className="font-mono text-sm"
                      data-testid="csv-data-input"
                    />
                    <p className="text-xs text-muted-foreground">
                      Headers: payroll_number, first_name, last_name, rank, shift, station_id, email, phone, certifications, hire_date
                    </p>
                  </div>
                </>
              )}

              {/* Preview Table */}
              {showPreview && importPreview && (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{importPreview.summary.total_rows} Total Rows</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4 text-green-500" />
                      <span className="text-sm">{importPreview.summary.to_create} New</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">{importPreview.summary.to_update} Updates</span>
                    </div>
                    {importPreview.summary.errors > 0 && (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-500" />
                        <span className="text-sm text-red-500">{importPreview.summary.errors} Errors</span>
                      </div>
                    )}
                  </div>

                  {/* Preview Table */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="max-h-[300px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="w-16">Row</TableHead>
                            <TableHead className="w-20">Action</TableHead>
                            <TableHead>Payroll #</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Rank</TableHead>
                            <TableHead>Shift</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importPreview.preview.map((row) => (
                            <TableRow 
                              key={row.row_number} 
                              className={!row.valid ? 'bg-red-500/10' : row.action === 'update' ? 'bg-blue-500/5' : ''}
                            >
                              <TableCell className="text-muted-foreground">{row.row_number}</TableCell>
                              <TableCell>
                                <Badge variant={row.action === 'create' ? 'default' : 'secondary'} className="text-xs">
                                  {row.action}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono">{row.payroll_number}</TableCell>
                              <TableCell>
                                {row.full_name}
                                {row.is_duplicate && row.existing_name && row.existing_name !== row.full_name && (
                                  <span className="text-xs text-muted-foreground ml-1">(was: {row.existing_name})</span>
                                )}
                              </TableCell>
                              <TableCell>{row.rank}</TableCell>
                              <TableCell>{row.shift}</TableCell>
                              <TableCell>
                                {row.valid ? (
                                  row.warnings?.length > 0 ? (
                                    <span className="text-xs text-yellow-600" title={row.warnings.join(', ')}>
                                      ⚠️ Warnings
                                    </span>
                                  ) : (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  )
                                ) : (
                                  <span className="text-xs text-red-500" title={row.errors.join(', ')}>
                                    ❌ {row.errors[0]}
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Review the data above. Click &quot;Confirm Import&quot; to proceed or &quot;Back&quot; to make changes.
                  </p>
                </div>
              )}

              {/* Import Results */}
              {importResults && (
                <div className="space-y-3">
                  <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">{importResults.created} Created</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">{importResults.updated} Updated</span>
                    </div>
                    {importResults.errors?.length > 0 && (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-medium">{importResults.errors.length} Errors</span>
                      </div>
                    )}
                  </div>

                  {importResults.errors?.length > 0 && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-sm font-medium text-red-600 mb-2">Errors:</p>
                      <ul className="text-sm text-red-600 space-y-1 max-h-32 overflow-y-auto">
                        {importResults.errors.map((error, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-red-500">•</span>
                            {error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {importResults.processed?.length > 0 && (
                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg max-h-40 overflow-y-auto">
                      <p className="text-sm font-medium text-green-600 mb-2">Processed:</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {importResults.processed.map((p, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <Badge variant={p.action === 'created' ? 'default' : 'secondary'} className="text-xs">
                              {p.action}
                            </Badge>
                            <span className="truncate">{p.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              {showPreview && !importResults ? (
                <>
                  <Button variant="outline" onClick={() => setShowPreview(false)}>
                    Back
                  </Button>
                  <Button 
                    onClick={handleProcessImport} 
                    disabled={importLoading || importPreview?.summary?.valid === 0}
                    data-testid="confirm-import-btn"
                  >
                    {importLoading ? (
                      <>
                        <div className="h-4 w-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Confirm Import ({importPreview?.summary?.valid || 0} records)
                      </>
                    )}
                  </Button>
                </>
              ) : importResults ? (
                <Button onClick={handleCloseImportDialog}>
                  Close
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={handleCloseImportDialog}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handlePreviewImport} 
                    disabled={importLoading || !importData.trim()}
                    data-testid="preview-import-btn"
                  >
                    {importLoading ? (
                      <>
                        <div className="h-4 w-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        Preview Import
                      </>
                    )}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or employee #..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="search-input"
                  />
                </div>
              </div>
              <Select value={filterShift} onValueChange={setFilterShift}>
                <SelectTrigger className="w-32" data-testid="filter-shift">
                  <SelectValue placeholder="Shift" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Shifts</SelectItem>
                  <SelectItem value="A">A Shift</SelectItem>
                  <SelectItem value="B">B Shift</SelectItem>
                  <SelectItem value="C">C Shift</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStation} onValueChange={setFilterStation}>
                <SelectTrigger className="w-40" data-testid="filter-station">
                  <SelectValue placeholder="Station" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stations</SelectItem>
                  {stations.map(station => (
                    <SelectItem key={station.id} value={station.id}>
                      Station {station.station_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Personnel Grouped by Station and Shift */}
        <div className="space-y-6" data-testid="personnel-grouped">
          {sortedStations.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No personnel found
              </CardContent>
            </Card>
          ) : (
            sortedStations.map(stationId => (
              <Card key={stationId} data-testid={`station-card-${stationId}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="font-heading uppercase flex items-center justify-between">
                    <span>{getStationName(stationId)}</span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {Object.values(groupedPersonnel[stationId]).flat().length} personnel
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {['A', 'B', 'C'].map(shift => {
                    const shiftPersonnel = groupedPersonnel[stationId][shift] || [];
                    if (shiftPersonnel.length === 0 && filterShift !== 'all') return null;
                    if (shiftPersonnel.length === 0) return null;
                    
                    return (
                      <div 
                        key={shift} 
                        className={`border-l-4 ${getShiftBorderColor(shift)} ${getShiftBgColor(shift)} rounded-r-lg`}
                        data-testid={`shift-group-${stationId}-${shift}`}
                      >
                        <div className="p-3">
                          <div className="flex items-center gap-2 mb-3">
                            {getShiftBadge(shift)}
                            <span className="text-sm text-muted-foreground">
                              ({shiftPersonnel.length} personnel)
                            </span>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-24">Emp #</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Rank</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Certifications</TableHead>
                                <TableHead className="w-32">Leave Alloc.</TableHead>
                                <TableHead className="w-24">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {shiftPersonnel.map(person => (
                                <TableRow key={person.id} data-testid={`personnel-row-${person.id}`}>
                                  <TableCell className="font-mono text-sm">{person.payroll_number}</TableCell>
                                  <TableCell className="font-medium">{person.name}</TableCell>
                                  <TableCell className="text-sm">{person.rank}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">{person.contact_phone || '-'}</TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                      {person.certifications?.slice(0, 3).map((cert, idx) => (
                                        <span key={idx} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                          {cert}
                                        </span>
                                      ))}
                                      {person.certifications?.length > 3 && (
                                        <span className="text-xs text-muted-foreground">
                                          +{person.certifications.length - 3}
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col gap-0.5 text-[10px]" title="Days / Hours per year">
                                      <div className="flex gap-1">
                                        <span className="bg-blue-500/20 text-blue-600 px-1.5 py-0.5 rounded">
                                          V:{person.annual_vacation_days ?? 15}d/{person.annual_vacation_hours ?? 360}h
                                        </span>
                                      </div>
                                      <div className="flex gap-1">
                                        <span className="bg-red-500/20 text-red-600 px-1.5 py-0.5 rounded">
                                          S:{person.annual_sick_days ?? 12}d/{person.annual_sick_hours ?? 288}h
                                        </span>
                                      </div>
                                      <div className="flex gap-1">
                                        <span className="bg-green-500/20 text-green-600 px-1.5 py-0.5 rounded">
                                          H:{person.annual_holiday_days ?? 11}d/{person.annual_holiday_hours ?? 264}h
                                        </span>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex gap-1">
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => openEditDialog(person)}
                                        title="Edit Personnel"
                                        data-testid={`edit-${person.id}`}
                                      >
                                        <Edit2 className="h-4 w-4" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => openPasswordDialog(person)}
                                        title="Set Password"
                                        className="text-blue-500"
                                        data-testid={`password-${person.id}`}
                                      >
                                        <Key className="h-4 w-4" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="text-red-500"
                                        onClick={() => handleDeletePersonnel(person.id)}
                                        title="Deactivate"
                                        data-testid={`delete-${person.id}`}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
};
