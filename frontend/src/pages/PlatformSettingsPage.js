import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { 
  ArrowLeft, Save, Upload, Trash2, Image as ImageIcon, Palette, 
  Layout, RotateCcw, Plus, GripVertical, Loader2, Video, Play
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Default BC Staffing branding
const DEFAULT_SETTINGS = {
  logo_url: "https://customer-assets.emergentagent.com/job_d18b2c49-9504-43b5-8217-508d80db16bb/artifacts/toicx4yx_Logo-1.png",
  login_background_url: "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/47tmgavx_IMG_9619.jpeg",
  intro_video_url: null,
  intro_video_sound: false,
  primary_color: "#dc2626",
  secondary_color: "#1e3a5f",
  accent_color: "#f59e0b",
  hero_backgrounds: [
    "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/cr3ip2ql_IMG_9576.jpeg",
    "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/hqj9d35t_IMG_9577.jpeg",
    "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/3q4ymzj2_IMG_9578.jpeg",
    "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/0uf3omjc_IMG_9588.jpeg",
    "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/4iqph7i8_IMG_9582.jpeg"
  ],
  hero_title: "BC STAFFING",
  hero_subtitle: "Fire & EMS Staffing Solutions",
  hero_description: "Integrated platform that facilitate staffing, overtime and deployment accountability and tracking, data collection for organizational analysis, sharing, and reporting — enhancing operational efficiency, personnel management, and emergency response."
};

export const PlatformSettingsPage = () => {
  const { user, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState('branding');
  
  const logoInputRef = useRef(null);
  const loginBgInputRef = useRef(null);
  const heroImageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  // Redirect non-super-admins
  useEffect(() => {
    if (user && !isSuperAdmin) {
      navigate('/dashboard');
      toast.error('Access denied - Super Admin only');
    }
  }, [user, isSuperAdmin, navigate]);

  // Fetch platform settings
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/platform/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data) {
        setSettings({ ...DEFAULT_SETTINGS, ...response.data });
      }
    } catch (error) {
      console.error('Failed to fetch platform settings:', error);
      // Use defaults if no settings exist
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/api/platform/settings`, settings, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Platform settings saved! Refresh to see changes.');
    } catch (error) {
      toast.error('Failed to save settings');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Reset all settings to defaults?')) {
      setSettings(DEFAULT_SETTINGS);
      toast.success('Settings reset to defaults');
    }
  };

  const handleFileUpload = (e, field) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    const maxSize = field === 'login_background_url' ? 5 : 2;
    if (file.size > maxSize * 1024 * 1024) {
      toast.error(`File size must be less than ${maxSize}MB`);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSettings(prev => ({ ...prev, [field]: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleHeroImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSettings(prev => ({
        ...prev,
        hero_backgrounds: [...(prev.hero_backgrounds || []), reader.result]
      }));
    };
    reader.readAsDataURL(file);
  };

  const removeHeroImage = (index) => {
    setSettings(prev => ({
      ...prev,
      hero_backgrounds: prev.hero_backgrounds.filter((_, i) => i !== index)
    }));
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please select a video file (MP4, WebM, OGG, or MOV)');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error('Video file must be less than 50MB');
      return;
    }

    setUploadingVideo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/api/platform/upload-video`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setSettings(prev => ({ ...prev, intro_video_url: response.data.video_url }));
      toast.success('Intro video uploaded successfully');
    } catch (error) {
      console.error('Failed to upload video:', error);
      toast.error('Failed to upload video');
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleRemoveVideo = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/platform/video`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSettings(prev => ({ ...prev, intro_video_url: null }));
      toast.success('Intro video removed');
    } catch (error) {
      console.error('Failed to remove video:', error);
      toast.error('Failed to remove video');
    }
  };

  const handleColorChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  if (!user || !isSuperAdmin) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/login')}
                className="text-slate-400 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Login
              </Button>
              <h1 className="text-xl font-bold text-white">Platform Settings</h1>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleReset}
                className="border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Defaults
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-slate-800/50 border border-slate-700">
            <TabsTrigger value="branding" className="data-[state=active]:bg-red-600">
              <Palette className="h-4 w-4 mr-2" />
              Logos & Colors
            </TabsTrigger>
            <TabsTrigger value="video" className="data-[state=active]:bg-red-600">
              <Video className="h-4 w-4 mr-2" />
              Intro Video
            </TabsTrigger>
            <TabsTrigger value="hero" className="data-[state=active]:bg-red-600">
              <ImageIcon className="h-4 w-4 mr-2" />
              Hero Slideshow
            </TabsTrigger>
            <TabsTrigger value="login" className="data-[state=active]:bg-red-600">
              <Layout className="h-4 w-4 mr-2" />
              Login Background
            </TabsTrigger>
            <TabsTrigger value="content" className="data-[state=active]:bg-red-600">
              <Layout className="h-4 w-4 mr-2" />
              Content & Text
            </TabsTrigger>
          </TabsList>

          {/* Logos & Colors Tab */}
          <TabsContent value="branding" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Logo Upload */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    Platform Logo
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Main BC Staffing logo (transparent PNG recommended)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-center">
                    <div className="w-40 h-40 rounded-lg border-2 border-dashed border-slate-600 flex items-center justify-center overflow-hidden bg-slate-900/50">
                      {settings.logo_url ? (
                        <img 
                          src={settings.logo_url} 
                          alt="Logo" 
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <ImageIcon className="h-12 w-12 text-slate-600" />
                      )}
                    </div>
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'logo_url')}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    className="w-full border-slate-600 text-slate-300"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Logo
                  </Button>
                </CardContent>
              </Card>

              {/* Color Settings */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Color Scheme
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Customize the platform colors
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-lg border border-slate-600"
                        style={{ backgroundColor: settings.primary_color }}
                      />
                      <div className="flex-1">
                        <Label className="text-slate-300">Primary Color</Label>
                        <Input
                          type="color"
                          value={settings.primary_color}
                          onChange={(e) => handleColorChange('primary_color', e.target.value)}
                          className="h-8 w-full bg-slate-700 border-slate-600"
                        />
                      </div>
                      <Input
                        value={settings.primary_color}
                        onChange={(e) => handleColorChange('primary_color', e.target.value)}
                        className="w-24 bg-slate-700 border-slate-600 text-white text-sm"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-lg border border-slate-600"
                        style={{ backgroundColor: settings.secondary_color }}
                      />
                      <div className="flex-1">
                        <Label className="text-slate-300">Secondary Color</Label>
                        <Input
                          type="color"
                          value={settings.secondary_color}
                          onChange={(e) => handleColorChange('secondary_color', e.target.value)}
                          className="h-8 w-full bg-slate-700 border-slate-600"
                        />
                      </div>
                      <Input
                        value={settings.secondary_color}
                        onChange={(e) => handleColorChange('secondary_color', e.target.value)}
                        className="w-24 bg-slate-700 border-slate-600 text-white text-sm"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-lg border border-slate-600"
                        style={{ backgroundColor: settings.accent_color }}
                      />
                      <div className="flex-1">
                        <Label className="text-slate-300">Accent Color</Label>
                        <Input
                          type="color"
                          value={settings.accent_color}
                          onChange={(e) => handleColorChange('accent_color', e.target.value)}
                          className="h-8 w-full bg-slate-700 border-slate-600"
                        />
                      </div>
                      <Input
                        value={settings.accent_color}
                        onChange={(e) => handleColorChange('accent_color', e.target.value)}
                        className="w-24 bg-slate-700 border-slate-600 text-white text-sm"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Intro Video Tab */}
          <TabsContent value="video" className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Video className="h-5 w-5" />
                  Landing Page Intro Video
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Upload a short intro video that plays when visitors first arrive at the landing page.
                  The video auto-plays (muted) for 5-6 seconds before the main page appears.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Current Video Preview */}
                {settings.intro_video_url ? (
                  <div className="space-y-4">
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-black border border-slate-600">
                      <video 
                        src={settings.intro_video_url.startsWith('http') ? settings.intro_video_url : `${API_URL}${settings.intro_video_url}`}
                        className="w-full h-full object-cover"
                        controls
                        muted
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <div className="flex items-center gap-2 text-green-400">
                        <Play className="h-4 w-4" />
                        <span className="text-sm font-medium">Intro video is active</span>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleRemoveVideo}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove Video
                      </Button>
                    </div>
                    
                    {/* Sound Settings */}
                    <div className="p-4 bg-slate-700/50 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <label className="text-sm font-medium text-white">Enable Sound Prompt</label>
                          <p className="text-xs text-slate-400">
                            Show a prompt encouraging visitors to unmute the video
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.intro_video_sound || false}
                            onChange={(e) => setSettings({ ...settings, intro_video_sound: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-red-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                        </label>
                      </div>
                      <p className="text-xs text-slate-500">
                        Note: Browsers require videos to start muted for autoplay. When enabled, visitors will see an &quot;Unmute&quot; button and a brief prompt to enable sound.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 border-2 border-dashed border-slate-600 rounded-lg">
                    <Video className="h-12 w-12 mx-auto text-slate-500 mb-4" />
                    <p className="text-slate-400 mb-4">No intro video uploaded</p>
                    <p className="text-sm text-slate-500 mb-4">
                      Upload a video file (MP4, WebM, OGG, or MOV) up to 50MB
                    </p>
                  </div>
                )}

                {/* Upload Button */}
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/ogg,video/quicktime"
                  onChange={handleVideoUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={uploadingVideo}
                  className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  {uploadingVideo ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading Video...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      {settings.intro_video_url ? 'Replace Video' : 'Upload Video'}
                    </>
                  )}
                </Button>

                {/* Tips */}
                <div className="p-4 bg-slate-700/50 rounded-lg">
                  <h4 className="text-sm font-medium text-white mb-2">Video Tips:</h4>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>• Keep videos short (5-10 seconds recommended)</li>
                    <li>• MP4 format with H.264 encoding works best</li>
                    <li>• Videos start muted (browser autoplay policy)</li>
                    <li>• Visitors can tap &quot;Unmute&quot; to enable sound</li>
                    <li>• Skip button appears after 1 second</li>
                    <li>• Video replays on each visit/refresh</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Hero Slideshow Tab */}
          <TabsContent value="hero" className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Hero Background Slideshow
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Manage the rotating background images on the landing page hero section
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {settings.hero_backgrounds?.map((img, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-video rounded-lg overflow-hidden border-2 border-slate-600 bg-slate-900">
                        <img 
                          src={img} 
                          alt={`Hero ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="absolute top-1 left-1 bg-black/70 px-2 py-0.5 rounded text-xs text-white">
                        {index + 1}
                      </div>
                      <button
                        onClick={() => removeHeroImage(index)}
                        className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  ))}
                  
                  {/* Add New Image */}
                  <div 
                    onClick={() => heroImageInputRef.current?.click()}
                    className="aspect-video rounded-lg border-2 border-dashed border-slate-600 bg-slate-900/50 flex flex-col items-center justify-center cursor-pointer hover:border-slate-500 transition-colors"
                  >
                    <Plus className="h-8 w-8 text-slate-500" />
                    <span className="text-xs text-slate-500 mt-1">Add Image</span>
                  </div>
                </div>
                
                <input
                  ref={heroImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleHeroImageUpload}
                  className="hidden"
                />
                
                <p className="text-xs text-slate-500">
                  Recommended: High resolution images (1920x1080 or larger). Images will auto-rotate every 6 seconds.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Login Background Tab */}
          <TabsContent value="login" className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Layout className="h-5 w-5" />
                  Staff Login Background
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Background image for the BC Staffing staff login page
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-center">
                  <div 
                    className="w-full max-w-lg aspect-video rounded-lg border-2 border-dashed border-slate-600 flex items-center justify-center overflow-hidden bg-slate-900/50"
                    style={{ 
                      backgroundImage: settings.login_background_url ? `url(${settings.login_background_url})` : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                  >
                    {!settings.login_background_url && (
                      <div className="text-center text-slate-500">
                        <ImageIcon className="h-12 w-12 mx-auto mb-2" />
                        <p className="text-sm">No background set</p>
                      </div>
                    )}
                  </div>
                </div>
                
                <input
                  ref={loginBgInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'login_background_url')}
                  className="hidden"
                />
                
                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    className="border-slate-600 text-slate-300"
                    onClick={() => loginBgInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Background
                  </Button>
                  {settings.login_background_url && (
                    <Button
                      variant="outline"
                      className="border-red-600 text-red-400 hover:bg-red-600/20"
                      onClick={() => setSettings(prev => ({ ...prev, login_background_url: '' }))}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  )}
                </div>
                
                <p className="text-xs text-slate-500 text-center">
                  Recommended: High resolution image (1920x1080 or larger, max 5MB)
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Content & Text Tab */}
          <TabsContent value="content" className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Layout className="h-5 w-5" />
                  Landing Page Content
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Customize the text displayed on the landing page
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Hero Title</Label>
                  <Input
                    value={settings.hero_title}
                    onChange={(e) => setSettings(prev => ({ ...prev, hero_title: e.target.value }))}
                    className="bg-slate-700 border-slate-600 text-white"
                    placeholder="BC STAFFING"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-slate-300">Hero Subtitle</Label>
                  <Input
                    value={settings.hero_subtitle}
                    onChange={(e) => setSettings(prev => ({ ...prev, hero_subtitle: e.target.value }))}
                    className="bg-slate-700 border-slate-600 text-white"
                    placeholder="Fire & EMS Staffing Solutions"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-slate-300">Hero Description</Label>
                  <textarea
                    value={settings.hero_description}
                    onChange={(e) => setSettings(prev => ({ ...prev, hero_description: e.target.value }))}
                    className="w-full h-32 bg-slate-700 border border-slate-600 text-white rounded-md p-3 text-sm"
                    placeholder="Enter the main description text..."
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default PlatformSettingsPage;
