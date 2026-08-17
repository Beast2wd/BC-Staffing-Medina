import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { Calendar, Clock, RefreshCw, DollarSign, AlertTriangle } from 'lucide-react';

const PAY_PERIODS = [
  { value: 'weekly', label: 'Weekly (52/year)', periods: 52 },
  { value: 'biweekly', label: 'Bi-weekly (26/year)', periods: 26 },
  { value: 'semimonthly', label: 'Semi-monthly (24/year)', periods: 24 },
  { value: 'monthly', label: 'Monthly (12/year)', periods: 12 }
];

const RESET_MODES = [
  { value: 'none', label: 'No Reset (Rollover)' },
  { value: 'calendar_year', label: 'Calendar Year (Jan 1)' },
  { value: 'fiscal_year', label: 'Fiscal Year (Use Leave Year Setting)' }
];

export const HolidayAccrualSettings = () => {
  const { api } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    holiday_pay_period: 'biweekly',
    holiday_accrual_mode: 'per_period',
    holiday_accrual_rate_per_period: 4.0,
    holiday_accrual_rate_yearly: 104.0,
    holiday_reset_mode: 'none',
    holiday_allow_negative: true,
    holiday_pay_period_start_date: ''
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/holiday-accrual/settings');
      setSettings({
        holiday_pay_period: response.data.holiday_pay_period || 'biweekly',
        holiday_accrual_mode: response.data.holiday_accrual_mode || 'per_period',
        holiday_accrual_rate_per_period: response.data.holiday_accrual_rate_per_period || 4.0,
        holiday_accrual_rate_yearly: response.data.holiday_accrual_rate_yearly || 104.0,
        holiday_reset_mode: response.data.holiday_reset_mode || 'none',
        holiday_allow_negative: response.data.holiday_allow_negative ?? true,
        holiday_pay_period_start_date: response.data.holiday_pay_period_start_date || ''
      });
    } catch (error) {
      console.error('Failed to fetch holiday accrual settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/holiday-accrual/settings', settings);
      toast.success('Holiday accrual settings saved');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const selectedPeriod = PAY_PERIODS.find(p => p.value === settings.holiday_pay_period);
  const calculatedYearly = settings.holiday_accrual_mode === 'per_period' 
    ? settings.holiday_accrual_rate_per_period * (selectedPeriod?.periods || 26)
    : settings.holiday_accrual_rate_yearly;
  const calculatedPerPeriod = settings.holiday_accrual_mode === 'yearly'
    ? settings.holiday_accrual_rate_yearly / (selectedPeriod?.periods || 26)
    : settings.holiday_accrual_rate_per_period;

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
    <Card className="border-green-200 dark:border-green-900">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="h-5 w-5 text-green-600" />
          Holiday Accrual Settings
        </CardTitle>
        <CardDescription>
          Configure how holiday hours accrue per pay period. Personnel can go negative and build back up.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pay Period Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Pay Period Frequency</Label>
          <Select
            value={settings.holiday_pay_period}
            onValueChange={(value) => setSettings({ ...settings, holiday_pay_period: value })}
          >
            <SelectTrigger data-testid="pay-period-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAY_PERIODS.map((period) => (
                <SelectItem key={period.value} value={period.value}>
                  {period.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Matches your department&apos;s payroll schedule
          </p>
        </div>

        {/* Pay Period Anchor Date */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Pay Period Start Date (Anchor)</Label>
          <Input
            type="date"
            value={settings.holiday_pay_period_start_date || ''}
            onChange={(e) => setSettings({ ...settings, holiday_pay_period_start_date: e.target.value })}
            data-testid="pay-period-anchor-date"
          />
          <p className="text-xs text-muted-foreground">
            Set a known pay period start date to align accrual calculations
          </p>
        </div>

        {/* Accrual Mode */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Accrual Rate Mode</Label>
          <div className="flex gap-2">
            <Button
              variant={settings.holiday_accrual_mode === 'per_period' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSettings({ ...settings, holiday_accrual_mode: 'per_period' })}
              data-testid="accrual-mode-per-period"
            >
              Per Pay Period
            </Button>
            <Button
              variant={settings.holiday_accrual_mode === 'yearly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSettings({ ...settings, holiday_accrual_mode: 'yearly' })}
              data-testid="accrual-mode-yearly"
            >
              Yearly Total
            </Button>
          </div>
        </div>

        {/* Accrual Rates */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Hours Per Pay Period
            </Label>
            <Input
              type="number"
              step="0.5"
              min="0"
              value={settings.holiday_accrual_mode === 'per_period' ? settings.holiday_accrual_rate_per_period : calculatedPerPeriod.toFixed(2)}
              onChange={(e) => setSettings({ ...settings, holiday_accrual_rate_per_period: parseFloat(e.target.value) || 0 })}
              disabled={settings.holiday_accrual_mode === 'yearly'}
              className={settings.holiday_accrual_mode === 'yearly' ? 'bg-muted' : ''}
              data-testid="accrual-rate-per-period"
            />
            {settings.holiday_accrual_mode === 'yearly' && (
              <p className="text-xs text-muted-foreground">Auto-calculated from yearly total</p>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Hours Per Year
            </Label>
            <Input
              type="number"
              step="1"
              min="0"
              value={settings.holiday_accrual_mode === 'yearly' ? settings.holiday_accrual_rate_yearly : calculatedYearly.toFixed(0)}
              onChange={(e) => setSettings({ ...settings, holiday_accrual_rate_yearly: parseFloat(e.target.value) || 0 })}
              disabled={settings.holiday_accrual_mode === 'per_period'}
              className={settings.holiday_accrual_mode === 'per_period' ? 'bg-muted' : ''}
              data-testid="accrual-rate-yearly"
            />
            {settings.holiday_accrual_mode === 'per_period' && (
              <p className="text-xs text-muted-foreground">Auto-calculated from per-period rate</p>
            )}
          </div>
        </div>

        {/* Summary Badge */}
        <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900">
          <div className="text-sm font-medium text-green-800 dark:text-green-200 flex items-center flex-wrap gap-1">
            <span>Default Accrual:</span>
            <Badge variant="secondary">{calculatedPerPeriod.toFixed(2)} hrs/{selectedPeriod?.value || 'period'}</Badge>
            <span className="mx-1">→</span>
            <Badge variant="secondary">{calculatedYearly.toFixed(0)} hrs/year</Badge>
          </div>
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
            Individual personnel can have custom rates (Admin vs Shift personnel)
          </p>
        </div>

        {/* Reset Mode */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Year-End Reset Mode</Label>
          <Select
            value={settings.holiday_reset_mode}
            onValueChange={(value) => setSettings({ ...settings, holiday_reset_mode: value })}
          >
            <SelectTrigger data-testid="reset-mode-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESET_MODES.map((mode) => (
                <SelectItem key={mode.value} value={mode.value}>
                  {mode.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {settings.holiday_reset_mode === 'none' && 'Unused hours roll over to next year'}
            {settings.holiday_reset_mode === 'calendar_year' && 'Balances reset to 0 on January 1st'}
            {settings.holiday_reset_mode === 'fiscal_year' && 'Balances reset based on your Leave Year setting'}
          </p>
        </div>

        {/* Allow Negative Balance */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Allow Negative Balance
            </Label>
            <p className="text-xs text-muted-foreground">
              Personnel can use more holiday time than accrued and build back up
            </p>
          </div>
          <Switch
            checked={settings.holiday_allow_negative}
            onCheckedChange={(checked) => setSettings({ ...settings, holiday_allow_negative: checked })}
            data-testid="allow-negative-switch"
          />
        </div>

        {/* Save Button */}
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="w-full"
          data-testid="save-holiday-settings-btn"
        >
          {saving ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Holiday Accrual Settings'
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default HolidayAccrualSettings;
