import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { Calendar, Save, RotateCcw } from 'lucide-react';
import { Badge } from '../ui/badge';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' }
];

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export const LeaveYearSettings = () => {
  const { api } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    leave_year_start_month: 1,
    leave_year_start_day: 1
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/tenants/me');
      const tenantSettings = response.data.settings || {};
      setSettings({
        leave_year_start_month: tenantSettings.leave_year_start_month || 1,
        leave_year_start_day: tenantSettings.leave_year_start_day || 1
      });
    } catch (error) {
      console.error('Failed to fetch leave year settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/tenants/settings', {
        leave_year_start_month: settings.leave_year_start_month,
        leave_year_start_day: settings.leave_year_start_day
      });
      toast.success('Leave year settings saved');
    } catch (error) {
      console.error('Failed to save leave year settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings({
      leave_year_start_month: 1,
      leave_year_start_day: 1
    });
    toast.info('Reset to calendar year (January 1)');
  };

  // Calculate the fiscal year label based on settings
  const getFiscalYearLabel = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const month = settings.leave_year_start_month;
    
    if (month === 1) {
      return `Calendar Year ${currentYear}`;
    } else {
      // For fiscal years that span two calendar years
      const fiscalStart = new Date(currentYear, month - 1, settings.leave_year_start_day);
      if (today >= fiscalStart) {
        return `FY ${currentYear}-${currentYear + 1}`;
      } else {
        return `FY ${currentYear - 1}-${currentYear}`;
      }
    }
  };

  // Get the max valid day for the selected month
  const getMaxDayForMonth = (month) => {
    const daysInMonth = new Date(2026, month, 0).getDate();
    return daysInMonth;
  };

  const handleMonthChange = (value) => {
    const month = parseInt(value);
    const maxDay = getMaxDayForMonth(month);
    setSettings(prev => ({
      ...prev,
      leave_year_start_month: month,
      // Adjust day if it exceeds the max for this month
      leave_year_start_day: Math.min(prev.leave_year_start_day, maxDay)
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading settings...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="leave-year-settings-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading uppercase">
          <Calendar className="h-5 w-5" />
          Leave Year Configuration
        </CardTitle>
        <CardDescription>
          Set the start date for your department&apos;s leave tracking year. This determines when leave balances reset.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Fiscal Year Display */}
        <div className="p-4 bg-muted/50 rounded-lg flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Current Leave Year</div>
            <div className="text-lg font-semibold">{getFiscalYearLabel()}</div>
          </div>
          <Badge variant="outline" className="text-sm">
            Starts {MONTHS.find(m => m.value === settings.leave_year_start_month)?.label} {settings.leave_year_start_day}
          </Badge>
        </div>

        {/* Settings Form */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Start Month</Label>
            <Select 
              value={settings.leave_year_start_month.toString()} 
              onValueChange={handleMonthChange}
            >
              <SelectTrigger data-testid="leave-year-month-select">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map(month => (
                  <SelectItem key={month.value} value={month.value.toString()}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Start Day</Label>
            <Select 
              value={settings.leave_year_start_day.toString()} 
              onValueChange={(v) => setSettings(prev => ({ ...prev, leave_year_start_day: parseInt(v) }))}
            >
              <SelectTrigger data-testid="leave-year-day-select">
                <SelectValue placeholder="Select day" />
              </SelectTrigger>
              <SelectContent>
                {DAYS.filter(d => d <= getMaxDayForMonth(settings.leave_year_start_month)).map(day => (
                  <SelectItem key={day} value={day.toString()}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Common Presets */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Quick Presets</Label>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSettings({ leave_year_start_month: 1, leave_year_start_day: 1 })}
              className={settings.leave_year_start_month === 1 && settings.leave_year_start_day === 1 ? 'border-primary' : ''}
            >
              Calendar Year (Jan 1)
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSettings({ leave_year_start_month: 10, leave_year_start_day: 1 })}
              className={settings.leave_year_start_month === 10 && settings.leave_year_start_day === 1 ? 'border-primary' : ''}
            >
              Federal FY (Oct 1)
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSettings({ leave_year_start_month: 7, leave_year_start_day: 1 })}
              className={settings.leave_year_start_month === 7 && settings.leave_year_start_day === 1 ? 'border-primary' : ''}
            >
              Texas FY (Jul 1)
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSettings({ leave_year_start_month: 4, leave_year_start_day: 1 })}
              className={settings.leave_year_start_month === 4 && settings.leave_year_start_day === 1 ? 'border-primary' : ''}
            >
              UK FY (Apr 1)
            </Button>
          </div>
        </div>

        {/* Info */}
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm">
          <p className="text-blue-600 dark:text-blue-400">
            <strong>Note:</strong> Changing the leave year start date affects how leave balances are calculated. 
            Leave records will be counted for the period that includes the current date based on this setting.
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Calendar Year
          </Button>
          <Button onClick={handleSave} disabled={saving} data-testid="save-leave-year-btn">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default LeaveYearSettings;
