import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Shield, Users, Calendar, BarChart3, Clock, Bell, ArrowRight, ChevronRight } from 'lucide-react';

// BC Staffing Logo URL (Medina County Fire/EMS badge)
const LOGO_URL = "https://customer-assets.emergentagent.com/job_d18b2c49-9504-43b5-8217-508d80db16bb/artifacts/toicx4yx_Logo-1.png";

export const LandingPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

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
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo and Brand */}
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0">
                <img
                  src={LOGO_URL}
                  alt="BC Staffing"
                  className="w-full h-full object-contain"
                  style={{ mixBlendMode: 'multiply', filter: 'brightness(1.1) contrast(1.05)' }}
                />
                {/* Fallback background removal overlay */}
                <div className="absolute inset-0 -z-10 bg-white rounded-lg"></div>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  BC STAFFING
                </h1>
                <p className="text-xs text-slate-400 hidden sm:block">Emergency Services Solutions</p>
              </div>
            </div>

            {/* Login Button */}
            <Button 
              onClick={() => navigate('/login')}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 sm:px-6 py-2 rounded-lg transition-all duration-200 hover:scale-105 shadow-lg shadow-red-600/25"
              data-testid="header-login-btn"
            >
              Login
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 sm:pt-40 pb-20 sm:pb-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-red-600/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto">
          <div className="text-center">
            {/* Logo Badge */}
            <div className="inline-flex items-center justify-center mb-8">
              <div className="relative w-28 h-28 sm:w-36 sm:h-36">
                <img
                  src={LOGO_URL}
                  alt="BC Staffing Logo"
                  className="w-full h-full object-contain drop-shadow-2xl"
                  style={{ mixBlendMode: 'multiply', filter: 'brightness(1.1) contrast(1.05)' }}
                  data-testid="hero-logo"
                />
                {/* White background container for mix-blend-mode to work */}
                <div className="absolute inset-0 -z-10 bg-white rounded-xl shadow-lg"></div>
              </div>
            </div>

            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-6 leading-tight">
              Data-Driven Solutions for
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
                Emergency Services
              </span>
            </h2>
            
            <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto mb-8 leading-relaxed">
              Integrated products that facilitate staffing, overtime and deployment accountability and tracking, 
              data collection for organizational analysis, sharing, and reporting — enhancing operational efficiency, 
              personnel management, and emergency response.
            </p>

            {/* Service Areas Tags */}
            <div className="flex flex-wrap justify-center gap-3 mb-10">
              {serviceAreas.map((area, index) => (
                <span 
                  key={index}
                  className="px-4 py-2 bg-slate-800/80 border border-slate-700 rounded-full text-sm font-medium text-slate-300"
                >
                  {area}
                </span>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button 
                onClick={() => navigate('/login')}
                size="lg"
                className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-4 text-lg rounded-xl transition-all duration-200 hover:scale-105 shadow-xl shadow-red-600/30"
                data-testid="hero-login-btn"
              >
                Access Your Portal
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                variant="outline"
                size="lg"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                className="w-full sm:w-auto border-2 border-slate-600 text-slate-300 hover:bg-slate-800 hover:border-slate-500 font-semibold px-8 py-4 text-lg rounded-xl transition-all duration-200"
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
      <footer className="border-t border-slate-800 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10">
              <img
                src={LOGO_URL}
                alt="BC Staffing"
                className="w-full h-full object-contain"
                style={{ mixBlendMode: 'multiply', filter: 'brightness(1.1) contrast(1.05)' }}
              />
              <div className="absolute inset-0 -z-10 bg-white rounded-lg"></div>
            </div>
            <span className="text-lg font-bold text-white">BC STAFFING</span>
          </div>
          <p className="text-slate-500 text-sm">
            &copy; {new Date().getFullYear()} BC Staffing. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
