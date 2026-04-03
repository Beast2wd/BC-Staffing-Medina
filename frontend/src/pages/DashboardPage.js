import { useEffect } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { ShiftCalendar } from '../components/dashboard/ShiftCalendar';
import { BattalionSelector } from '../components/dashboard/BattalionSelector';
import { StaffingGrid } from '../components/dashboard/StaffingGrid';
import { RemarksPanel } from '../components/dashboard/RemarksPanel';
import { useStaffing } from '../context/StaffingContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { RefreshCw, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { formatDisplayDateWithDay } from '../utils/dateUtils';

export const DashboardPage = () => {
  const { fetchAllData, loading, currentShift, selectedDate } = useStaffing();
  const { user } = useAuth();

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleRefresh = async () => {
    toast.info('Refreshing data...');
    await fetchAllData();
    toast.success('Data refreshed');
  };

  return (
    <div className="min-h-screen bg-background" data-testid="dashboard-page">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-3xl md:text-4xl uppercase tracking-wider font-bold">
              Daily Work Sheet
            </h1>
            <p className="text-muted-foreground mt-1">
              {formatDisplayDateWithDay(selectedDate)} - {currentShift} Shift
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <BattalionSelector />
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleRefresh}
                disabled={loading}
                data-testid="refresh-btn"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh Sheet
              </Button>
              <Button variant="outline" data-testid="next-form-btn">
                <FileText className="h-4 w-4 mr-2" />
                Next Form
              </Button>
            </div>
          </div>
        </div>

        {/* Battalion Chief Info */}
        <div className="mb-6 flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">Battalion Chief on duty PR#:</span>
          <span className="font-semibold">{user?.payroll_number || '---'}</span>
        </div>

        {/* Main Grid Layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Calendar - Left Side */}
          <div className="lg:w-80 flex-shrink-0">
            <ShiftCalendar />
          </div>

          {/* Staffing Grid - Center */}
          <div className="flex-1 min-w-0">
            <StaffingGrid />
          </div>
        </div>

        {/* Remarks Section */}
        <div className="mt-6">
          <RemarksPanel />
        </div>
      </main>
    </div>
  );
};
