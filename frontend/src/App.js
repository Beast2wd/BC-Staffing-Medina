import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { StaffingProvider } from "./context/StaffingContext";
import { ThemeProvider } from "./context/ThemeContext";
import { BrandingProvider } from "./context/BrandingContext";
import { TimezoneProvider } from "./context/TimezoneContext";
import { WebSocketProvider } from "./contexts/WebSocketContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { ChangePasswordModal } from "./components/auth/ChangePasswordModal";
import ImpersonationBanner from "./components/layout/ImpersonationBanner";
import { getSubdomain } from "./utils/tenantUtils";

// Pages
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { ClientLoginPage } from "./pages/ClientLoginPage";
import { PlatformSettingsPage } from "./pages/PlatformSettingsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ApparatusPage } from "./pages/battalion-chief/ApparatusPage";
import { LeaveManagementPage } from "./pages/battalion-chief/LeaveManagementPage";
import { OvertimePage } from "./pages/battalion-chief/OvertimePage";
import { VolunteerPage } from "./pages/battalion-chief/VolunteerPage";
import { PartTimeBCPage } from "./pages/battalion-chief/PartTimeBCPage";
import { DeploymentPage } from "./pages/battalion-chief/DeploymentPage";
import { DayOfStaffingPage } from "./pages/deputy-chief/DayOfStaffingPage";
import { CalendarViewPage } from "./pages/deputy-chief/CalendarViewPage";
import { PersonnelManagementPage } from "./pages/tools/PersonnelManagementPage";
import { UserManagementPage } from "./pages/tools/UserManagementPage";
import { StationManagementPage } from "./pages/tools/StationManagementPage";
import { VolunteerManagementPage } from "./pages/tools/VolunteerManagementPage";
import { PartTimeManagementPage } from "./pages/tools/PartTimeManagementPage";
import { BrandingSettingsPage } from "./pages/tools/BrandingSettingsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { OvertimeAvailabilityPage } from "./pages/OvertimeAvailabilityPage";
import { VolunteerAvailabilityPage } from "./pages/VolunteerAvailabilityPage";
import { PartTimeAvailabilityPage } from "./pages/PartTimeAvailabilityPage";
import { OnDutyPage } from "./pages/OnDutyPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ChangeLogPage } from "./pages/ChangeLogPage";
import NotificationsPage from "./pages/NotificationsPage";
import SuperAdminDashboard from "./pages/admin/SuperAdminDashboard";

// Deployment Tracker Pages
import { DeploymentRosterPage } from "./pages/deployment-tracker/DeploymentRosterPage";
import { DeploymentLogPage } from "./pages/deployment-tracker/DeploymentLogPage";
import { TIFMASRankPage } from "./pages/deployment-tracker/TIFMASRankPage";
import { EMTFRankPage } from "./pages/deployment-tracker/EMTFRankPage";
import { DeploymentHistoryPage } from "./pages/deployment-tracker/DeploymentHistoryPage";
import { TIFMASDeploymentLog } from "./pages/deployment-tracker/TIFMASDeploymentLog";
import { EMTFDeploymentLog } from "./pages/deployment-tracker/EMTFDeploymentLog";

