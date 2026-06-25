import { useState } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useSettings } from '../contexts/SettingsContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { toast } from 'sonner';
import { Settings, Bell, RotateCcw, Wifi, WifiOff, Volume2, VolumeX } from 'lucide-react';

export const SettingsPage = () => {
  const { settings, updateSetting, resetSettings } = useSettings();
  const { isConnected } = useWebSocket();

  const handleToggleToasts = (checked) => {
    updateSetting('showRealtimeToasts', checked);
    toast.success(checked ? 'Real-time notifications enabled' : 'Real-time notifications disabled');
  };

  const handleDurationChange = (value) => {
    updateSetting('toastDuration', parseInt(value));
    toast.success('Notification duration updated');
  };

  const handleToggleSound = (checked) => {
    updateSetting('soundEnabled', checked);
    if (checked) {
      // Play a test sound when enabling
      playNotificationSound();
      toast.success('Sound notifications enabled');
    } else {
      toast.success('Sound notifications disabled');
    }
  };

  // Function to play notification sound
  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      console.log('Audio not supported');
    }
  };

  const handleReset = () => {
    resetSettings();
    toast.success('Settings reset to defaults');
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Customize your notification preferences</p>
          </div>
        </div>

        <div className="max-w-2xl space-y-6">
          {/* Real-time Notifications Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Real-time Notifications
              </CardTitle>
              <CardDescription>
                Control how you receive updates when other users make changes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Toggle for showing toasts */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="toast-toggle" className="text-base">Show Toast Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Display popup notifications when staffing changes are made by other users
                  </p>
                </div>
                <Switch
                  id="toast-toggle"
                  checked={settings.showRealtimeToasts}
                  onCheckedChange={handleToggleToasts}
                />
              </div>

              {/* Duration selector */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Notification Duration</Label>
                  <p className="text-sm text-muted-foreground">
                    How long notifications stay visible on screen
                  </p>
                </div>
                <Select 
                  value={String(settings.toastDuration)} 
                  onValueChange={handleDurationChange}
                  disabled={!settings.showRealtimeToasts}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3000">3 seconds</SelectItem>
                    <SelectItem value="5000">5 seconds</SelectItem>
                    <SelectItem value="8000">8 seconds</SelectItem>
                    <SelectItem value="10000">10 seconds</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sound toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="sound-toggle" className="text-base flex items-center gap-2">
                    {settings.soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                    Sound Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Play an audio alert when notifications arrive
                  </p>
                </div>
                <Switch
                  id="sound-toggle"
                  checked={settings.soundEnabled}
                  onCheckedChange={handleToggleSound}
                  disabled={!settings.showRealtimeToasts}
                />
              </div>
            </CardContent>
          </Card>

          {/* Connection Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isConnected ? <Wifi className="h-5 w-5 text-green-500" /> : <WifiOff className="h-5 w-5 text-yellow-500" />}
                Connection Status
              </CardTitle>
              <CardDescription>
                Real-time connection information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></div>
                <span className="text-sm">
                  {isConnected ? 'Connected - Live updates active' : 'Connecting... Attempting to establish connection'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {isConnected 
                  ? 'Your browser maintains a persistent connection to receive instant updates. If disconnected, it will automatically reconnect.'
                  : 'The system will automatically attempt to reconnect. Real-time updates may be delayed until connected.'}
              </p>
            </CardContent>
          </Card>

          {/* Reset Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5" />
                Reset Settings
              </CardTitle>
              <CardDescription>
                Restore all settings to their default values
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={handleReset}>
                Reset to Defaults
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default SettingsPage;
