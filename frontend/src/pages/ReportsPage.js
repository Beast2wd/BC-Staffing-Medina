import { useEffect, useState } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useAuth } from '../context/AuthContext';
import { useStaffing } from '../context/StaffingContext';
import { BattalionSelector } from '../components/dashboard/BattalionSelector';
import { toast } from 'sonner';
import { Download, FileText, Calendar } from 'lucide-react';
import { Label } from '../components/ui/label';

export const ReportsPage = () => {
  const { api } = useAuth();
  const { selectedBattalion, battalions, fetchBattalions } = useStaffing();
  const [reportType, setReportType] = useState('daily');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBattalions();
  }, [fetchBattalions]);

  const generateReport = async () => {
    setLoading(true);
    try {
      let response;
      
      if (reportType === 'daily') {
        response = await api.get('/reports/daily-summary', {
          params: {
            date: startDate,
            battalion_id: selectedBattalion
          }
        });
      } else if (reportType === 'overtime') {
        response = await api.get('/reports/overtime-summary', {
          params: {
            start_date: startDate,
            end_date: endDate,
            battalion_id: selectedBattalion
          }
        });
      }
      
      setReportData(response.data);
      toast.success('Report generated');
    } catch (error) {
      toast.error('Failed to generate report');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getBattalionName = () => {
    const battalion = battalions.find(b => b.id === selectedBattalion);
    return battalion ? `Battalion ${battalion.battalion_number}` : selectedBattalion;
  };

  return (
    <div className="min-h-screen bg-background" data-testid="reports-page">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-3xl uppercase tracking-wider font-bold">
              Reports
            </h1>
            <p className="text-muted-foreground mt-1">
              Generate staffing and overtime reports
            </p>
          </div>
          
          <BattalionSelector />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Report Options */}
          <Card data-testid="report-options-card">
            <CardHeader>
              <CardTitle className="font-heading uppercase">Report Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Report Type</Label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger data-testid="report-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily Staffing Summary</SelectItem>
                    <SelectItem value="overtime">Overtime Summary</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{reportType === 'daily' ? 'Date' : 'Start Date'}</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="start-date-input"
                />
              </div>

              {reportType === 'overtime' && (
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    data-testid="end-date-input"
                  />
                </div>
              )}

              <Button 
                onClick={generateReport} 
                disabled={loading}
                className="w-full"
                data-testid="generate-report-btn"
              >
                <FileText className="h-4 w-4 mr-2" />
                {loading ? 'Generating...' : 'Generate Report'}
              </Button>
            </CardContent>
          </Card>

          {/* Report Preview */}
          <Card className="lg:col-span-2" data-testid="report-preview-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="font-heading uppercase">Report Preview</CardTitle>
                {reportData && (
                  <Button variant="outline" size="sm" data-testid="export-report-btn">
                    <Download className="h-4 w-4 mr-2" /> Export
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!reportData ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select report options and click "Generate Report" to view data</p>
                </div>
              ) : reportType === 'daily' ? (
                <div className="space-y-6">
                  {/* Daily Summary Header */}
                  <div className="text-center pb-4 border-b">
                    <h2 className="font-heading text-2xl uppercase font-bold">
                      Daily Staffing Summary
                    </h2>
                    <p className="text-muted-foreground">
                      {getBattalionName()} - {reportData.date}
                    </p>
                  </div>

                  {/* Overview Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-muted rounded-lg text-center">
                      <p className="text-2xl font-bold">{reportData.total_stations}</p>
                      <p className="text-xs text-muted-foreground">Total Stations</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg text-center">
                      <p className="text-2xl font-bold">{reportData.total_minimum_staffing}</p>
                      <p className="text-xs text-muted-foreground">Min Required</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg text-center">
                      <p className="text-2xl font-bold text-green-500">{reportData.total_personnel_assigned}</p>
                      <p className="text-xs text-muted-foreground">Assigned</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg text-center">
                      <p className={`text-2xl font-bold ${reportData.staffing_variance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {reportData.staffing_variance >= 0 ? '+' : ''}{reportData.staffing_variance}
                      </p>
                      <p className="text-xs text-muted-foreground">Variance</p>
                    </div>
                  </div>

                  {/* Station Details */}
                  <div>
                    <h3 className="font-heading text-lg uppercase mb-3">Station Breakdown</h3>
                    <div className="space-y-2">
                      {reportData.station_details?.map(station => (
                        <div key={station.station_id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <span className="font-semibold">Station {station.station_number}</span>
                          <div className="flex items-center gap-4 text-sm">
                            <span>Min: {station.minimum_staffing}</span>
                            <span className={station.assigned >= station.minimum_staffing ? 'text-green-500' : 'text-red-500'}>
                              Assigned: {station.assigned}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Category Totals */}
                  {Object.keys(reportData.category_totals || {}).length > 0 && (
                    <div>
                      <h3 className="font-heading text-lg uppercase mb-3">Category Totals</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {Object.entries(reportData.category_totals).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                            <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                            <span className="font-semibold">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Overtime Summary Header */}
                  <div className="text-center pb-4 border-b">
                    <h2 className="font-heading text-2xl uppercase font-bold">
                      Overtime Summary
                    </h2>
                    <p className="text-muted-foreground">
                      {getBattalionName()} - {reportData.start_date} to {reportData.end_date}
                    </p>
                  </div>

                  {reportData.personnel_overtime?.length > 0 ? (
                    <div className="space-y-2">
                      {reportData.personnel_overtime.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <span>Personnel ID: {item._id}</span>
                          <div className="flex items-center gap-4 text-sm">
                            <span>Hours: <strong>{item.total_hours}</strong></span>
                            <span>Entries: <strong>{item.count}</strong></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      No overtime records found for this period
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};
