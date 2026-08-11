import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Shield, Users, Calendar, BarChart3, Clock, Bell, ArrowRight, ChevronRight, Building2, LogOut, Settings } from 'lucide-react';
import TenantSwitcher from '../components/dev/TenantSwitcher';
import { clearManualSubdomain } from '../utils/tenantUtils';
import VideoIntro from '../components/VideoIntro';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Default BC Staffing branding (fallbacks)
const DEFAULT_LOGO = "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/1pvs2bmb_IMG_9603.png";
const DEFAULT_HERO_BACKGROUNDS = [
  "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/cr3ip2ql_IMG_9576.jpeg",
  "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/hqj9d35t_IMG_9577.jpeg",
  "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/3q4ymzj2_IMG_9578.jpeg",
  "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/0uf3omjc_IMG_9588.jpeg",
  "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/4iqph7i8_IMG_9582.jpeg"
];

export const LandingPage = () => {
  const { user, loading, isSuperAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [currentBgIndex, setCurrentBgIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [platformSettings, setPlatformSettings] = useState(null);
  const [showIntro, setShowIntro] = useState(() => {
    // Check if intro has been seen in this session
    return !sessionStorage.getItem('introSeen');
  });

  // Fetch platform settings
  useEffect(() => {
    const fetchPlatformSettings = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/platform/settings/public`);
        setPlatformSettings(response.data);
      } catch (error) {
        console.error('Failed to fetch platform settings:', error);
      }
    };
    fetchPlatformSettings();
  }, []);

  // Use platform settings or defaults
  const LOGO_URL = platformSettings?.logo_url || DEFAULT_LOGO;
  const HERO_BACKGROUNDS = platformSettings?.hero_backgrounds?.length > 0 
    ? platformSettings.hero_backgrounds 
    : DEFAULT_HERO_BACKGROUNDS;
  const heroTitle = platformSettings?.hero_title || 'BC STAFFING';
  const heroSubtitle = platformSettings?.hero_subtitle || 'Fire & EMS Staffing Solutions';
  const heroDescription = platformSettings?.hero_description || 
    'Integrated platform that facilitate staffing, overtime and deployment accountability and tracking, data collection for organizational analysis, sharing, and reporting — enhancing operational efficiency, personnel management, and emergency response.';
  const introVideoUrl = platformSettings?.intro_video_url || null;

  // Background image slideshow effect
  useEffect(() => {
    if (HERO_BACKGROUNDS.length === 0) return;
    
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentBgIndex((prev) => (prev + 1) % HERO_BACKGROUNDS.length);
        setIsTransitioning(false);
      }, 1000);
    }, 6000);

    return () => clearInterval(interval);
  }, [HERO_BACKGROUNDS.length]);

  // Clear tenant context when landing on this page (for fresh login)
  useEffect(() => {
    if (!user) {
      // Clear any previous tenant context so login shows generic BC Staffing
      clearManualSubdomain();
      // Also clear impersonation info
      localStorage.removeItem('impersonation_info');
    }
  }, [user]);

  // Redirect authenticated NON-super-admin users to dashboard
  // Super admins can stay on landing page to use tenant switcher
  useEffect(() => {
    if (!loading && user && !isSuperAdmin) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, isSuperAdmin, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    // Clear tenant context on logout
    clearManualSubdomain();
    localStorage.removeItem('impersonation_info');
    navigate('/');
  };

  const features = [
    {
      icon: <Users className="h-8 w-8" />,
      title: "Staffing Management",
      description: "Track personnel assignments, shifts, and station coverage with real-time updates."
    },
    {
      icon: <Clock className="h-8 w-8" />,
      title: "Overtime Tracking",
      description: "Manage overtime availability, assignments, and hours worked with automated notifications."
    },
    {
      icon: <Calendar className="h-8 w-8" />,
      title: "Deployment Accountability",
      description: "TIFMAS and EMTF deployment tracking with certification management and rotation schedules."
    },
    {
      icon: <BarChart3 className="h-8 w-8" />,
      title: "Reporting & Analytics",
      description: "Comprehensive reports for staffing, overtime, time-off, and organizational analysis."
    },
    {
      icon: <Shield className="h-8 w-8" />,
      title: "Role-Based Access",
      description: "Secure data isolation with granular permissions for Chiefs, Captains, Lieutenants, and Firefighters."
    },
    {
      icon: <Bell className="h-8 w-8" />,
      title: "Real-Time Notifications",
      description: "Instant SMS and email broadcasts for overtime requests and shift updates."
    }
  ];

  const serviceAreas = [
    "Fire Departments",
    "Emergency Medical Services (EMS)",
    "Government Agencies"
  ];

  return (
    <>
      {/* Video Intro - Shows only once per session and only if video is configured */}
      {showIntro && introVideoUrl && (
        <VideoIntro videoUrl={introVideoUrl} onComplete={() => setShowIntro(false)} />
      )}
      
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-24">
            {/* Logo and Brand - Clickable to go to landing page */}
            <a href="/" className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity cursor-pointer">
              <div className="w-10 h-10 sm:w-20 sm:h-20 flex-shrink-0">
                <img
                  src={LOGO_URL}
                  alt="BC Staffing"
                  className="w-full h-full object-contain rounded-lg"
                />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  BC STAFFING
                </h1>
                <p className="text-sm text-slate-400">Fire &amp; EMS Staffing Solutions</p>
              </div>
            </a>

            {/* Login/Logout Button */}
            {isSuperAdmin && user ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-sm text-slate-400 hidden lg:block">
                  Super Admin: <span className="text-white font-medium">{user.first_name} {user.last_name}</span>
                </span>
                <Button 
                  onClick={() => navigate('/platform-settings')}
                  variant="outline"
                  size="sm"
                  className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:border-slate-500 px-2 sm:px-4"
                  data-testid="header-platform-settings-btn"
                >
                  <Settings className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Settings</span>
                </Button>
                <Button 
                  onClick={handleLogout}
                  variant="outline"
                  size="sm"
                  className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:border-slate-500 px-2 sm:px-4"
                  data-testid="header-logout-btn"
                >
                  <LogOut className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 sm:gap-3">
                <Button 
                  onClick={() => navigate('/client-login')}
                  variant="outline"
                  size="sm"
                  className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:border-slate-500 font-medium px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-all duration-200"
                  data-testid="header-client-portal-btn"
                >
                  <Building2 className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Client Portal</span>
                </Button>
                <Button 
                  onClick={() => navigate('/login')}
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg transition-all duration-200 hover:scale-105 shadow-lg shadow-red-600/25"
                  data-testid="header-login-btn"
                >
                  <span className="hidden sm:inline">Staff Login</span>
                  <span className="sm:hidden">Login</span>
                  <ArrowRight className="ml-1 sm:ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Super Admin Tenant Selection Panel */}
      {isSuperAdmin && user && (
        <div className="fixed top-16 sm:top-24 left-0 right-0 z-40 bg-gradient-to-r from-purple-900/95 to-indigo-900/95 backdrop-blur-md border-b border-purple-500/30">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-purple-300" />
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-white">Super Admin Portal</h3>
                  <p className="text-xs sm:text-sm text-purple-300 hidden sm:block">Select a tenant to access their portal</p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <Button
                  onClick={() => navigate('/super-admin')}
                  variant="outline"
                  size="sm"
                  className="border-purple-400 text-purple-200 hover:bg-purple-800/50"
                  data-testid="super-admin-dashboard-btn"
                >
                  <Shield className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Admin Dashboard</span>
                  <span className="sm:hidden">Dashboard</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tenant Switcher for Super Admins */}
      {isSuperAdmin && user && <TenantSwitcher />}

      {/* Hero Section */}
      <section className={`relative ${isSuperAdmin && user ? 'pt-36 sm:pt-56' : 'pt-24 sm:pt-40'} pb-16 sm:pb-32 px-4 sm:px-6 lg:px-8 overflow-hidden`}>
        {/* Background Image Slideshow */}
        <div className="absolute inset-0 z-0">
          {HERO_BACKGROUNDS.map((bg, index) => (
            <div
              key={index}
              className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000 ease-in-out"
              style={{
                backgroundImage: `url(${bg})`,
                opacity: currentBgIndex === index && !isTransitioning ? 1 : 0,
              }}
              data-testid={`hero-bg-${index}`}
            />
          ))}
          {/* Dark overlay for text readability */}
          <div className="absolute inset-0 bg-slate-900/75 z-10"></div>
        </div>

        {/* Additional background decoration */}
        <div className="absolute inset-0 overflow-hidden z-10 pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-red-600/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto z-20">
          <div className="text-center">
            {/* Logo Badge */}
            <div className="inline-flex items-center justify-center mb-6 sm:mb-8">
              <div className="w-56 h-56 sm:w-80 sm:h-80 lg:w-96 lg:h-96 flex items-center justify-center">
                <img
                  src={LOGO_URL}
                  alt="BC Staffing Logo"
                  className="w-full h-full object-contain"
                  data-testid="hero-logo"
                />
              </div>
            </div>

            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4 sm:mb-6 leading-tight px-2">
              Data-Driven Solutions for
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
                Emergency Services
              </span>
            </h2>
            
            <p className="text-sm sm:text-lg lg:text-xl text-slate-300 max-w-3xl mx-auto mb-6 sm:mb-8 leading-relaxed px-2">
              {heroDescription}
            </p>

            {/* Service Areas Tags */}
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-8 sm:mb-10 px-2">
              {serviceAreas.map((area, index) => (
                <span 
                  key={index}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-slate-800/80 border border-slate-700 rounded-full text-xs sm:text-sm font-medium text-slate-300"
                >
                  {area}
                </span>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4">
              <Button 
                onClick={() => navigate('/client-login')}
                size="lg"
                className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-bold px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg rounded-xl transition-all duration-200 hover:scale-105 shadow-xl shadow-red-600/30"
                data-testid="hero-login-btn"
              >
                <Building2 className="mr-2 h-5 w-5" />
                Client Portal
              </Button>
              <Button 
                variant="outline"
                size="lg"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                className="w-full sm:w-auto border-2 border-slate-600 text-slate-300 hover:bg-slate-800 hover:border-slate-500 font-semibold px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg rounded-xl transition-all duration-200"
                data-testid="learn-more-btn"
              >
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 sm:py-32 px-4 sm:px-6 lg:px-8 bg-slate-800/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Comprehensive Platform Features
            </h3>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Everything you need to manage emergency services staffing, scheduling, and accountability.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="group bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 sm:p-8 hover:bg-slate-800 hover:border-slate-600 transition-all duration-300 hover:-translate-y-1"
                data-testid={`feature-card-${index}`}
              >
                <div className="w-14 h-14 bg-gradient-to-br from-red-600 to-orange-600 rounded-xl flex items-center justify-center text-white mb-5 group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h4 className="text-xl font-bold text-white mb-3">{feature.title}</h4>
                <p className="text-slate-400 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 sm:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-red-600/20 to-orange-600/20 border border-red-500/30 rounded-3xl p-8 sm:p-12 text-center">
            <h3 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              Ready to Streamline Your Operations?
            </h3>
            <p className="text-lg text-slate-300 mb-8 max-w-2xl mx-auto">
              Join fire departments and EMS agencies already using BC Staffing to enhance their operational efficiency.
            </p>
            <Button 
              onClick={() => navigate('/login')}
              size="lg"
              className="bg-white text-slate-900 hover:bg-slate-100 font-bold px-8 py-4 text-lg rounded-xl transition-all duration-200 hover:scale-105 shadow-xl"
              data-testid="cta-login-btn"
            >
              Login to Your Portal
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity cursor-pointer">
            <div className="w-10 h-10 sm:w-14 sm:h-14 flex-shrink-0">
              <img
                src={LOGO_URL}
                alt="BC Staffing"
                className="w-full h-full object-contain rounded-lg"
              />
            </div>
            <div>
              <span className="text-lg sm:text-xl font-bold text-white block tracking-tight">BC STAFFING</span>
              <span className="text-xs text-slate-400 hidden sm:block">Fire &amp; EMS Staffing Solutions</span>
            </div>
          </a>
          <p className="text-slate-500 text-xs sm:text-sm">
            &copy; {new Date().getFullYear()} BC Staffing. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
    </>
  );
};

export default LandingPage;
