import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { 
  Calendar, 
  Clock, 
  RefreshCw, 
  Sun, 
  Thermometer, 
  Gift,
  AlertTriangle,
  Info
} from 'lucide-react';

// Default accrual rates based on Medina County ESD1 Policy P-021
const DEFAULT_VACATION_RATES = {
  operations: [
    { minYears: 0, maxYears: 2, hoursPerYear: 60, label: 'Hire - 2 years' },
    { minYears: 3, maxYears: 5, hoursPerYear: 96, label: '3 - 5 years' },
    { minYears: 6, maxYears: 10, hoursPerYear: 144, label: '6 - 10 years' },
    { minYears: 11, maxYears: 99, hoursPerYear: 168, label: '10+ years' }
  ],
  administrative: [
    { minYears: 0, maxYears: 2, hoursPerYear: 40, label: 'Hire - 2 years' },
    { minYears: 3, maxYears: 5, hoursPerYear: 80, label: '3 - 5 years' },
    { minYears: 6, maxYears: 10, hoursPerYear: 120, label: '6 - 10 years' },
    { minYears: 11, maxYears: 99, hoursPerYear: 140, label: '10+ years' }
  ]
};

const DEFAULT_SICK_RATES = {
  operations: [
    { minYears: 0, maxYears: 5, hoursPerYear: 48, label: 'Hire - 5 years' },
    { minYears: 6, maxYears: 10, hoursPerYear: 72, label: '6 - 10 years' },
    { minYears: 11, maxYears: 99, hoursPerYear: 96, label: '10+ years' }
  ],
  administrative: [
    { minYears: 0, maxYears: 5, hoursPerYear: 40, label: 'Hire - 5 years' },
    { minYears: 6, maxYears: 10, hoursPerYear: 64, label: '6 - 10 years' },
    { minYears: 11, maxYears: 99, hoursPerYear: 80, label: '10+ years' }
  ]
};

const FEDERAL_HOLIDAYS = [
  "New Year's Day",
  "Martin Luther King Day",
  "Presidents Day",
  "Good Friday",
  "Memorial Day",
  "Independence Day",
  "Labor Day",
  "Veteran's Day",
  "Thanksgiving Day",
  "Friday after Thanksgiving",
  "Christmas Eve and Christmas Day"
];

