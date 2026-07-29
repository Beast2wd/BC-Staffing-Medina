import { useState, useEffect } from 'react';
import { Card, CardContent } from '../ui/card';
import { useAuth } from '../../context/AuthContext';
import { 
  Sun, 
  Cloud, 
  CloudRain, 
  CloudSnow, 
  CloudLightning, 
  CloudDrizzle,
  CloudFog,
  CloudSun,
  Wind,
  Droplets,
  Thermometer,
  MapPin,
  RefreshCw,
  Settings2
} from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

// Icon mapping
const WEATHER_ICONS = {
  'sun': Sun,
  'cloud': Cloud,
  'cloud-sun': CloudSun,
  'cloud-rain': CloudRain,
  'cloud-snow': CloudSnow,
  'cloud-lightning': CloudLightning,
  'cloud-drizzle': CloudDrizzle,
  'cloud-fog': CloudFog
};

const getWeatherIcon = (iconName, className = "h-6 w-6") => {
  const IconComponent = WEATHER_ICONS[iconName] || Cloud;
  return <IconComponent className={className} />;
};

// Format date to day name
const formatDayName = (dateStr, index) => {
  if (index === 0) return 'Today';
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short' });
};

export const WeatherWidget = () => {
  const { api, user } = useAuth();
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [locationDialog, setLocationDialog] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [detecting, setDetecting] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'battalion_chief' || user?.is_super_admin;

  const fetchWeather = async (lat, lon) => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (lat !== undefined && lon !== undefined) {
        params.latitude = lat;
        params.longitude = lon;
      }
      const response = await api.get('/weather/forecast', { params });
      setWeather(response.data);
    } catch (err) {
      console.error('Failed to fetch weather:', err);
      setError('Unable to load weather data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
  }, []);

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // Reverse geocode to get location name
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await response.json();
          const name = data.address?.city || data.address?.town || data.address?.county || 'Current Location';
          
          // Save the location
          await api.put('/weather/location', null, {
            params: { latitude, longitude, location_name: name }
          });
          
          toast.success(`Weather location set to ${name}`);
          setLocationDialog(false);
          fetchWeather(latitude, longitude);
        } catch (err) {
          toast.error('Failed to save location');
        } finally {
          setDetecting(false);
        }
      },
      (err) => {
        setDetecting(false);
        toast.error('Unable to get your location. Please check permissions.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSaveManualLocation = async () => {
    if (!locationName.trim()) {
      toast.error('Please enter a location name');
      return;
    }

    try {
      setDetecting(true);
      // Geocode the location name
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=json&limit=1`
      );
      const data = await response.json();
      
      if (data.length === 0) {
        toast.error('Location not found. Try a different search term.');
        setDetecting(false);
        return;
      }

      const { lat, lon, display_name } = data[0];
      
      // Save the location
      await api.put('/weather/location', null, {
        params: { 
          latitude: parseFloat(lat), 
          longitude: parseFloat(lon), 
          location_name: display_name.split(',')[0] 
        }
      });
      
      toast.success(`Weather location set to ${display_name.split(',')[0]}`);
      setLocationDialog(false);
      setLocationName('');
      fetchWeather(parseFloat(lat), parseFloat(lon));
    } catch (err) {
      toast.error('Failed to save location');
    } finally {
      setDetecting(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-gradient-to-r from-sky-500/10 to-blue-500/10 border-sky-200/50 dark:border-sky-800/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading weather...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-200/50 dark:border-amber-800/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{error}</span>
            <Button variant="ghost" size="sm" onClick={() => fetchWeather()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!weather) return null;

  const { current, forecast } = weather;

  return (
    <>
      <Card className="bg-gradient-to-r from-sky-500/10 via-blue-500/10 to-indigo-500/10 border-sky-200/50 dark:border-sky-800/50 overflow-hidden" data-testid="weather-widget">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Current Weather */}
            <div className="flex items-center gap-4 lg:border-r lg:border-sky-200/30 dark:lg:border-sky-700/30 lg:pr-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-sky-500/20 text-sky-600 dark:text-sky-400">
                  {getWeatherIcon(current.icon, "h-8 w-8")}
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground">{current.temperature}°</span>
                    <span className="text-sm text-muted-foreground">F</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{current.description}</p>
                </div>
              </div>
              
              {/* Current Details */}
              <div className="flex flex-col gap-1 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Droplets className="h-3.5 w-3.5 text-blue-500" />
                  <span>{current.humidity}%</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Wind className="h-3.5 w-3.5 text-slate-500" />
                  <span>{current.wind_speed} mph</span>
                </div>
              </div>
            </div>

            {/* 3-Day Forecast */}
            <div className="flex-1 grid grid-cols-4 gap-2 sm:gap-3">
              {forecast.map((day, index) => (
                <div 
                  key={day.date} 
                  className={`text-center p-2 rounded-lg ${
                    index === 0 
                      ? 'bg-sky-500/20 dark:bg-sky-500/10' 
                      : 'bg-white/50 dark:bg-slate-800/50'
                  }`}
                >
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    {formatDayName(day.date, index)}
                  </p>
                  <div className="flex justify-center mb-1 text-sky-600 dark:text-sky-400">
                    {getWeatherIcon(day.icon, "h-5 w-5")}
                  </div>
                  <div className="flex justify-center items-baseline gap-1 text-sm">
                    <span className="font-semibold">{day.temp_high}°</span>
                    <span className="text-muted-foreground text-xs">{day.temp_low}°</span>
                  </div>
                  <div className="flex justify-center gap-2 mt-1 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <Droplets className="h-2.5 w-2.5 text-blue-400" />
                      {day.humidity}%
                    </span>
                    {day.precipitation_chance > 0 && (
                      <span className="flex items-center gap-0.5">
                        <CloudRain className="h-2.5 w-2.5 text-blue-400" />
                        {day.precipitation_chance}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Settings Button (Admin only) */}
            {isAdmin && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="lg:ml-2"
                onClick={() => setLocationDialog(true)}
                data-testid="weather-settings-btn"
              >
                <MapPin className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Location Settings Dialog */}
      <Dialog open={locationDialog} onOpenChange={setLocationDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Weather Location Settings
            </DialogTitle>
            <DialogDescription>
              Set the weather location for your department's Daily Worksheet.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Auto-detect option */}
            <div className="space-y-2">
              <Label>Auto-Detect Location</Label>
              <Button 
                onClick={handleDetectLocation} 
                disabled={detecting}
                className="w-full"
                variant="outline"
              >
                {detecting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Detecting...
                  </>
                ) : (
                  <>
                    <MapPin className="h-4 w-4 mr-2" />
                    Use My Current Location
                  </>
                )}
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            {/* Manual entry */}
            <div className="space-y-2">
              <Label htmlFor="location">Enter Location</Label>
              <div className="flex gap-2">
                <Input
                  id="location"
                  placeholder="e.g., Medina, OH or 44256"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveManualLocation()}
                />
                <Button 
                  onClick={handleSaveManualLocation}
                  disabled={detecting || !locationName.trim()}
                >
                  {detecting ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Set'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter a city name, ZIP code, or address
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLocationDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WeatherWidget;
