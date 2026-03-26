import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { StaffingProvider } from "./context/StaffingContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ChangePasswordModal } from "./components/auth/ChangePasswordModal";

// Pages
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ApparatusPage } from "./pages/battalion-chief/ApparatusPage";
import { LeaveManagementPage } from "./pages/battalion-chief/LeaveManagementPage";
import { OvertimePage } from "./pages/battalion-chief/OvertimePage";
import { DeploymentPage } from "./pages/battalion-chief/DeploymentPage";
import { DayOfStaffingPage } from "./pages/deputy-chief/DayOfStaffingPage";
import { PersonnelManagementPage } from "./pages/tools/PersonnelManagementPage";
import { UserManagementPage } from "./pages/tools/UserManagementPage";
import { StationManagementPage } from "./pages/tools/StationManagementPage";
import { ReportsPage } from "./pages/ReportsPage";
import { OvertimeAvailabilityPage } from "./pages/OvertimeAvailabilityPage";

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  return (
    <StaffingProvider>
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
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        
        {/* Protected Routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute><DashboardPage /></ProtectedRoute>
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
        
        {/* Deputy Chief Routes */}
        <Route path="/deputy-chief/day-of-staffing" element={
          <ProtectedRoute><DayOfStaffingPage /></ProtectedRoute>
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
        
        {/* Reports */}
        <Route path="/reports" element={
          <ProtectedRoute><ReportsPage /></ProtectedRoute>
        } />
        
        {/* Overtime Availability - Available to ALL users including firefighters */}
        <Route path="/overtime" element={
          <ProtectedRoute><OvertimeAvailabilityPage /></ProtectedRoute>
        } />
        
        {/* Default Redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </StaffingProvider>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppContent />
          <Toaster position="top-right" richColors />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
