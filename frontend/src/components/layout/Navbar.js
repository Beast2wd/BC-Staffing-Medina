import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useBranding } from '../../context/BrandingContext';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '../ui/dropdown-menu';
import { 
  ChevronDown, 
  LogOut, 
  Sun, 
  Moon, 
  ClipboardList,
  Users,
  Settings,
  FileText,
  Truck,
  Calendar,
  Clock,
  Plane,
  AlertCircle,
  Hand,
  Key,
  UserPlus,
  Flame,
  Ambulance,
  ChevronRight,
  History,
  Shield,
  Palette,
  TrendingUp,
  Mic
} from 'lucide-react';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';
import { NotificationBell } from './NotificationBell';

// Default logo fallback
const DEFAULT_LOGO = "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/agzarcqg_IMG_0147.webp";

// NavLink component defined outside to prevent re-renders
const NavLink = ({ to, children, active, disabled, primaryColor }) => (
  <Link
    to={disabled ? '#' : to}
    className={`px-3 py-2 font-heading text-sm uppercase tracking-wider transition-colors whitespace-nowrap ${
      active 
        ? 'border-b-2' 
        : disabled
          ? 'text-muted-foreground/50 cursor-not-allowed'
          : 'text-foreground/80 hover:opacity-80'
    }`}
    style={active ? { color: primaryColor || '#dc2626', borderColor: primaryColor || '#dc2626' } : {}}
    onClick={(e) => disabled && e.preventDefault()}
    data-testid={`nav-link-${to.replace('/', '') || 'home'}`}
  >
    {children}
  </Link>
);

