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
  Settings2,
  Radar,
  ExternalLink
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
  const [currentLocation, setCurrentLocation] = useState(null);

  const isAdmin = user?.role === 'admin' || user?.role === 'battalion_chief' || user?.is_super_admin;

  const fetchWeather = async (lat, lon, showToast = false) => {
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
      if (response.data?.location) {
        setCurrentLocation(response.data.location);
      }
      // Show notice if using cached data
      if (response.data?.rate_limited) {
        setError('Using cached data (service busy)');
      } else if (showToast) {
        toast.success('Weather updated');
      }
    } catch (err) {
      console.error('Failed to fetch weather:', err);
      const errorMsg = err.response?.data?.detail || 'Unable to load weather data';
      if (errorMsg.includes('rate limit')) {
        setError('Weather service busy - try again later');
      } else {
        setError('Unable to load weather data');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
    
    // Auto-refresh weather every 30 minutes
    const refreshInterval = setInterval(() => {
      fetchWeather();
    }, 30 * 60 * 1000); // 30 minutes in milliseconds
    
    return () => clearInterval(refreshInterval);
  }, []);

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setDetecting(true);
    toast.info('Detecting your location...');
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // Use backend proxy for reverse geocoding
          const geoResponse = await api.get('/weather/reverse-geocode', {
            params: { latitude, longitude }
          });
          
          const locationDisplayName = geoResponse.data.display_name || geoResponse.data.name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          
          // Save the location
          await api.put('/weather/location', null, {
            params: { latitude, longitude, location_name: locationDisplayName }
          });
          
          toast.success(`Weather location set to ${locationDisplayName}`);
          setLocationDialog(false);
          
          // Refresh weather with new location
          await fetchWeather(latitude, longitude);
        } catch (err) {
          console.error('Location save error:', err);
          toast.error('Failed to save location. Please try manual entry.');
        } finally {
          setDetecting(false);
        }
      },
      (err) => {
        setDetecting(false);
        console.error('Geolocation error:', err);
        if (err.code === 1) {
          toast.error('Location access denied. Please enable location permissions or use manual entry.');
        } else if (err.code === 2) {
          toast.error('Location unavailable. Please try manual entry.');
        } else {
          toast.error('Location request timed out. Please try manual entry.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleSaveManualLocation = async () => {
    if (!locationName.trim()) {
      toast.error('Please enter a location name');
      return;
    }

    try {
      setDetecting(true);
      toast.info('Looking up location...');
      
      // Use backend proxy for geocoding
      const geoResponse = await api.get('/weather/geocode', {
        params: { query: locationName.trim() }
      });
      
      const results = geoResponse.data.results;
      if (!results || results.length === 0) {
        toast.error('Location not found. Try a different city name or ZIP code.');
        return;
      }
      
      // Use the first result
      const location = results[0];
      const { latitude, longitude, display_name, name, region } = location;
      const locationDisplayName = display_name || `${name}, ${region}`;
      
      // Save the location
      await api.put('/weather/location', null, {
        params: { 
          latitude, 
          longitude, 
          location_name: locationDisplayName 
        }
      });
      
      toast.success(`Weather location set to ${locationDisplayName}`);
      setLocationDialog(false);
      setLocationName('');
      
      // Refresh weather with new location
      await fetchWeather(latitude, longitude);
    } catch (err) {
      console.error('Manual location error:', err);
      if (err.response?.status === 404) {
        toast.error('Location not found. Try a different city name or ZIP code.');
      } else {
        toast.error('Failed to find location. Please check your entry and try again.');
      }
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
                  {weather.location && (
                    <p className="text-xs font-medium text-sky-600 dark:text-sky-400 flex items-center gap-1 mb-0.5">
                      <MapPin className="h-3 w-3" />
                      {weather.location.city && weather.location.region 
                        ? `${weather.location.city}, ${weather.location.region}`
                        : weather.location.name || 'Unknown Location'}
                    </p>
                  )}
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground">{current.temperature}°</span>
                    <span className="text-sm text-muted-foreground">F</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{current.description}</p>
                </div>
              </div>
              
              {/* Current Details */}
              <div className="flex flex-col gap-1 text-xs">
                {current.feels_like !== undefined && current.feels_like !== current.temperature && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Thermometer className="h-3.5 w-3.5 text-orange-500" />
                    <span>Feels {current.feels_like}°</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Droplets className="h-3.5 w-3.5 text-blue-500" />
                  <span>{current.humidity}%</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Wind className="h-3.5 w-3.5 text-slate-500" />
                  <span>{current.wind_direction} {current.wind_speed} mph</span>
                </div>
              </div>
            </div>

            {/* 3-Day Forecast */}
            <div className="flex-1 grid grid-cols-4 gap-2 sm:gap-3">
              {forecast.map((day, index) => {
                const isToday = index === 0;
                const radarUrl = isToday && weather.location 
                  ? `https://www.windy.com/?${weather.location.latitude},${weather.location.longitude},10,radar`
                  : null;
                
                return (
                  <div 
                    key={day.date} 
                    className={`text-center p-2 rounded-lg transition-all ${
                      isToday 
                        ? 'bg-sky-500/20 dark:bg-sky-500/10 cursor-pointer hover:bg-sky-500/30 dark:hover:bg-sky-500/20 hover:scale-105' 
                        : 'bg-white/50 dark:bg-slate-800/50'
                    }`}
                    onClick={() => {
                      if (isToday && radarUrl) {
                        window.open(radarUrl, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    title={isToday ? "Click to view live radar" : ""}
                    role={isToday ? "button" : undefined}
                  >
                    <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center justify-center gap-1">
                      {formatDayName(day.date, index)}
                      {isToday && (
                        <ExternalLink className="h-2.5 w-2.5 text-sky-500" />
                      )}
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
                    {isToday && (
                      <p className="text-[9px] text-sky-500 mt-1 font-medium">
                        Live Radar
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1 lg:ml-2">
              {/* Refresh Button */}
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => fetchWeather(undefined, undefined, true)}
                disabled={loading}
                data-testid="weather-refresh-btn"
                title="Refresh weather data"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              
              {/* Settings Button (Admin only) */}
              {isAdmin && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setLocationDialog(true)}
                  data-testid="weather-settings-btn"
                  title="Weather location settings"
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
              )}
            </div>
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
              Set the weather location for your department&apos;s Daily Worksheet.
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
                  placeholder="e.g., San Antonio, TX or 78205"
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