// Protected Route Component
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// App Content with Routing
const AppContent = () => {
  const { user, loading, mustChangePassword } = useAuth();
  
  // Check if there's a tenant context (subdomain or impersonation)
  const hasTenantContext = () => {
    const subdomain = getSubdomain();
    const impersonationInfo = localStorage.getItem('impersonation_info');
    return subdomain !== null || impersonationInfo !== null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  // Determine where Super Admin should go:
  // - If they have a tenant context (subdomain set or impersonating), allow dashboard access
  // - If no tenant context, show landing page for tenant selection
  const shouldSuperAdminSeeLanding = user?.is_super_admin && !hasTenantContext();

  return (
    <StaffingProvider>
      <WebSocketProvider>
        {/* Impersonation Banner - shows when super admin is viewing/impersonating a tenant */}
        <ImpersonationBanner />
        
        {/* Force password change modal - blocks all navigation until password is changed */}
        {user && mustChangePassword && (
          <ChangePasswordModal 
            isOpen={true} 
            onClose={() => {}} 
            isRequired={true} 
          />
        )}
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={
            !user ? <LandingPage /> :
            shouldSuperAdminSeeLanding ? <LandingPage /> :
            <Navigate to="/dashboard" replace />
          } />
          <Route path="/login" element={
            !user ? <LoginPage /> :
            shouldSuperAdminSeeLanding ? <Navigate to="/" replace /> :
            <Navigate to="/dashboard" replace />
          } />
          
          {/* Client Portal Login - for tenant users */}
          <Route path="/client-login" element={
            !user ? <ClientLoginPage /> :
            <Navigate to="/dashboard" replace />
          } />
          
          {/* Platform Settings - Super Admin only */}
          <Route path="/platform-settings" element={
            <PlatformSettingsPage />
          } />
          
          {/* Protected Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute><DashboardPage /></ProtectedRoute>
          } />
          
          {/* On Duty - View only for all users */}
          <Route path="/on-duty" element={
            <ProtectedRoute><OnDutyPage /></ProtectedRoute>
          } />
          
          {/* Battalion Chief Routes */}
          <Route path="/battalion-chief/apparatus" element={
            <ProtectedRoute><ApparatusPage /></ProtectedRoute>
          } />
          <Route path="/battalion-chief/sick" element={
            <ProtectedRoute><LeaveManagementPage leaveType="sick" /></ProtectedRoute>
          } />
          <Route path="/battalion-chief/vacation" element={
            <ProtectedRoute><LeaveManagementPage leaveType="vacation" /></ProtectedRoute>
          } />
          <Route path="/battalion-chief/holiday" element={
            <ProtectedRoute><LeaveManagementPage leaveType="holiday" /></ProtectedRoute>
          } />
          <Route path="/battalion-chief/deployment" element={
            <ProtectedRoute><DeploymentPage /></ProtectedRoute>
          } />
          <Route path="/battalion-chief/overtime" element={
            <ProtectedRoute><OvertimePage /></ProtectedRoute>
          } />
          <Route path="/battalion-chief/part-time" element={
            <ProtectedRoute><PartTimeBCPage /></ProtectedRoute>
          } />
          <Route path="/battalion-chief/volunteer" element={
            <ProtectedRoute><VolunteerPage /></ProtectedRoute>
          } />
          
          {/* Deputy Chief Routes */}
          <Route path="/deputy-chief/day-of-staffing" element={
            <ProtectedRoute><DayOfStaffingPage /></ProtectedRoute>
          } />
          <Route path="/deputy-chief/calendar-view" element={
            <ProtectedRoute><CalendarViewPage /></ProtectedRoute>
          } />
          
          {/* Tools Routes (Admin Only) */}
          <Route path="/tools/personnel" element={
            <ProtectedRoute adminOnly><PersonnelManagementPage /></ProtectedRoute>
          } />
          <Route path="/tools/stations" element={
            <ProtectedRoute adminOnly><StationManagementPage /></ProtectedRoute>
          } />
          <Route path="/tools/users" element={
            <ProtectedRoute adminOnly><UserManagementPage /></ProtectedRoute>
          } />
          <Route path="/tools/part-time" element={
            <ProtectedRoute adminOnly><PartTimeManagementPage /></ProtectedRoute>
          } />
          <Route path="/tools/volunteers" element={
            <ProtectedRoute adminOnly><VolunteerManagementPage /></ProtectedRoute>
          } />
          <Route path="/tools/branding" element={
            <ProtectedRoute adminOnly><BrandingSettingsPage /></ProtectedRoute>
          } />
          
          {/* Reports */}
          <Route path="/reports" element={
            <ProtectedRoute><ReportsPage /></ProtectedRoute>
          } />
          
          {/* Deployment Tracker Routes */}
          <Route path="/personnel/deployment-tracker/roster" element={
            <ProtectedRoute><DeploymentRosterPage /></ProtectedRoute>
          } />
          <Route path="/personnel/deployment-tracker/log" element={
            <ProtectedRoute><DeploymentLogPage /></ProtectedRoute>
          } />
          <Route path="/personnel/deployment-tracker/tifmas-rank" element={
            <ProtectedRoute><TIFMASRankPage /></ProtectedRoute>
          } />
          <Route path="/personnel/deployment-tracker/emtf-rank" element={
            <ProtectedRoute><EMTFRankPage /></ProtectedRoute>
          } />
          <Route path="/personnel/deployment-tracker/history" element={
            <ProtectedRoute><DeploymentHistoryPage /></ProtectedRoute>
          } />
          <Route path="/personnel/deployment-tracker/tifmas-log" element={
            <ProtectedRoute><TIFMASDeploymentLog /></ProtectedRoute>
          } />
          <Route path="/personnel/deployment-tracker/emtf-log" element={
            <ProtectedRoute><EMTFDeploymentLog /></ProtectedRoute>
          } />
          
          {/* Overtime Availability - Available to ALL users including firefighters */}
          <Route path="/overtime" element={
            <ProtectedRoute><OvertimeAvailabilityPage /></ProtectedRoute>
          } />
          
          {/* Part-Time Availability - Available to ALL users */}
          <Route path="/part-time" element={
            <ProtectedRoute><PartTimeAvailabilityPage /></ProtectedRoute>
          } />
          
          {/* Volunteer Availability - Available to Volunteer Firefighters */}
          <Route path="/volunteer" element={
            <ProtectedRoute><VolunteerAvailabilityPage /></ProtectedRoute>
          } />
          
          {/* Settings Page - Available to all users */}
          <Route path="/settings" element={
            <ProtectedRoute><SettingsPage /></ProtectedRoute>
          } />
          
          {/* Change Log Page - Available to BC+ */}
          <Route path="/change-log" element={
            <ProtectedRoute><ChangeLogPage /></ProtectedRoute>
          } />
          
          {/* Notifications Page - Available to all users */}
          <Route path="/notifications" element={
            <ProtectedRoute><NotificationsPage /></ProtectedRoute>
          } />
          
          {/* Super Admin Dashboard - Super Admin only */}
          <Route path="/super-admin" element={
            <ProtectedRoute><SuperAdminDashboard /></ProtectedRoute>
          } />
          
          {/* Default Redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </WebSocketProvider>
    </StaffingProvider>
  );
};

function App() {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <BrandingProvider>
          <AuthProvider>
            <TimezoneProvider>
              <BrowserRouter>
                <AppContent />
                <Toaster position="top-center" richColors expand={true} />
              </BrowserRouter>
            </TimezoneProvider>
          </AuthProvider>
        </BrandingProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}

export default App;
