import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { Clock, Globe, Calendar, RefreshCw } from 'lucide-react';
import { US_TIMEZONES, getBrowserTimezone, getDateInTimezone, getTimezoneAbbreviation } from '../../utils/timezoneUtils';

export const TimezoneSettings = () => {
  const { api } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    timezone: 'America/Chicago',
    use_browser_timezone: false,
    shift_reference_date: '2026-03-24',
    shift_reference_shift: 'C'
  });
  const [currentTime, setCurrentTime] = useState('');

  // Fetch current settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await api.get('/tenants/settings/timezone');
        setSettings({
          timezone: response.data.timezone || 'America/Chicago',
          use_browser_timezone: response.data.use_browser_timezone || false,
          shift_reference_date: response.data.shift_reference_date || '2026-03-24',
          shift_reference_shift: response.data.shift_reference_shift || 'C'
        });
      } catch (error) {
        console.error('Failed to fetch timezone settings:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [api]);

  // Update current time display
  useEffect(() => {
    const effectiveTimezone = settings.use_browser_timezone ? getBrowserTimezone() : settings.timezone;
    
    const updateTime = () => {
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: effectiveTimezone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
        setCurrentTime(formatter.format(new Date()));
      } catch (error) {
        setCurrentTime(new Date().toLocaleTimeString());
      }
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [settings.timezone, settings.use_browser_timezone]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/tenants/settings/timezone', settings);
      
      // Save to localStorage for quick access on page load
      localStorage.setItem('tenant_timezone', settings.timezone);
      localStorage.setItem('use_browser_timezone', settings.use_browser_timezone.toString());
      
      toast.success('Timezone settings saved successfully');
    } catch (error) {
      toast.error('Failed to save timezone settings');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const effectiveTimezone = settings.use_browser_timezone ? getBrowserTimezone() : settings.timezone;
  const todayDate = getDateInTimezone(effectiveTimezone);
  const tzAbbrev = getTimezoneAbbreviation(effectiveTimezone);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Timezone & Calendar Settings
        </CardTitle>
        <CardDescription>
          Configure timezone settings for your department. All dates, shifts, and calendars will use this timezone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Time Display */}
        <div className="bg-muted rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold font-mono">{currentTime}</p>
                <p className="text-sm text-muted-foreground">
                  {effectiveTimezone} ({tzAbbrev})
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold">{todayDate}</p>
              <p className="text-sm text-muted-foreground">Today's Date</p>
            </div>
          </div>
        </div>

        {/* Browser Timezone Toggle */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base">Use Browser/Device Timezone</Label>
            <p className="text-sm text-muted-foreground">
              When enabled, the app will use each user's device timezone instead of the department's fixed timezone.
              {settings.use_browser_timezone && (
                <span className="block mt-1 text-primary">
                  Detected: {getBrowserTimezone()}
                </span>
              )}
            </p>
          </div>
          <Switch
            checked={settings.use_browser_timezone}
            onCheckedChange={(checked) => setSettings(s => ({ ...s, use_browser_timezone: checked }))}
          />
        </div>

        {/* Timezone Selector */}
        {!settings.use_browser_timezone && (
          <div className="space-y-2">
            <Label htmlFor="timezone">Department Timezone</Label>
            <Select
              value={settings.timezone}
              onValueChange={(value) => setSettings(s => ({ ...s, timezone: value }))}
            >
              <SelectTrigger id="timezone">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {US_TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label} ({tz.offset})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              This timezone will be used for all shift schedules, calendars, and date displays.
            </p>
          </div>
        )}

        {/* Shift Rotation Settings */}
        <div className="border-t pt-6 space-y-4">
          <h4 className="font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Shift Rotation Reference
          </h4>
          <p className="text-sm text-muted-foreground">
            Set a known date and which shift was on duty. The system will calculate all other shifts based on this reference.
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reference-date">Reference Date</Label>
              <Input
                id="reference-date"
                type="date"
                value={settings.shift_reference_date}
                onChange={(e) => setSettings(s => ({ ...s, shift_reference_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference-shift">Shift On Duty (Day 1)</Label>
              <Select
                value={settings.shift_reference_shift}
                onValueChange={(value) => setSettings(s => ({ ...s, shift_reference_shift: value }))}
              >
                <SelectTrigger id="reference-shift">
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
          <p className="text-xs text-muted-foreground">
            Example: If March 24, 2026 was C Shift's first day, set that date and select "C Shift".
          </p>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default TimezoneSettings;
