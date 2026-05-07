import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
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
  ChevronRight
} from 'lucide-react';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';

const LOGO_URL = '/medina-logo.png';

export const Navbar = () => {
  const { user, logout, isAdmin, isFirefighter, isVolunteer } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  // Check if user can view/access a menu item (all roles except firefighters and volunteers for most items)
  const canAccessFullMenu = !isFirefighter && !isVolunteer;

  const NavLink = ({ to, children, active, disabled }) => (
    <Link
      to={disabled ? '#' : to}
      className={`px-3 py-2 font-heading text-sm uppercase tracking-wider transition-colors whitespace-nowrap ${
        active 
          ? 'text-red-500 border-b-2 border-red-500' 
          : disabled
            ? 'text-muted-foreground/50 cursor-not-allowed'
            : 'text-foreground/80 hover:text-red-500'
      }`}
      onClick={(e) => disabled && e.preventDefault()}
      data-testid={`nav-link-${to.replace('/', '') || 'home'}`}
    >
      {children}
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link to="/dashboard" className="flex items-center gap-3" data-testid="navbar-logo">
          <img src={LOGO_URL} alt="Logo" className="h-12 w-auto" />
          <div className="hidden sm:block">
            <h1 className="font-heading text-xl uppercase tracking-wider font-bold text-foreground">
              BC Staffing
            </h1>
            <p className="text-xs text-muted-foreground">Medina County</p>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-2">
          {/* Daily Worksheet - Hidden for volunteers */}
          {!isVolunteer && (
            <NavLink to="/dashboard" active={isActive('/dashboard')} disabled={!canAccessFullMenu}>
              Daily Worksheet
            </NavLink>
          )}

          {/* On Duty - Available to ALL users */}
          <NavLink to="/on-duty" active={isActive('/on-duty')}>
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
                <DropdownMenuItem asChild>
                  <Link to="/battalion-chief/deployment" className="flex items-center gap-2" data-testid="nav-deployment">
                    <Plane className="h-4 w-4" /> Deployment
                  </Link>
                </DropdownMenuItem>
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
              <DropdownMenuSeparator />
              {/* Deployment Tracker Submenu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="flex items-center gap-2">
                  <Plane className="h-4 w-4" /> Deployment Tracker
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="w-48">
                    <DropdownMenuItem asChild>
                      <Link to="/personnel/deployment-tracker/roster" className="flex items-center gap-2" data-testid="nav-deploy-roster">
                        <Users className="h-4 w-4" /> Roster
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/personnel/deployment-tracker/log" className="flex items-center gap-2" data-testid="nav-deploy-log">
                        <FileText className="h-4 w-4" /> Deployment Log
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/personnel/deployment-tracker/tifmas-rank" className="flex items-center gap-2" data-testid="nav-tifmas-rank">
                        <Flame className="h-4 w-4 text-orange-500" /> TIFMAS Rank
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/personnel/deployment-tracker/emtf-rank" className="flex items-center gap-2" data-testid="nav-emtf-rank">
                        <Ambulance className="h-4 w-4 text-blue-500" /> EMTF Rank
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>

          {canAccessFullMenu && (
            <NavLink to="/reports" active={isActive('/reports')}>
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
              <DropdownMenuItem onClick={() => setShowChangePassword(true)} data-testid="change-password-menu">
                <Key className="h-4 w-4 mr-2" /> Change Password
              </DropdownMenuItem>
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
        <div className="lg:hidden border-t border-border bg-card p-4 animate-slide-in">
          <nav className="flex flex-col gap-2">
            {canAccessFullMenu && (
              <Link to="/dashboard" className="px-4 py-2 hover:bg-muted rounded-md" data-testid="mobile-nav-dashboard">
                Daily Worksheet
              </Link>
            )}
            <Link to="/on-duty" className="px-4 py-2 hover:bg-muted rounded-md" data-testid="mobile-nav-onduty">
              On Duty
            </Link>
            {canAccessFullMenu && (
              <Link to="/battalion-chief/apparatus" className="px-4 py-2 hover:bg-muted rounded-md" data-testid="mobile-nav-apparatus">
                Apparatus Assignments
              </Link>
            )}
            {canAccessFullMenu && (
              <Link to="/deputy-chief/day-of-staffing" className="px-4 py-2 hover:bg-muted rounded-md" data-testid="mobile-nav-day-staffing">
                Day of Staffing
              </Link>
            )}
            
            {/* Personnel Section */}
            <div className="px-4 py-2 text-xs font-bold uppercase text-muted-foreground">Personnel</div>
            {!isVolunteer && (
              <Link to="/overtime" className="px-4 py-2 hover:bg-muted rounded-md pl-8" data-testid="mobile-nav-overtime">
                <Clock className="h-4 w-4 inline mr-2" /> Overtime
              </Link>
            )}
            <Link to="/part-time" className="px-4 py-2 hover:bg-muted rounded-md pl-8" data-testid="mobile-nav-part-time">
              <Clock className="h-4 w-4 inline mr-2" /> Part-Time
            </Link>
            <Link to="/volunteer" className="px-4 py-2 hover:bg-muted rounded-md pl-8" data-testid="mobile-nav-volunteer">
              <Hand className="h-4 w-4 inline mr-2" /> Volunteer
            </Link>
            
            {canAccessFullMenu && (
              <Link to="/reports" className="px-4 py-2 hover:bg-muted rounded-md" data-testid="mobile-nav-reports">
                Reports
              </Link>
            )}
            {isAdmin && (
              <Link to="/tools/personnel" className="px-4 py-2 hover:bg-muted rounded-md" data-testid="mobile-nav-tools">
                Tools
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};
