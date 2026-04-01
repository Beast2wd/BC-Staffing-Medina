import { useEffect, useState, useRef } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useAuth } from '../context/AuthContext';
import { useStaffing } from '../context/StaffingContext';
import { BattalionSelector } from '../components/dashboard/BattalionSelector';
import { toast } from 'sonner';
import { Download, FileText, Calendar, Printer, FileSpreadsheet } from 'lucide-react';
import { Label } from '../components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';

const LOGO_URL = '/medina-logo.png';

export const ReportsPage = () => {
  const { api, user } = useAuth();
  const { selectedBattalion, battalions, fetchBattalions, personnel } = useStaffing();
  const [reportType, setReportType] = useState('daily');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const reportRef = useRef(null);

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

  const handlePrint = () => {
    if (!reportData) {
      toast.error('Please generate a report first');
      return;
    }
    
    const printContent = reportRef.current;
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Medina County BC Staffing - ${reportType === 'daily' ? 'Daily Summary' : 'Overtime Summary'}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: Arial, sans-serif; 
              padding: 20px; 
              color: #000;
              background: #fff;
            }
            .header { 
              text-align: center; 
              margin-bottom: 30px; 
              border-bottom: 2px solid #000;
              padding-bottom: 20px;
            }
            .header h1 { 
              font-size: 24px; 
              text-transform: uppercase; 
              margin-bottom: 5px;
            }
            .header p { 
              color: #666; 
              font-size: 14px;
            }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 15px;
              margin-bottom: 30px;
            }
            .stat-box {
              border: 1px solid #ddd;
              padding: 15px;
              text-align: center;
              border-radius: 4px;
            }
            .stat-box .value {
              font-size: 28px;
              font-weight: bold;
            }
            .stat-box .label {
              font-size: 12px;
              color: #666;
              text-transform: uppercase;
            }
            .stat-box .positive { color: #22c55e; }
            .stat-box .negative { color: #ef4444; }
            .section { margin-bottom: 25px; }
            .section h2 {
              font-size: 16px;
              text-transform: uppercase;
              border-bottom: 1px solid #ddd;
              padding-bottom: 8px;
              margin-bottom: 15px;
            }
            .station-row {
              display: flex;
              justify-content: space-between;
              padding: 10px;
              border-bottom: 1px solid #eee;
            }
            .station-row:nth-child(even) { background: #f9f9f9; }
            .station-name { font-weight: bold; }
            .station-stats { display: flex; gap: 20px; }
            .positive { color: #22c55e; }
            .negative { color: #ef4444; }
            .footer {
              margin-top: 40px;
              text-align: center;
              font-size: 12px;
              color: #666;
              border-top: 1px solid #ddd;
              padding-top: 15px;
            }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${reportType === 'daily' ? 'Daily Staffing Summary' : 'Overtime Summary'}</h1>
            <p>${getBattalionName()} - ${reportType === 'daily' ? reportData.date : `${reportData.start_date} to ${reportData.end_date}`}</p>
          </div>
          
          ${reportType === 'daily' ? `
            <div class="stats-grid">
              <div class="stat-box">
                <div class="value">${reportData.total_stations}</div>
                <div class="label">Total Stations</div>
              </div>
              <div class="stat-box">
                <div class="value">${reportData.total_minimum_staffing}</div>
                <div class="label">Min Required</div>
              </div>
              <div class="stat-box">
                <div class="value positive">${reportData.total_personnel_assigned}</div>
                <div class="label">Assigned</div>
              </div>
              <div class="stat-box">
                <div class="value ${reportData.staffing_variance >= 0 ? 'positive' : 'negative'}">
                  ${reportData.staffing_variance >= 0 ? '+' : ''}${reportData.staffing_variance}
                </div>
                <div class="label">Variance</div>
              </div>
            </div>
            
            <div class="section">
              <h2>Station Breakdown</h2>
              ${reportData.station_details?.map(station => `
                <div class="station-row">
                  <span class="station-name">Station ${station.station_number}</span>
                  <div class="station-stats">
                    <span>Min: ${station.minimum_staffing}</span>
                    <span class="${station.assigned >= station.minimum_staffing ? 'positive' : 'negative'}">
                      Assigned: ${station.assigned}
                    </span>
                  </div>
                </div>
              `).join('') || ''}
            </div>
          ` : `
            <div class="section">
              <h2>Overtime Records</h2>
              ${reportData.personnel_overtime?.length > 0 ? 
                reportData.personnel_overtime.map(item => `
                  <div class="station-row">
                    <span>Personnel ID: ${item._id}</span>
                    <div class="station-stats">
                      <span>Hours: <strong>${item.total_hours}</strong></span>
                      <span>Entries: <strong>${item.count}</strong></span>
                    </div>
                  </div>
                `).join('') : 
                '<p style="text-align:center;color:#666;padding:20px;">No overtime records found</p>'
              }
            </div>
          `}
          
          <div class="footer">
            <p>Medina County BC Staffing System</p>
            <p>Generated: ${new Date().toLocaleString()}</p>
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const getBattalionName = () => {
    const battalion = battalions.find(b => b.id === selectedBattalion);
    return battalion ? `Battalion ${battalion.battalion_number}` : selectedBattalion;
  };

  const handleExportExcel = async () => {
    if (!reportData) {
      toast.error('Please generate a report first');
      return;
    }
    
    try {
      const response = await api.get('/reports/export/excel', {
        params: {
          date: startDate,
          end_date: endDate,
          battalion_id: selectedBattalion,
          report_type: reportType
        },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${reportType}_report_${startDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Excel report downloaded');
    } catch (error) {
      toast.error('Failed to export Excel report');
      console.error(error);
    }
  };

  const handleExportPdf = async () => {
    if (!reportData) {
      toast.error('Please generate a report first');
      return;
    }
    
    try {
      const response = await api.get('/reports/export/pdf', {
        params: {
          date: startDate,
          end_date: endDate,
          battalion_id: selectedBattalion,
          report_type: reportType
        },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${reportType}_report_${startDate}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PDF report downloaded');
    } catch (error) {
      toast.error('Failed to export PDF report');
      console.error(error);
    }
  };

  // Helper to get personnel name by ID
  const getPersonnelName = (personnelId) => {
    const person = personnel.find(p => p.id === personnelId);
    return person ? `${person.rank} ${person.name}` : personnelId;
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
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handlePrint} data-testid="print-report-btn">
                      <Printer className="h-4 w-4 mr-2" /> Print
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" data-testid="export-dropdown-btn">
                          <Download className="h-4 w-4 mr-2" /> Export
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleExportExcel} data-testid="export-excel-btn">
                          <FileSpreadsheet className="h-4 w-4 mr-2" /> Export to Excel
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleExportPdf} data-testid="export-pdf-btn">
                          <FileText className="h-4 w-4 mr-2" /> Export to PDF
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div ref={reportRef}>
              {!reportData ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select report options and click "Generate Report" to view data</p>
                </div>
              ) : reportType === 'daily' ? (
                <div className="space-y-6">
                  {/* Daily Summary Header */}
                  <div className="text-center pb-4 border-b">
                    <img src={LOGO_URL} alt="Medina County Fire/EMS" className="h-20 mx-auto mb-3" />
                    <h2 className="font-heading text-2xl uppercase font-bold">
                      Daily Staffing Summary
                    </h2>
                    <p className="text-muted-foreground">
                      {getBattalionName()} - {reportData.date}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Generated by: {user?.name} (Payroll: {user?.payroll_number}) on {new Date().toLocaleString()}
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

                  {/* Station Details with Personnel Names */}
                  <div>
                    <h3 className="font-heading text-lg uppercase mb-3">Station Breakdown</h3>
                    <div className="space-y-3">
                      {reportData.station_details?.map(station => (
                        <div key={station.station_id} className="p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold">Station {station.station_number}</span>
                            <div className="flex items-center gap-4 text-sm">
                              <span>Min: {station.minimum_staffing}</span>
                              <span className={station.assigned >= station.minimum_staffing ? 'text-green-500' : 'text-red-500'}>
                                Assigned: {station.assigned}
                              </span>
                            </div>
                          </div>
                          {station.personnel_on_duty && station.personnel_on_duty.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-muted">
                              <p className="text-xs text-muted-foreground mb-1">Personnel On Duty:</p>
                              <div className="flex flex-wrap gap-1">
                                {station.personnel_on_duty.map((person, idx) => (
                                  <span key={idx} className="text-xs px-2 py-1 bg-background rounded">
                                    {person.rank} {person.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Apparatus Assignments */}
                          {station.apparatus_assignments && station.apparatus_assignments.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-muted">
                              <p className="text-xs text-muted-foreground mb-2">Apparatus Assignments:</p>
                              <div className="space-y-2">
                                {station.apparatus_assignments.map((app, idx) => (
                                  <div key={idx} className="text-xs">
                                    <span className="font-semibold text-primary">{app.apparatus_name}:</span>
                                    <div className="flex flex-wrap gap-1 mt-1 ml-2">
                                      {app.personnel.map((p, pIdx) => (
                                        <span key={pIdx} className="px-2 py-1 bg-background rounded flex items-center gap-1">
                                          <span className="font-bold text-primary">{p.position}</span>
                                          <span>{p.rank} {p.name}</span>
                                        </span>
                                      ))}
                                      {app.personnel.length === 0 && (
                                        <span className="text-muted-foreground italic">Not assigned</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
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
                    <img src={LOGO_URL} alt="Medina County Fire/EMS" className="h-20 mx-auto mb-3" />
                    <h2 className="font-heading text-2xl uppercase font-bold">
                      Overtime Summary
                    </h2>
                    <p className="text-muted-foreground">
                      {getBattalionName()} - {reportData.start_date} to {reportData.end_date}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Generated by: {user?.name} (Payroll: {user?.payroll_number}) on {new Date().toLocaleString()}
                    </p>
                  </div>

                  {reportData.personnel_overtime?.length > 0 ? (
                    <div className="space-y-2">
                      {reportData.personnel_overtime.map((item, idx) => (
                        <div key={idx} className="p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-semibold">{item.personnel_name || getPersonnelName(item._id)}</span>
                              <span className="text-xs text-muted-foreground ml-2">(Payroll: {item.payroll_number || item._id})</span>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <span>Hours: <strong>{item.total_hours}</strong></span>
                              <span>Entries: <strong>{item.count}</strong></span>
                            </div>
                          </div>
                          {item.approved_by && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Approved by: {item.approved_by_name} (Payroll: {item.approved_by})
                            </p>
                          )}
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
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};