export const PaidTimeOffSettings = () => {
  const { api } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('vacation');
  
  const [settings, setSettings] = useState({
    // Vacation Settings
    vacation_accrual_frequency: 'monthly',
    vacation_accrual_day: 1,
    vacation_rollover_cap_operations: 240,
    vacation_rollover_cap_admin: 120,
    vacation_new_hire_waiting_months: 6,
    vacation_allow_negative: true,
    vacation_rates_operations: DEFAULT_VACATION_RATES.operations,
    vacation_rates_admin: DEFAULT_VACATION_RATES.administrative,
    
    // Holiday Settings
    holiday_hours_per_holiday_operations: 12,
    holiday_hours_per_holiday_admin: 8,
    holiday_count: 11,
    holiday_allow_negative: true,
    holiday_december_cashout_percent: 50,
    holiday_call_off_penalty: true,
    
    // Sick Settings
    sick_accrual_frequency: 'monthly',
    sick_accrual_day: 1,
    sick_rollover_cap: 1080,
    sick_allow_negative: false,
    sick_rates_operations: DEFAULT_SICK_RATES.operations,
    sick_rates_admin: DEFAULT_SICK_RATES.administrative
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/pto-settings');
      if (response.data) {
        setSettings(prev => ({
          ...prev,
          ...response.data
        }));
      }
    } catch (error) {
      // If endpoint doesn't exist yet, use defaults
      console.log('Using default PTO settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/pto-settings', settings);
      toast.success('Paid Time Off settings saved');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateVacationRate = (type, index, field, value) => {
    const key = type === 'operations' ? 'vacation_rates_operations' : 'vacation_rates_admin';
    const rates = [...settings[key]];
    rates[index] = { ...rates[index], [field]: parseInt(value) || 0 };
    setSettings({ ...settings, [key]: rates });
  };

  const updateSickRate = (type, index, field, value) => {
    const key = type === 'operations' ? 'sick_rates_operations' : 'sick_rates_admin';
    const rates = [...settings[key]];
    rates[index] = { ...rates[index], [field]: parseInt(value) || 0 };
    setSettings({ ...settings, [key]: rates });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5 text-primary" />
          Paid Time Off Policy Settings
        </CardTitle>
        <CardDescription>
          Configure vacation, holiday, and sick time accrual based on department policy P-021
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="vacation" className="flex items-center gap-2" data-testid="vacation-tab">
              <Sun className="h-4 w-4" />
              Vacation
            </TabsTrigger>
            <TabsTrigger value="holiday" className="flex items-center gap-2" data-testid="holiday-tab">
              <Gift className="h-4 w-4" />
              Holiday
            </TabsTrigger>
            <TabsTrigger value="sick" className="flex items-center gap-2" data-testid="sick-tab">
              <Thermometer className="h-4 w-4" />
              Sick
            </TabsTrigger>
          </TabsList>

          {/* VACATION TAB */}
          <TabsContent value="vacation" className="space-y-6">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium">Vacation Policy Summary</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Monthly accrual based on years of service. New employees wait 6 months before using.
                    Operations may roll up to 240 hrs, Admin up to 120 hrs. Must reimburse if leave before earning.
                  </p>
                </div>
              </div>
            </div>

            {/* Accrual Frequency */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Accrual Frequency</Label>
                <Select
                  value={settings.vacation_accrual_frequency}
                  onValueChange={(v) => setSettings({ ...settings, vacation_accrual_frequency: v })}
                >
                  <SelectTrigger data-testid="vacation-frequency-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly (1st of month)</SelectItem>
                    <SelectItem value="biweekly">Bi-weekly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">New Hire Waiting Period</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="12"
                    value={settings.vacation_new_hire_waiting_months}
                    onChange={(e) => setSettings({ ...settings, vacation_new_hire_waiting_months: parseInt(e.target.value) || 0 })}
                    className="w-20"
                    data-testid="vacation-waiting-period"
                  />
                  <span className="text-sm text-muted-foreground">months</span>
                </div>
              </div>
            </div>

            {/* Rollover Caps */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Operations Rollover Cap</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    value={settings.vacation_rollover_cap_operations}
                    onChange={(e) => setSettings({ ...settings, vacation_rollover_cap_operations: parseInt(e.target.value) || 0 })}
                    className="w-24"
                    data-testid="vacation-rollover-ops"
                  />
                  <span className="text-sm text-muted-foreground">hours</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Admin Rollover Cap</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    value={settings.vacation_rollover_cap_admin}
                    onChange={(e) => setSettings({ ...settings, vacation_rollover_cap_admin: parseInt(e.target.value) || 0 })}
                    className="w-24"
                    data-testid="vacation-rollover-admin"
                  />
                  <span className="text-sm text-muted-foreground">hours</span>
                </div>
              </div>
            </div>

            {/* Allow Negative */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Allow Negative Balance</Label>
                <p className="text-xs text-muted-foreground">
                  Employees may use time before earning (must reimburse if they leave)
                </p>
              </div>
              <Switch
                checked={settings.vacation_allow_negative}
                onCheckedChange={(checked) => setSettings({ ...settings, vacation_allow_negative: checked })}
                data-testid="vacation-allow-negative"
              />
            </div>

            {/* Operations Rates Table */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Operations</Badge>
                Vacation Accrual Rates (Hours/Year)
              </Label>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Years of Service</th>
                      <th className="px-3 py-2 text-left font-medium">Hours/Year</th>
                      <th className="px-3 py-2 text-left font-medium">Hours/Month</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settings.vacation_rates_operations.map((rate, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-3 py-2 text-muted-foreground">{rate.label}</td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min="0"
                            value={rate.hoursPerYear}
                            onChange={(e) => updateVacationRate('operations', idx, 'hoursPerYear', e.target.value)}
                            className="w-20 h-8"
                            data-testid={`vacation-ops-rate-${idx}`}
                          />
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {(rate.hoursPerYear / 12).toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Administrative Rates Table */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Administrative</Badge>
                Vacation Accrual Rates (Hours/Year)
              </Label>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Years of Service</th>
                      <th className="px-3 py-2 text-left font-medium">Hours/Year</th>
                      <th className="px-3 py-2 text-left font-medium">Hours/Month</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settings.vacation_rates_admin.map((rate, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-3 py-2 text-muted-foreground">{rate.label}</td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min="0"
                            value={rate.hoursPerYear}
                            onChange={(e) => updateVacationRate('administrative', idx, 'hoursPerYear', e.target.value)}
                            className="w-20 h-8"
                            data-testid={`vacation-admin-rate-${idx}`}
                          />
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {(rate.hoursPerYear / 12).toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* HOLIDAY TAB */}
          <TabsContent value="holiday" className="space-y-6">
            <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-green-600 mt-0.5" />
                <div className="text-sm text-green-800 dark:text-green-200">
                  <p className="font-medium">Holiday Policy Summary</p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    11 federal holidays. Operations: 12 hrs/holiday, Admin: 8 hrs/holiday.
                    Earned as holidays occur. May cash in up to 50% in December.
                    No accrual if call off day before/of/after holiday.
                  </p>
                </div>
              </div>
            </div>

            {/* Holiday Hours Per Holiday */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">Ops</Badge>
                  Hours Per Holiday
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    value={settings.holiday_hours_per_holiday_operations}
                    onChange={(e) => setSettings({ ...settings, holiday_hours_per_holiday_operations: parseInt(e.target.value) || 0 })}
                    className="w-20"
                    data-testid="holiday-hours-ops"
                  />
                  <span className="text-sm text-muted-foreground">hours</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">Admin</Badge>
                  Hours Per Holiday
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    value={settings.holiday_hours_per_holiday_admin}
                    onChange={(e) => setSettings({ ...settings, holiday_hours_per_holiday_admin: parseInt(e.target.value) || 0 })}
                    className="w-20"
                    data-testid="holiday-hours-admin"
                  />
                  <span className="text-sm text-muted-foreground">hours</span>
                </div>
              </div>
            </div>

            {/* Holiday Count and Yearly Total */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Number of Holidays</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    value={settings.holiday_count}
                    onChange={(e) => setSettings({ ...settings, holiday_count: parseInt(e.target.value) || 0 })}
                    className="w-20"
                    data-testid="holiday-count"
                  />
                  <span className="text-sm text-muted-foreground">per year</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">December Cash-Out Limit</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={settings.holiday_december_cashout_percent}
                    onChange={(e) => setSettings({ ...settings, holiday_december_cashout_percent: parseInt(e.target.value) || 0 })}
                    className="w-20"
                    data-testid="holiday-cashout"
                  />
                  <span className="text-sm text-muted-foreground">% of balance</span>
                </div>
              </div>
            </div>

            {/* Yearly Totals Display */}
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-2">Annual Holiday Hours</p>
              <div className="flex gap-4">
                <Badge variant="secondary" className="text-sm">
                  Operations: {settings.holiday_count * settings.holiday_hours_per_holiday_operations} hrs/year
                </Badge>
                <Badge variant="secondary" className="text-sm">
                  Admin: {settings.holiday_count * settings.holiday_hours_per_holiday_admin} hrs/year
                </Badge>
              </div>
            </div>

            {/* Allow Negative */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Allow Negative Balance</Label>
                <p className="text-xs text-muted-foreground">
                  Personnel can use holiday time before it&apos;s earned
                </p>
              </div>
              <Switch
                checked={settings.holiday_allow_negative}
                onCheckedChange={(checked) => setSettings({ ...settings, holiday_allow_negative: checked })}
                data-testid="holiday-allow-negative"
              />
            </div>

            {/* Call-Off Penalty */}
            <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Call-Off Penalty
                </Label>
                <p className="text-xs text-muted-foreground">
                  No holiday accrual if call off day before, day of, or day after holiday
                </p>
              </div>
              <Switch
                checked={settings.holiday_call_off_penalty}
                onCheckedChange={(checked) => setSettings({ ...settings, holiday_call_off_penalty: checked })}
                data-testid="holiday-calloff-penalty"
              />
            </div>

            {/* Federal Holidays List */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Recognized Federal Holidays</Label>
              <div className="flex flex-wrap gap-2">
                {FEDERAL_HOLIDAYS.map((holiday, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {holiday}
                  </Badge>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* SICK TAB */}
          <TabsContent value="sick" className="space-y-6">
            <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-red-600 mt-0.5" />
                <div className="text-sm text-red-800 dark:text-red-200">
                  <p className="font-medium">Sick Time Policy Summary</p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    Monthly accrual based on years of service. Balances roll over year to year.
                    <strong> Cannot go negative</strong> - if you use more than accumulated, you won&apos;t be paid.
                    Cap: 1,080 hours maximum.
                  </p>
                </div>
              </div>
            </div>

            {/* Accrual Frequency & Rollover Cap */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Accrual Frequency</Label>
                <Select
                  value={settings.sick_accrual_frequency}
                  onValueChange={(v) => setSettings({ ...settings, sick_accrual_frequency: v })}
                >
                  <SelectTrigger data-testid="sick-frequency-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly (1st of month)</SelectItem>
                    <SelectItem value="biweekly">Bi-weekly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Maximum Balance Cap</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    value={settings.sick_rollover_cap}
                    onChange={(e) => setSettings({ ...settings, sick_rollover_cap: parseInt(e.target.value) || 0 })}
                    className="w-24"
                    data-testid="sick-rollover-cap"
                  />
                  <span className="text-sm text-muted-foreground">hours</span>
                </div>
              </div>
            </div>

            {/* Cannot Go Negative Warning */}
            <div className="flex items-center justify-between p-3 bg-red-100 dark:bg-red-950/50 rounded-lg border border-red-300 dark:border-red-800">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium flex items-center gap-2 text-red-700 dark:text-red-300">
                  <AlertTriangle className="h-4 w-4" />
                  Negative Balance NOT Allowed
                </Label>
                <p className="text-xs text-red-600 dark:text-red-400">
                  Per policy: If more sick hours used than accumulated, employee won&apos;t be paid
                </p>
              </div>
              <Switch
                checked={!settings.sick_allow_negative}
                onCheckedChange={(checked) => setSettings({ ...settings, sick_allow_negative: !checked })}
                data-testid="sick-no-negative"
              />
            </div>

            {/* Operations Rates Table */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Operations</Badge>
                Sick Time Accrual Rates (Hours/Year)
              </Label>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Years of Service</th>
                      <th className="px-3 py-2 text-left font-medium">Hours/Year</th>
                      <th className="px-3 py-2 text-left font-medium">Hours/Month</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settings.sick_rates_operations.map((rate, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-3 py-2 text-muted-foreground">{rate.label}</td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min="0"
                            value={rate.hoursPerYear}
                            onChange={(e) => updateSickRate('operations', idx, 'hoursPerYear', e.target.value)}
                            className="w-20 h-8"
                            data-testid={`sick-ops-rate-${idx}`}
                          />
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {(rate.hoursPerYear / 12).toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Administrative Rates Table */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Administrative</Badge>
                Sick Time Accrual Rates (Hours/Year)
              </Label>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Years of Service</th>
                      <th className="px-3 py-2 text-left font-medium">Hours/Year</th>
                      <th className="px-3 py-2 text-left font-medium">Hours/Month</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settings.sick_rates_admin.map((rate, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-3 py-2 text-muted-foreground">{rate.label}</td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min="0"
                            value={rate.hoursPerYear}
                            onChange={(e) => updateSickRate('administrative', idx, 'hoursPerYear', e.target.value)}
                            className="w-20 h-8"
                            data-testid={`sick-admin-rate-${idx}`}
                          />
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {(rate.hoursPerYear / 12).toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className="mt-6 pt-4 border-t">
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="w-full"
            data-testid="save-pto-settings-btn"
          >
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Paid Time Off Settings'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PaidTimeOffSettings;
