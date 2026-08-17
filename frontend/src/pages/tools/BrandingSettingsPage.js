import { useState, useEffect, useRef } from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { 
  Palette, 
  Upload, 
  RotateCcw, 
  Save, 
  Image as ImageIcon, 
  Trash2,
  Eye,
  CheckCircle2
} from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { TimezoneSettings } from '../../components/settings/TimezoneSettings';
import { LeaveYearSettings } from '../../components/settings/LeaveYearSettings';

export const BrandingSettingsPage = () => {
  const { api, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [branding, setBranding] = useState({
    custom_branding: false,
    logo_url: null,
    login_background_url: null,
    primary_color: '#dc2626',
    secondary_color: '#1e3a5f',
    accent_color: '#f59e0b',
    tenant_name: 'BC Staffing'
  });
  const [previewLogo, setPreviewLogo] = useState(null);
  const [previewBackground, setPreviewBackground] = useState(null);
  const fileInputRef = useRef(null);
  const backgroundInputRef = useRef(null);

  useEffect(() => {
    fetchBranding();
  }, []);

  const fetchBranding = async () => {
    try {
      const response = await api.get('/tenants/branding');
      setBranding(response.data);
      setPreviewLogo(response.data.logo_url);
      setPreviewBackground(response.data.login_background_url);
    } catch (error) {
      console.error('Failed to fetch branding:', error);
      toast.error('Failed to load branding settings');
    } finally {
      setLoading(false);
    }
  };

  const handleColorChange = (colorType, value) => {
    setBranding(prev => ({
      ...prev,
      [colorType]: value,
      custom_branding: true
    }));
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please select a valid image file (PNG, JPG, SVG, or WebP)');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result;
      setPreviewLogo(base64);
      setBranding(prev => ({
        ...prev,
        logo_url: base64,
        custom_branding: true
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleBackgroundFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Max 5MB for backgrounds
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    // Read and convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewBackground(reader.result);
      setBranding(prev => ({
        ...prev,
        login_background_url: reader.result,
        custom_branding: true
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setPreviewLogo(null);
    setBranding(prev => ({
      ...prev,
      logo_url: null
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveBackground = () => {
    setPreviewBackground(null);
    setBranding(prev => ({
      ...prev,
      login_background_url: null
    }));
    if (backgroundInputRef.current) {
      backgroundInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/tenants/branding', {
        logo_url: branding.logo_url,
        login_background_url: branding.login_background_url,
        primary_color: branding.primary_color,
        secondary_color: branding.secondary_color,
        accent_color: branding.accent_color,
        custom_branding: true
      });
      toast.success('Branding updated successfully! Refresh to see changes.');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save branding');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset all branding to defaults?')) return;
    
    setSaving(true);
    try {
      await api.post('/tenants/branding/reset');
      await fetchBranding();
      setPreviewLogo(null);
      setPreviewBackground(null);
      toast.success('Branding reset to defaults');
    } catch (error) {
      toast.error('Failed to reset branding');
    } finally {
      setSaving(false);
    }
  };

  // Color presets for quick selection
  const colorPresets = {
    fire_red: { primary: '#dc2626', secondary: '#1e3a5f', accent: '#f59e0b', name: 'Fire Red' },
    navy_blue: { primary: '#1e40af', secondary: '#0f172a', accent: '#3b82f6', name: 'Navy Blue' },
    forest_green: { primary: '#166534', secondary: '#14532d', accent: '#22c55e', name: 'Forest Green' },
    royal_purple: { primary: '#7c3aed', secondary: '#4c1d95', accent: '#a78bfa', name: 'Royal Purple' },
    slate_gray: { primary: '#475569', secondary: '#1e293b', accent: '#94a3b8', name: 'Slate Gray' },
    sunset_orange: { primary: '#ea580c', secondary: '#7c2d12', accent: '#fb923c', name: 'Sunset Orange' }
  };

  const applyPreset = (preset) => {
    setBranding(prev => ({
      ...prev,
      primary_color: preset.primary,
      secondary_color: preset.secondary,
      accent_color: preset.accent,
      custom_branding: true
    }));
    toast.success(`Applied "${preset.name}" color scheme`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-heading uppercase tracking-wide">Branding Settings</h1>
          <p className="text-muted-foreground mt-2">
            Customize the look and feel of your department&apos;s BC Staffing portal
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Logo Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Department Logo
              </CardTitle>
              <CardDescription>
                Upload your department&apos;s logo (recommended: 200x200px)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Logo Preview */}
              <div className="flex justify-center">
                <div 
                  className="w-40 h-40 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center overflow-hidden bg-muted/50"
                  style={{ backgroundColor: branding.secondary_color + '20' }}
                >
                  {previewLogo ? (
                    <img 
                      src={previewLogo} 
                      alt="Logo preview" 
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">No logo uploaded</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Upload Button */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="logo-file-input"
              />
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="upload-logo-btn"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Logo
                </Button>
                {previewLogo && (
                  <Button 
                    variant="outline" 
                    className="text-red-500"
                    onClick={handleRemoveLogo}
                    data-testid="remove-logo-btn"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Supported formats: PNG, JPG, SVG, WebP (max 2MB)
              </p>
            </CardContent>
          </Card>

          {/* Login Background Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Login Background
              </CardTitle>
              <CardDescription>
                Upload a custom background image for your login page
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Background Preview */}
              <div className="flex justify-center">
                <div 
                  className="w-full h-32 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center overflow-hidden bg-muted/50"
                  style={{ 
                    backgroundImage: previewBackground ? `url(${previewBackground})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                >
                  {!previewBackground && (
                    <div className="text-center text-muted-foreground">
                      <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">No background uploaded</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Upload Button */}
              <input
                ref={backgroundInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleBackgroundFile}
                className="hidden"
                data-testid="background-file-input"
              />
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => backgroundInputRef.current?.click()}
                  data-testid="upload-background-btn"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Background
                </Button>
                {previewBackground && (
                  <Button 
                    variant="outline" 
                    className="text-red-500"
                    onClick={handleRemoveBackground}
                    data-testid="remove-background-btn"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Recommended: High resolution image (1920x1080 or larger, max 5MB)
              </p>
            </CardContent>
          </Card>

          {/* Color Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Color Scheme
              </CardTitle>
              <CardDescription>
                Choose your department&apos;s brand colors
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Primary Color */}
              <div className="space-y-2">
                <Label>Primary Color</Label>
                <div className="flex gap-2">
                  <div 
                    className="w-10 h-10 rounded-lg border cursor-pointer"
                    style={{ backgroundColor: branding.primary_color }}
                    onClick={() => document.getElementById('primary-color-input')?.click()}
                  />
                  <Input
                    id="primary-color-input"
                    type="color"
                    value={branding.primary_color}
                    onChange={(e) => handleColorChange('primary_color', e.target.value)}
                    className="w-20 h-10 p-1 cursor-pointer"
                    data-testid="primary-color-input"
                  />
                  <Input
                    type="text"
                    value={branding.primary_color}
                    onChange={(e) => handleColorChange('primary_color', e.target.value)}
                    className="flex-1 font-mono uppercase"
                    placeholder="#dc2626"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Used for buttons, links, and highlights</p>
              </div>

              {/* Secondary Color */}
              <div className="space-y-2">
                <Label>Secondary Color</Label>
                <div className="flex gap-2">
                  <div 
                    className="w-10 h-10 rounded-lg border cursor-pointer"
                    style={{ backgroundColor: branding.secondary_color }}
                  />
                  <Input
                    type="color"
                    value={branding.secondary_color}
                    onChange={(e) => handleColorChange('secondary_color', e.target.value)}
                    className="w-20 h-10 p-1 cursor-pointer"
                    data-testid="secondary-color-input"
                  />
                  <Input
                    type="text"
                    value={branding.secondary_color}
                    onChange={(e) => handleColorChange('secondary_color', e.target.value)}
                    className="flex-1 font-mono uppercase"
                    placeholder="#1e3a5f"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Used for headers and backgrounds</p>
              </div>

              {/* Accent Color */}
              <div className="space-y-2">
                <Label>Accent Color</Label>
                <div className="flex gap-2">
                  <div 
                    className="w-10 h-10 rounded-lg border cursor-pointer"
                    style={{ backgroundColor: branding.accent_color }}
                  />
                  <Input
                    type="color"
                    value={branding.accent_color}
                    onChange={(e) => handleColorChange('accent_color', e.target.value)}
                    className="w-20 h-10 p-1 cursor-pointer"
                    data-testid="accent-color-input"
                  />
                  <Input
                    type="text"
                    value={branding.accent_color}
                    onChange={(e) => handleColorChange('accent_color', e.target.value)}
                    className="flex-1 font-mono uppercase"
                    placeholder="#f59e0b"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Used for badges and alerts</p>
              </div>
            </CardContent>
          </Card>

          {/* Color Presets */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Quick Presets
              </CardTitle>
              <CardDescription>
                Choose from pre-designed color schemes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(colorPresets).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => applyPreset(preset)}
                  className="w-full p-3 rounded-lg border hover:border-primary transition-colors flex items-center gap-3"
                  data-testid={`preset-${key}`}
                >
                  <div className="flex gap-1">
                    <div 
                      className="w-6 h-6 rounded-full border"
                      style={{ backgroundColor: preset.primary }}
                    />
                    <div 
                      className="w-6 h-6 rounded-full border"
                      style={{ backgroundColor: preset.secondary }}
                    />
                    <div 
                      className="w-6 h-6 rounded-full border"
                      style={{ backgroundColor: preset.accent }}
                    />
                  </div>
                  <span className="text-sm font-medium">{preset.name}</span>
                  {branding.primary_color === preset.primary && 
                   branding.secondary_color === preset.secondary && 
                   branding.accent_color === preset.accent && (
                    <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
                  )}
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Preview Section */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Live Preview
            </CardTitle>
            <CardDescription>
              See how your branding will look across the application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div 
              className="rounded-lg p-6 space-y-4"
              style={{ backgroundColor: branding.secondary_color }}
            >
              {/* Preview Navbar */}
              <div className="flex items-center gap-4 p-4 rounded-lg bg-black/20">
                {previewLogo ? (
                  <img src={previewLogo} alt="Logo" className="h-10 w-auto" />
                ) : (
                  <div className="w-10 h-10 rounded bg-white/20 flex items-center justify-center">
                    <ImageIcon className="h-6 w-6 text-white/60" />
                  </div>
                )}
                <span className="text-white font-heading uppercase tracking-wide">
                  {branding.tenant_name}
                </span>
              </div>

              {/* Preview Content */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white/10 rounded-lg p-4">
                  <h3 className="text-white font-medium mb-2">Primary Button</h3>
                  <button 
                    className="px-4 py-2 rounded-lg text-white font-medium"
                    style={{ backgroundColor: branding.primary_color }}
                  >
                    Click Me
                  </button>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <h3 className="text-white font-medium mb-2">Accent Badge</h3>
                  <Badge style={{ backgroundColor: branding.accent_color, color: '#000' }}>
                    New Feature
                  </Badge>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <h3 className="text-white font-medium mb-2">Link Style</h3>
                  <a 
                    href="#" 
                    className="underline"
                    style={{ color: branding.primary_color }}
                    onClick={(e) => e.preventDefault()}
                  >
                    Sample Link
                  </a>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 mt-6">
          <Button 
            variant="outline" 
            onClick={handleReset}
            disabled={saving}
            data-testid="reset-branding-btn"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button 
            onClick={handleSave}
            disabled={saving}
            data-testid="save-branding-btn"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>

        {/* Timezone Settings Section */}
        <div className="mt-8">
          <TimezoneSettings />
        </div>

        {/* Leave Year Settings Section */}
        <div className="mt-8">
          <LeaveYearSettings />
        </div>
      </main>
    </div>
  );
};

export default BrandingSettingsPage;