export const Navbar = () => {
  const { user, logout, isAdmin, isFirefighter, isVolunteer, isPartTime, isEngineer, isViewOnly, isSuperAdmin, tenant } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { logoUrl: brandingLogo, tenantName, primaryColor } = useBranding();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // Use tenant logo if available, otherwise branding logo, otherwise default
  const logoUrl = tenant?.settings?.logo_url || brandingLogo || DEFAULT_LOGO;
  const displayTenantName = tenant?.name || tenantName || 'BC Staffing';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  // Check if user can view/access full menu (not view-only users like firefighters, volunteers, part-time, engineers)
  const canAccessFullMenu = !isViewOnly;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link to="/dashboard" className="flex items-center gap-3" data-testid="navbar-logo">
          <img src={logoUrl} alt="Logo" className="h-12 w-auto" />
          <div className="hidden sm:block">
            <h1 className="font-heading text-xl uppercase tracking-wider font-bold text-foreground">
              BC Staffing
            </h1>
            <p className="text-xs text-muted-foreground">{displayTenantName !== 'BC Staffing' ? displayTenantName : 'Fire & EMS Solutions'}</p>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-2">
          {/* Daily Worksheet - Available to all users (view-only for firefighters, volunteers, part-time, engineers) */}
          <NavLink to="/dashboard" active={isActive('/dashboard')} primaryColor={primaryColor}>
            Daily Worksheet {isViewOnly && <span className="text-xs ml-1">(View)</span>}
          </NavLink>

          {/* On Duty - Available to ALL users */}
          <NavLink to="/on-duty" active={isActive('/on-duty')} primaryColor={primaryColor}>
            On Duty
          </NavLink>

          {/* Battalion Chief Dropdown */}
          {canAccessFullMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="font-heading text-sm uppercase tracking-wider gap-1"
                  data-testid="battalion-chief-dropdown"
                >
                  Battalion Chief <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem asChild>
                  <Link to="/battalion-chief/apparatus" className="flex items-center gap-2" data-testid="nav-apparatus">
                    <Truck className="h-4 w-4" /> Apparatus Assignments
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/battalion-chief/sick" className="flex items-center gap-2" data-testid="nav-sick">
                    <AlertCircle className="h-4 w-4" /> Sick
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/battalion-chief/vacation" className="flex items-center gap-2" data-testid="nav-vacation">
                    <Calendar className="h-4 w-4" /> Vacation
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/battalion-chief/holiday" className="flex items-center gap-2" data-testid="nav-holiday">
                    <Calendar className="h-4 w-4" /> Holiday
                  </Link>
                </DropdownMenuItem>
                {/* Deployments Submenu - moved from Personnel */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="flex items-center gap-2">
                    <Plane className="h-4 w-4" /> Deployments
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent className="w-48">
                      <DropdownMenuItem asChild>
                        <Link to="/personnel/deployment-tracker/roster" className="flex items-center gap-2" data-testid="nav-deploy-roster">
                          <Users className="h-4 w-4" /> TIFMAS & EMTF Roster
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/personnel/deployment-tracker/tifmas-rank" className="flex items-center gap-2" data-testid="nav-tifmas-rank">
                          <Flame className="h-4 w-4 text-orange-500" /> TIFMAS
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/personnel/deployment-tracker/emtf-rank" className="flex items-center gap-2" data-testid="nav-emtf-rank">
                          <Ambulance className="h-4 w-4 text-blue-500" /> EMTF
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/personnel/deployment-tracker/tifmas-log" className="flex items-center gap-2" data-testid="nav-tifmas-log">
                          <Flame className="h-4 w-4 text-orange-500" /> TIFMAS Deployment Log
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/personnel/deployment-tracker/emtf-log" className="flex items-center gap-2" data-testid="nav-emtf-log">
                          <Ambulance className="h-4 w-4 text-blue-500" /> EMTF Deployment Log
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/personnel/deployment-tracker/history" className="flex items-center gap-2" data-testid="nav-deploy-history">
                          <History className="h-4 w-4" /> Deployment History
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/battalion-chief/overtime" className="flex items-center gap-2" data-testid="nav-overtime">
                    <Clock className="h-4 w-4" /> Overtime Available
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/battalion-chief/part-time" className="flex items-center gap-2" data-testid="nav-part-time-bc">
                    <Clock className="h-4 w-4" /> Part-Time Available
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/battalion-chief/volunteer" className="flex items-center gap-2" data-testid="nav-volunteer">
                    <Hand className="h-4 w-4" /> Volunteer Scheduled
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/battalion-chief/leave-calendar" className="flex items-center gap-2" data-testid="nav-leave-calendar">
                    <Calendar className="h-4 w-4" /> Leave Calendar
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/battalion-chief/leave-balances" className="flex items-center gap-2" data-testid="nav-leave-balances">
                    <TrendingUp className="h-4 w-4" /> Leave Balances
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Deputy Chief Dropdown */}
          {canAccessFullMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="font-heading text-sm uppercase tracking-wider gap-1"
                  data-testid="deputy-chief-dropdown"
                >
                  Deputy Chief <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem asChild>
                  <Link to="/deputy-chief/day-of-staffing" className="flex items-center gap-2" data-testid="nav-day-of-staffing">
                    <ClipboardList className="h-4 w-4" /> Day of Staffing
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/deputy-chief/calendar-view" className="flex items-center gap-2" data-testid="nav-calendar-view">
                    <Calendar className="h-4 w-4" /> Calendar View
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Personnel Dropdown - Available to ALL users */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="font-heading text-sm uppercase tracking-wider gap-1"
                data-testid="personnel-dropdown"
              >
                Personnel <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {!isVolunteer && (
                <DropdownMenuItem asChild>
                  <Link to="/overtime" className="flex items-center gap-2" data-testid="nav-overtime-personnel">
                    <Clock className="h-4 w-4" /> Overtime
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link to="/part-time" className="flex items-center gap-2" data-testid="nav-part-time-personnel">
                  <Clock className="h-4 w-4" /> Part-Time
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/volunteer" className="flex items-center gap-2" data-testid="nav-volunteer-personnel">
                  <Hand className="h-4 w-4" /> Volunteer
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {canAccessFullMenu && (
            <NavLink to="/reports" active={isActive('/reports')} primaryColor={primaryColor}>
              Reports
            </NavLink>
          )}

          {/* Tools Dropdown (Admin Only) - After Reports */}
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="font-heading text-sm uppercase tracking-wider gap-1"
                  data-testid="tools-dropdown"
                >
                  Tools <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem asChild>
                  <Link to="/tools/personnel" className="flex items-center gap-2" data-testid="nav-personnel-mgmt">
                    <Users className="h-4 w-4" /> Personnel Management
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/tools/stations" className="flex items-center gap-2" data-testid="nav-station-mgmt">
                    <Settings className="h-4 w-4" /> Station Management
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/tools/users" className="flex items-center gap-2" data-testid="nav-user-mgmt">
                    <Users className="h-4 w-4" /> User Management
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/tools/part-time" className="flex items-center gap-2" data-testid="nav-part-time-mgmt">
                    <Clock className="h-4 w-4" /> Part-Time Management
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/tools/volunteers" className="flex items-center gap-2" data-testid="nav-volunteer-mgmt">
                    <UserPlus className="h-4 w-4" /> Volunteer Management
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/tools/branding" className="flex items-center gap-2" data-testid="nav-branding">
                    <Palette className="h-4 w-4" /> Branding Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/voice-feedback" className="flex items-center gap-2" data-testid="nav-voice-feedback">
                    <Mic className="h-4 w-4" /> Voice Feedback
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full"
            data-testid="theme-toggle"
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5 text-yellow-500" />
            ) : (
              <Moon className="h-5 w-5 text-blue-500" />
            )}
          </Button>

          {/* Notification Bell */}
          <NotificationBell />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2" data-testid="user-menu">
                <div className="h-8 w-8 rounded-full bg-red-500 flex items-center justify-center text-white font-bold">
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <span className="hidden md:inline text-sm">{user?.name}</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.rank}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role?.replace('_', ' ')}</p>
              </div>
              <DropdownMenuSeparator />
              {isSuperAdmin && (
                <>
                  <DropdownMenuItem asChild>
                    <Link to="/super-admin" className="flex items-center gap-2 text-purple-600" data-testid="nav-super-admin">
                      <Shield className="h-4 w-4" /> Super Admin Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {canAccessFullMenu && (
                <DropdownMenuItem asChild>
                  <Link to="/change-log" className="flex items-center gap-2" data-testid="change-log-menu">
                    <History className="h-4 w-4" /> Change Log
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link to="/settings" className="flex items-center gap-2" data-testid="settings-menu">
                  <Settings className="h-4 w-4" /> Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowChangePassword(true)} data-testid="change-password-menu">
                <Key className="h-4 w-4 mr-2" /> Change Password
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-500" data-testid="logout-button">
                <LogOut className="h-4 w-4 mr-2" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Change Password Modal */}
          <ChangePasswordModal 
            isOpen={showChangePassword} 
            onClose={() => setShowChangePassword(false)} 
            isRequired={false}
          />

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="mobile-menu-button"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-border bg-card p-4 animate-slide-in max-h-[80vh] overflow-y-auto">
          <nav className="flex flex-col gap-1">
            {/* Main Navigation */}
            {/* Daily Worksheet - Available to all users (view-only for view-only roles) */}
            <Link to="/dashboard" className="px-4 py-2 hover:bg-muted rounded-md" data-testid="mobile-nav-dashboard" onClick={() => setMobileMenuOpen(false)}>
              <ClipboardList className="h-4 w-4 inline mr-2" /> Daily Worksheet {isViewOnly && <span className="text-xs text-muted-foreground">(View Only)</span>}
            </Link>
            <Link to="/on-duty" className="px-4 py-2 hover:bg-muted rounded-md" data-testid="mobile-nav-onduty" onClick={() => setMobileMenuOpen(false)}>
              <Users className="h-4 w-4 inline mr-2" /> On Duty
            </Link>
            
            {/* Battalion Chief Section */}
            {canAccessFullMenu && (
              <>
                <div className="px-4 py-2 text-xs font-bold uppercase text-muted-foreground mt-2 border-t pt-3">Battalion Chief</div>
                <Link to="/battalion-chief/apparatus" className="px-4 py-2 hover:bg-muted rounded-md pl-6" onClick={() => setMobileMenuOpen(false)}>
                  <Truck className="h-4 w-4 inline mr-2" /> Apparatus Assignments
                </Link>
                <Link to="/battalion-chief/sick" className="px-4 py-2 hover:bg-muted rounded-md pl-6" onClick={() => setMobileMenuOpen(false)}>
                  <AlertCircle className="h-4 w-4 inline mr-2" /> Sick
                </Link>
                <Link to="/battalion-chief/vacation" className="px-4 py-2 hover:bg-muted rounded-md pl-6" onClick={() => setMobileMenuOpen(false)}>
                  <Calendar className="h-4 w-4 inline mr-2" /> Vacation
                </Link>
                <Link to="/battalion-chief/holiday" className="px-4 py-2 hover:bg-muted rounded-md pl-6" onClick={() => setMobileMenuOpen(false)}>
                  <Calendar className="h-4 w-4 inline mr-2" /> Holiday
                </Link>
                {/* Deployments sub-section under BC */}
                <div className="pl-4 py-1 text-xs text-muted-foreground">Deployments</div>
                <Link to="/personnel/deployment-tracker/roster" className="px-4 py-2 hover:bg-muted rounded-md pl-8" onClick={() => setMobileMenuOpen(false)}>
                  <Users className="h-4 w-4 inline mr-2" /> TIFMAS & EMTF Roster
                </Link>
                <Link to="/personnel/deployment-tracker/tifmas-rank" className="px-4 py-2 hover:bg-muted rounded-md pl-8" onClick={() => setMobileMenuOpen(false)}>
                  <Flame className="h-4 w-4 inline mr-2 text-orange-500" /> TIFMAS
                </Link>
                <Link to="/personnel/deployment-tracker/emtf-rank" className="px-4 py-2 hover:bg-muted rounded-md pl-8" onClick={() => setMobileMenuOpen(false)}>
                  <Ambulance className="h-4 w-4 inline mr-2 text-blue-500" /> EMTF
                </Link>
                <Link to="/personnel/deployment-tracker/tifmas-log" className="px-4 py-2 hover:bg-muted rounded-md pl-8" onClick={() => setMobileMenuOpen(false)}>
                  <Flame className="h-4 w-4 inline mr-2 text-orange-500" /> TIFMAS Deployment Log
                </Link>
                <Link to="/personnel/deployment-tracker/emtf-log" className="px-4 py-2 hover:bg-muted rounded-md pl-8" onClick={() => setMobileMenuOpen(false)}>
                  <Ambulance className="h-4 w-4 inline mr-2 text-blue-500" /> EMTF Deployment Log
                </Link>
                <Link to="/personnel/deployment-tracker/history" className="px-4 py-2 hover:bg-muted rounded-md pl-8" onClick={() => setMobileMenuOpen(false)}>
                  <History className="h-4 w-4 inline mr-2" /> Deployment History
                </Link>
                <Link to="/battalion-chief/overtime" className="px-4 py-2 hover:bg-muted rounded-md pl-6" onClick={() => setMobileMenuOpen(false)}>
                  <Clock className="h-4 w-4 inline mr-2" /> Overtime Available
                </Link>
                <Link to="/battalion-chief/part-time" className="px-4 py-2 hover:bg-muted rounded-md pl-6" onClick={() => setMobileMenuOpen(false)}>
                  <UserPlus className="h-4 w-4 inline mr-2" /> Part-Time Available
                </Link>
                <Link to="/battalion-chief/volunteer" className="px-4 py-2 hover:bg-muted rounded-md pl-6" onClick={() => setMobileMenuOpen(false)}>
                  <Hand className="h-4 w-4 inline mr-2" /> Volunteer Scheduled
                </Link>
                <Link to="/battalion-chief/leave-calendar" className="px-4 py-2 hover:bg-muted rounded-md pl-6" onClick={() => setMobileMenuOpen(false)}>
                  <Calendar className="h-4 w-4 inline mr-2" /> Leave Calendar
                </Link>
                <Link to="/battalion-chief/leave-balances" className="px-4 py-2 hover:bg-muted rounded-md pl-6" onClick={() => setMobileMenuOpen(false)}>
                  <TrendingUp className="h-4 w-4 inline mr-2" /> Leave Balances
                </Link>
              </>
            )}
            
            {/* Deputy Chief Section */}
            {canAccessFullMenu && (
              <>
                <div className="px-4 py-2 text-xs font-bold uppercase text-muted-foreground mt-2 border-t pt-3">Deputy Chief</div>
                <Link to="/deputy-chief/day-of-staffing" className="px-4 py-2 hover:bg-muted rounded-md pl-6" onClick={() => setMobileMenuOpen(false)}>
                  <ClipboardList className="h-4 w-4 inline mr-2" /> Day of Staffing
                </Link>
                <Link to="/deputy-chief/calendar-view" className="px-4 py-2 hover:bg-muted rounded-md pl-6" onClick={() => setMobileMenuOpen(false)}>
                  <Calendar className="h-4 w-4 inline mr-2" /> Calendar View
                </Link>
              </>
            )}
            
            {/* Personnel Section */}
            <div className="px-4 py-2 text-xs font-bold uppercase text-muted-foreground mt-2 border-t pt-3">Personnel</div>
            {!isVolunteer && (
              <Link to="/overtime" className="px-4 py-2 hover:bg-muted rounded-md pl-6" data-testid="mobile-nav-overtime" onClick={() => setMobileMenuOpen(false)}>
                <Clock className="h-4 w-4 inline mr-2" /> Overtime
              </Link>
            )}
            <Link to="/part-time" className="px-4 py-2 hover:bg-muted rounded-md pl-6" data-testid="mobile-nav-part-time" onClick={() => setMobileMenuOpen(false)}>
              <Clock className="h-4 w-4 inline mr-2" /> Part-Time
            </Link>
            <Link to="/volunteer" className="px-4 py-2 hover:bg-muted rounded-md pl-6" data-testid="mobile-nav-volunteer" onClick={() => setMobileMenuOpen(false)}>
              <Hand className="h-4 w-4 inline mr-2" /> Volunteer
            </Link>
            
            {/* Reports */}
            {canAccessFullMenu && (
              <>
                <div className="px-4 py-2 text-xs font-bold uppercase text-muted-foreground mt-2 border-t pt-3">Reports & Logs</div>
                <Link to="/reports" className="px-4 py-2 hover:bg-muted rounded-md pl-6" onClick={() => setMobileMenuOpen(false)}>
                  <FileText className="h-4 w-4 inline mr-2" /> Reports
                </Link>
                <Link to="/change-log" className="px-4 py-2 hover:bg-muted rounded-md pl-6" onClick={() => setMobileMenuOpen(false)}>
                  <History className="h-4 w-4 inline mr-2" /> Change Log
                </Link>
              </>
            )}
            
            {/* Tools (Admin Only) */}
            {isAdmin && (
              <>
                <div className="px-4 py-2 text-xs font-bold uppercase text-muted-foreground mt-2 border-t pt-3">Tools (Admin)</div>
                <Link to="/tools/personnel" className="px-4 py-2 hover:bg-muted rounded-md pl-6" onClick={() => setMobileMenuOpen(false)}>
                  <Users className="h-4 w-4 inline mr-2" /> Personnel Management
                </Link>
                <Link to="/tools/stations" className="px-4 py-2 hover:bg-muted rounded-md pl-6" onClick={() => setMobileMenuOpen(false)}>
                  <Truck className="h-4 w-4 inline mr-2" /> Station Management
                </Link>
                <Link to="/tools/users" className="px-4 py-2 hover:bg-muted rounded-md pl-6" onClick={() => setMobileMenuOpen(false)}>
                  <Users className="h-4 w-4 inline mr-2" /> User Management
                </Link>
                <Link to="/tools/part-time" className="px-4 py-2 hover:bg-muted rounded-md pl-6" onClick={() => setMobileMenuOpen(false)}>
                  <UserPlus className="h-4 w-4 inline mr-2" /> Part-Time Management
                </Link>
                <Link to="/tools/volunteers" className="px-4 py-2 hover:bg-muted rounded-md pl-6" onClick={() => setMobileMenuOpen(false)}>
                  <Hand className="h-4 w-4 inline mr-2" /> Volunteer Management
                </Link>
                <Link to="/tools/branding" className="px-4 py-2 hover:bg-muted rounded-md pl-6" onClick={() => setMobileMenuOpen(false)}>
                  <Palette className="h-4 w-4 inline mr-2" /> Branding Settings
                </Link>
                <Link to="/voice-feedback" className="px-4 py-2 hover:bg-muted rounded-md pl-6" onClick={() => setMobileMenuOpen(false)}>
                  <Mic className="h-4 w-4 inline mr-2" /> Voice Feedback
                </Link>
              </>
            )}
            
            {/* Settings */}
            <div className="px-4 py-2 text-xs font-bold uppercase text-muted-foreground mt-2 border-t pt-3">Account</div>
            <Link to="/settings" className="px-4 py-2 hover:bg-muted rounded-md pl-6" onClick={() => setMobileMenuOpen(false)}>
              <Settings className="h-4 w-4 inline mr-2" /> Settings
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
};
