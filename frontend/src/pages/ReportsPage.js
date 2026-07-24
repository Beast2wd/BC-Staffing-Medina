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
import { formatDisplayDate, formatDateRange } from '../utils/dateUtils';

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
      } else if (reportType === 'volunteer-hours') {
        response = await api.get('/reports/volunteer-hours', {
          params: {
            start_date: startDate,
            end_date: endDate,
            battalion_id: selectedBattalion
          }
        });
      } else if (reportType === 'time-off') {
        const year = new Date(startDate).getFullYear();
        response = await api.get('/reports/time-off-summary', {
          params: {
            year: year,
            battalion_id: selectedBattalion
          }
        });
      } else if (reportType === 'deployment') {
        response = await api.get('/reports/deployment-summary', {
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
    
    // Determine report title based on type
    const getReportTitle = () => {
      switch(reportType) {
        case 'daily': return 'Daily Staffing Summary';
        case 'overtime': return 'Overtime Summary';
        case 'deployment': return 'Deployment Summary';
        case 'volunteer-hours': return 'Volunteer Hours Summary';
        case 'time-off': return 'Time Off Summary';
        default: return 'Report';
      }
    };
    
    // Get date range display
    const getDateDisplay = () => {
      if (reportType === 'daily') {
        return reportData.date;
      }
      if (reportType === 'time-off') {
        return `Year ${reportData.year}`;
      }
      return `${reportData.start_date} to ${reportData.end_date}`;
    };
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Medina County BC Staffing - ${getReportTitle()}</title>
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
            .stat-box .orange { color: #f97316; }
            .section { margin-bottom: 25px; }
            .section h2 {
              font-size: 16px;
              text-transform: uppercase;
              border-bottom: 1px solid #ddd;
              padding-bottom: 8px;
              margin-bottom: 15px;
            }
            .station-row, .volunteer-row {
              display: flex;
              justify-content: space-between;
              padding: 10px;
              border-bottom: 1px solid #eee;
            }
            .station-row:nth-child(even), .volunteer-row:nth-child(even) { background: #f9f9f9; }
            .station-name, .volunteer-name { font-weight: bold; }
            .station-stats, .volunteer-stats { display: flex; gap: 20px; }
            .positive { color: #22c55e; }
            .negative { color: #ef4444; }
            .orange { color: #f97316; }
            .volunteer-card {
              border: 1px solid #ddd;
              padding: 15px;
              margin-bottom: 15px;
              border-radius: 4px;
            }
            .volunteer-card h3 {
              font-size: 16px;
              margin-bottom: 10px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .monthly-grid {
              display: grid;
              grid-template-columns: repeat(6, 1fr);
              gap: 10px;
              margin: 15px 0;
            }
            .month-box {
              border: 1px solid #ddd;
              padding: 10px;
              text-align: center;
              border-radius: 4px;
              background: #f9f9f9;
            }
            .month-box .month-name {
              font-size: 11px;
              color: #666;
            }
            .month-box .hours {
              font-size: 18px;
              font-weight: bold;
              color: #22c55e;
            }
            .month-box .shifts {
              font-size: 10px;
              color: #666;
            }
            .shift-list {
              font-size: 12px;
              color: #666;
              margin-top: 10px;
              padding-top: 10px;
              border-top: 1px solid #eee;
            }
            .shift-item {
              display: flex;
              justify-content: space-between;
              padding: 5px 0;
            }
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
            <h1>${getReportTitle()}</h1>
            <p>${getBattalionName()} - ${getDateDisplay()}</p>
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
          ` : reportType === 'overtime' ? `
            <div class="stats-grid" style="grid-template-columns: repeat(3, 1fr);">
              <div class="stat-box">
                <div class="value" style="color: #3b82f6;">${reportData.personnel_overtime?.length || 0}</div>
                <div class="label">Total Personnel</div>
              </div>
              <div class="stat-box">
                <div class="value positive">${reportData.personnel_overtime?.reduce((sum, p) => sum + (p.total_hours || 0), 0) || 0}</div>
                <div class="label">Total OT Hours</div>
              </div>
              <div class="stat-box">
                <div class="value">${reportData.personnel_overtime?.reduce((sum, p) => sum + (p.count || 0), 0) || 0}</div>
                <div class="label">Total OT Entries</div>
              </div>
            </div>
            
            <div class="section">
              <h2>Personnel Overtime Breakdown</h2>
              ${reportData.personnel_overtime?.length > 0 ? 
                reportData.personnel_overtime.map(item => `
                  <div class="volunteer-card" style="border-color: #3b82f6;">
                    <h3>
                      <span>${item.personnel_name || 'Emp #: ' + item._id}</span>
                      <span>
                        <span style="color:#22c55e">${item.total_hours}h</span> | 
                        <span style="color:#3b82f6">${item.count} entries</span>
                      </span>
                    </h3>
                    ${item.approved_by ? `<p style="font-size:11px;color:#666;margin-bottom:10px;">Approved by: ${item.approved_by_name} (Emp #: ${item.approved_by})</p>` : ''}
                    
                    ${item.work_history?.length > 0 ? `
                      <div style="margin-top:10px;padding-top:10px;border-top:1px solid #eee;">
                        <div style="font-size:12px;font-weight:bold;margin-bottom:8px;">Work History:</div>
                        <table style="width:100%;font-size:12px;border-collapse:collapse;">
                          <thead>
                            <tr style="background:#f5f5f5;">
                              <th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;">Date</th>
                              <th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;">Shift</th>
                              <th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;">Station</th>
                              <th style="text-align:center;padding:6px;border-bottom:1px solid #ddd;">Hours</th>
                              <th style="text-align:center;padding:6px;border-bottom:1px solid #ddd;">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${item.work_history.map(entry => `
                              <tr>
                                <td style="padding:6px;border-bottom:1px solid #eee;">${entry.date}</td>
                                <td style="padding:6px;border-bottom:1px solid #eee;">${entry.shift}</td>
                                <td style="padding:6px;border-bottom:1px solid #eee;">${entry.station}</td>
                                <td style="text-align:center;padding:6px;border-bottom:1px solid #eee;font-weight:bold;">${entry.hours}h</td>
                                <td style="text-align:center;padding:6px;border-bottom:1px solid #eee;">
                                  <span style="padding:2px 8px;border-radius:4px;font-size:10px;${
                                    entry.status === 'assigned' ? 'background:#dcfce7;color:#16a34a;' :
                                    entry.status === 'available' ? 'background:#fef9c3;color:#ca8a04;' :
                                    entry.status === 'declined' ? 'background:#fee2e2;color:#dc2626;' :
                                    'background:#f3f4f6;color:#6b7280;'
                                  }">${entry.status}</span>
                                </td>
                              </tr>
                            `).join('')}
                          </tbody>
                        </table>
                      </div>
                    ` : ''}
                  </div>
                `).join('') : 
                '<p style="text-align:center;color:#666;padding:20px;">No overtime records found</p>'
              }
            </div>
          ` : reportType === 'volunteer-hours' ? `
            <div class="stats-grid">
              <div class="stat-box">
                <div class="value orange">${reportData.volunteer_count || 0}</div>
                <div class="label">Total Volunteers</div>
              </div>
              <div class="stat-box">
                <div class="value">${reportData.total_shifts || 0}</div>
                <div class="label">Total Shifts</div>
              </div>
              <div class="stat-box">
                <div class="value">${reportData.total_hours_scheduled || 0}</div>
                <div class="label">Hours Scheduled</div>
              </div>
              <div class="stat-box">
                <div class="value positive">${reportData.total_hours_worked || 0}</div>
                <div class="label">Hours Worked</div>
              </div>
            </div>
            
            <div class="section">
              <h2>Volunteer Breakdown</h2>
              ${reportData.volunteer_hours?.length > 0 ? 
                reportData.volunteer_hours.map(vol => `
                  <div class="volunteer-card">
                    <h3>
                      <span>${vol.volunteer_name} ${vol.contact_phone ? '(' + vol.contact_phone + ')' : ''}</span>
                      <span>
                        <span style="color:#3b82f6">${vol.shifts_count} shifts</span> | 
                        <span style="color:#22c55e">${vol.total_hours_worked}h period</span> | 
                        <span style="color:#f97316">${vol.ytd_hours || 0}h YTD</span>
                      </span>
                    </h3>
                    
                    ${vol.monthly_breakdown?.length > 0 ? `
                      <div style="margin-bottom:10px;font-weight:bold;font-size:12px;">Monthly Breakdown:</div>
                      <div class="monthly-grid">
                        ${vol.monthly_breakdown.map(month => {
                          const monthDate = new Date(month.month + '-01');
                          const monthName = monthDate.toLocaleString('default', { month: 'short', year: 'numeric' });
                          return `
                            <div class="month-box">
                              <div class="month-name">${monthName}</div>
                              <div class="hours">${month.hours_worked}h</div>
                              <div class="shifts">${month.shifts_count} shift${month.shifts_count !== 1 ? 's' : ''}</div>
                            </div>
                          `;
                        }).join('')}
                      </div>
                    ` : ''}
                    
                    ${vol.shifts?.length > 0 ? `
                      <div class="shift-list">
                        <strong>Shift Details:</strong>
                        ${vol.shifts.map(shift => `
                          <div class="shift-item">
                            <span>${shift.date} - ${shift.shift} Shift</span>
                            <span>${shift.station} (${shift.hours_worked}h)</span>
                          </div>
                        `).join('')}
                      </div>
                    ` : ''}
                  </div>
                `).join('') : 
                '<p style="text-align:center;color:#666;padding:20px;">No volunteer records found</p>'
              }
            </div>
          ` : reportType === 'time-off' ? `
            <div class="stats-grid" style="grid-template-columns: repeat(3, 1fr);">
              <div class="stat-box">
                <div class="value" style="color: #ef4444;">${reportData.sick?.ytd_total || 0}</div>
                <div class="label">Sick Days (YTD)</div>
              </div>
              <div class="stat-box">
                <div class="value" style="color: #3b82f6;">${reportData.vacation?.ytd_total || 0}</div>
                <div class="label">Vacation Days (YTD)</div>
              </div>
              <div class="stat-box">
                <div class="value" style="color: #22c55e;">${reportData.holiday?.ytd_total || 0}</div>
                <div class="label">Holiday Days (YTD)</div>
              </div>
            </div>
            
            <div class="section">
              <h2 style="color: #ef4444;">Sick Leave Summary</h2>
              <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
                <thead>
                  <tr style="background:#fef2f2;">
                    <th style="padding:8px;border:1px solid #fecaca;text-align:left;">Month</th>
                    <th style="padding:8px;border:1px solid #fecaca;text-align:center;">Days Used</th>
                    <th style="padding:8px;border:1px solid #fecaca;text-align:left;">Personnel</th>
                  </tr>
                </thead>
                <tbody>
                  ${reportData.sick?.monthly?.map(month => `
                    <tr>
                      <td style="padding:8px;border:1px solid #fee2e2;">${month.month}</td>
                      <td style="padding:8px;border:1px solid #fee2e2;text-align:center;font-weight:bold;">${month.count}</td>
                      <td style="padding:8px;border:1px solid #fee2e2;font-size:12px;">
                        ${month.personnel?.length > 0 ? month.personnel.map(p => p.name).join(', ') : '-'}
                      </td>
                    </tr>
                  `).join('') || ''}
                </tbody>
              </table>
              
              <h2 style="color: #3b82f6;">Vacation Leave Summary</h2>
              <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
                <thead>
                  <tr style="background:#eff6ff;">
                    <th style="padding:8px;border:1px solid #bfdbfe;text-align:left;">Month</th>
                    <th style="padding:8px;border:1px solid #bfdbfe;text-align:center;">Days Used</th>
                    <th style="padding:8px;border:1px solid #bfdbfe;text-align:left;">Personnel</th>
                  </tr>
                </thead>
                <tbody>
                  ${reportData.vacation?.monthly?.map(month => `
                    <tr>
                      <td style="padding:8px;border:1px solid #dbeafe;">${month.month}</td>
                      <td style="padding:8px;border:1px solid #dbeafe;text-align:center;font-weight:bold;">${month.count}</td>
                      <td style="padding:8px;border:1px solid #dbeafe;font-size:12px;">
                        ${month.personnel?.length > 0 ? month.personnel.map(p => p.name).join(', ') : '-'}
                      </td>
                    </tr>
                  `).join('') || ''}
                </tbody>
              </table>
              
              <h2 style="color: #22c55e;">Holiday Leave Summary</h2>
              <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
                <thead>
                  <tr style="background:#f0fdf4;">
                    <th style="padding:8px;border:1px solid #bbf7d0;text-align:left;">Month</th>
                    <th style="padding:8px;border:1px solid #bbf7d0;text-align:center;">Days Used</th>
                    <th style="padding:8px;border:1px solid #bbf7d0;text-align:left;">Personnel</th>
                  </tr>
                </thead>
                <tbody>
                  ${reportData.holiday?.monthly?.map(month => `
                    <tr>
                      <td style="padding:8px;border:1px solid #dcfce7;">${month.month}</td>
                      <td style="padding:8px;border:1px solid #dcfce7;text-align:center;font-weight:bold;">${month.count}</td>
                      <td style="padding:8px;border:1px solid #dcfce7;font-size:12px;">
                        ${month.personnel?.length > 0 ? month.personnel.map(p => p.name).join(', ') : '-'}
                      </td>
                    </tr>
                  `).join('') || ''}
                </tbody>
              </table>
            </div>
          ` : reportType === 'deployment' ? `
            <div class="stats-grid" style="grid-template-columns: repeat(4, 1fr);">
              <div class="stat-box">
                <div class="value">${reportData.total_deployments || 0}</div>
                <div class="label">Total Deployments</div>
              </div>
              <div class="stat-box">
                <div class="value" style="color: #ef4444;">${reportData.tifmas_deployments || 0}</div>
                <div class="label">TIFMAS</div>
              </div>
              <div class="stat-box">
                <div class="value" style="color: #3b82f6;">${reportData.emtf_deployments || 0}</div>
                <div class="label">EMTF</div>
              </div>
              <div class="stat-box">
                <div class="value" style="color: #22c55e;">${reportData.unique_personnel_deployed || 0}</div>
                <div class="label">Personnel Deployed</div>
              </div>
            </div>
            
            <div class="stats-grid" style="grid-template-columns: repeat(2, 1fr); margin-top: 10px;">
              <div class="stat-box">
                <div class="value">${reportData.total_deployment_days || 0}</div>
                <div class="label">Total Deployment Days</div>
              </div>
              <div class="stat-box">
                <div class="value">${reportData.other_deployments || 0}</div>
                <div class="label">Other Deployments</div>
              </div>
            </div>
            
            <div class="section">
              <h2>Deployment Details</h2>
              ${reportData.deployments?.length > 0 ? `
                <table style="width:100%;border-collapse:collapse;">
                  <thead>
                    <tr style="background:#f1f5f9;">
                      <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Type</th>
                      <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Personnel</th>
                      <th style="padding:8px;border:1px solid #e2e8f0;text-align:center;">Start Date</th>
                      <th style="padding:8px;border:1px solid #e2e8f0;text-align:center;">End Date</th>
                      <th style="padding:8px;border:1px solid #e2e8f0;text-align:center;">Status</th>
                      <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${reportData.deployments.map(dep => `
                      <tr>
                        <td style="padding:8px;border:1px solid #e2e8f0;font-weight:bold;color:${dep.deployment_type?.includes('TIFMAS') ? '#ef4444' : '#3b82f6'};">${dep.deployment_type || '-'}</td>
                        <td style="padding:8px;border:1px solid #e2e8f0;">${dep.personnel_name || '-'}</td>
                        <td style="padding:8px;border:1px solid #e2e8f0;text-align:center;">${dep.start_date || '-'}</td>
                        <td style="padding:8px;border:1px solid #e2e8f0;text-align:center;">${dep.end_date || '-'}</td>
                        <td style="padding:8px;border:1px solid #e2e8f0;text-align:center;">
                          <span style="padding:2px 8px;border-radius:4px;font-size:11px;background:${dep.status === 'active' ? '#dcfce7' : '#f1f5f9'};color:${dep.status === 'active' ? '#166534' : '#475569'};">
                            ${dep.status || 'N/A'}
                          </span>
                        </td>
                        <td style="padding:8px;border:1px solid #e2e8f0;font-size:12px;">${dep.notes || '-'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : '<p style="text-align:center;color:#666;padding:20px;">No deployments found for this date range</p>'}
            </div>
          ` : ''}
          
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
                    <SelectItem value="deployment">Deployment Summary</SelectItem>
                    <SelectItem value="volunteer-hours">Volunteer Hours Summary</SelectItem>
                    <SelectItem value="time-off">Time Off Summary</SelectItem>
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

              {(reportType === 'overtime' || reportType === 'volunteer-hours' || reportType === 'deployment') && (
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
                      {getBattalionName()} - {formatDisplayDate(reportData.date)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Generated by: {user?.name} (Emp #: {user?.payroll_number}) on {new Date().toLocaleString()}
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
              ) : reportType === 'overtime' ? (
                <div className="space-y-6">
                  {/* Overtime Summary Header */}
                  <div className="text-center pb-4 border-b">
                    <img src={LOGO_URL} alt="Medina County Fire/EMS" className="h-20 mx-auto mb-3" />
                    <h2 className="font-heading text-2xl uppercase font-bold">
                      Overtime Summary
                    </h2>
                    <p className="text-muted-foreground">
                      {getBattalionName()} - {formatDateRange(reportData.start_date, reportData.end_date)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Generated by: {user?.name} (Emp #: {user?.payroll_number}) on {new Date().toLocaleString()}
                    </p>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-muted rounded-lg text-center">
                      <p className="text-2xl font-bold text-blue-500">{reportData.personnel_overtime?.length || 0}</p>
                      <p className="text-xs text-muted-foreground">Total Personnel</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg text-center">
                      <p className="text-2xl font-bold text-green-500">
                        {reportData.personnel_overtime?.reduce((sum, p) => sum + (p.total_hours || 0), 0) || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Total OT Hours</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg text-center">
                      <p className="text-2xl font-bold">
                        {reportData.personnel_overtime?.reduce((sum, p) => sum + (p.count || 0), 0) || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Total OT Entries</p>
                    </div>
                  </div>

                  {reportData.personnel_overtime?.length > 0 ? (
                    <div className="space-y-4">
                      <h3 className="font-heading text-lg uppercase">Personnel Overtime Breakdown</h3>
                      {reportData.personnel_overtime.map((item, idx) => (
                        <div key={idx} className="p-4 bg-muted/50 rounded-lg border border-blue-500/20">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <span className="font-semibold text-lg">{item.personnel_name || getPersonnelName(item._id)}</span>
                              <span className="text-xs text-muted-foreground ml-2">(Emp #: {item.payroll_number || item._id})</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-center">
                                <p className="text-xl font-bold text-green-500">{item.total_hours}</p>
                                <p className="text-xs text-muted-foreground">Hours</p>
                              </div>
                              <div className="text-center">
                                <p className="text-xl font-bold text-blue-500">{item.count}</p>
                                <p className="text-xs text-muted-foreground">Entries</p>
                              </div>
                            </div>
                          </div>
                          {item.approved_by && (
                            <p className="text-xs text-muted-foreground mb-2">
                              Approved by: {item.approved_by_name} (Emp #: {item.approved_by})
                            </p>
                          )}
                          
                          {/* Work History */}
                          {item.work_history?.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-muted">
                              <p className="text-xs text-muted-foreground mb-2 font-semibold">Work History:</p>
                              <div className="space-y-1">
                                {item.work_history.map((entry, eIdx) => (
                                  <div key={eIdx} className="flex items-center justify-between text-sm p-2 bg-background rounded">
                                    <div className="flex items-center gap-3">
                                      <span className="font-medium">{formatDisplayDate(entry.date)}</span>
                                      <span className="text-muted-foreground">{entry.shift} Shift</span>
                                      <span className="text-muted-foreground">{entry.station}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="font-semibold">{entry.hours}h</span>
                                      <span className={`text-xs px-2 py-0.5 rounded ${
                                        entry.status === 'assigned' ? 'bg-green-500/20 text-green-500' :
                                        entry.status === 'available' ? 'bg-yellow-500/20 text-yellow-500' :
                                        entry.status === 'declined' ? 'bg-red-500/20 text-red-500' :
                                        'bg-muted text-muted-foreground'
                                      }`}>
                                        {entry.status}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
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
              ) : reportType === 'volunteer-hours' ? (
                <div className="space-y-6">
                  {/* Volunteer Hours Summary Header */}
                  <div className="text-center pb-4 border-b">
                    <img src={LOGO_URL} alt="Medina County Fire/EMS" className="h-20 mx-auto mb-3" />
                    <h2 className="font-heading text-2xl uppercase font-bold">
                      Volunteer Hours Summary
                    </h2>
                    <p className="text-muted-foreground">
                      {getBattalionName()} - {formatDateRange(reportData.start_date, reportData.end_date)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Generated by: {user?.name} (Emp #: {user?.payroll_number}) on {new Date().toLocaleString()}
                    </p>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-muted rounded-lg text-center">
                      <p className="text-2xl font-bold text-orange-500">{reportData.volunteer_count || 0}</p>
                      <p className="text-xs text-muted-foreground">Total Volunteers</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg text-center">
                      <p className="text-2xl font-bold text-blue-500">{reportData.total_shifts || 0}</p>
                      <p className="text-xs text-muted-foreground">Total Shifts</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg text-center">
                      <p className="text-2xl font-bold">{reportData.total_hours_scheduled || 0}</p>
                      <p className="text-xs text-muted-foreground">Hours Scheduled</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg text-center">
                      <p className="text-2xl font-bold text-green-500">{reportData.total_hours_worked || 0}</p>
                      <p className="text-xs text-muted-foreground">Hours Worked</p>
                    </div>
                  </div>

                  {/* Volunteer Details */}
                  {reportData.volunteer_hours?.length > 0 ? (
                    <div className="space-y-3">
                      <h3 className="font-heading text-lg uppercase">Volunteer Breakdown</h3>
                      {reportData.volunteer_hours.map((vol, idx) => (
                        <div key={idx} className="p-4 bg-muted/50 rounded-lg border border-orange-500/20">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <span className="font-semibold text-lg">{vol.volunteer_name}</span>
                              {vol.contact_phone && (
                                <span className="text-xs text-muted-foreground ml-2">({vol.contact_phone})</span>
                              )}
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-center">
                                <p className="text-xl font-bold text-blue-500">{vol.shifts_count}</p>
                                <p className="text-xs text-muted-foreground">Shifts</p>
                              </div>
                              <div className="text-center">
                                <p className="text-xl font-bold text-green-500">{vol.total_hours_worked}</p>
                                <p className="text-xs text-muted-foreground">Period Hours</p>
                              </div>
                              <div className="text-center">
                                <p className="text-xl font-bold text-orange-500">{vol.ytd_hours || 0}</p>
                                <p className="text-xs text-muted-foreground">YTD Hours</p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Monthly Breakdown */}
                          {vol.monthly_breakdown?.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-muted">
                              <p className="text-xs text-muted-foreground mb-2 font-semibold">Monthly Breakdown:</p>
                              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-3">
                                {vol.monthly_breakdown.map((month, mIdx) => {
                                  const monthDate = new Date(month.month + '-01');
                                  const monthName = monthDate.toLocaleString('default', { month: 'short', year: 'numeric' });
                                  return (
                                    <div key={mIdx} className="p-2 bg-background rounded text-center">
                                      <p className="text-xs text-muted-foreground">{monthName}</p>
                                      <p className="text-lg font-bold text-green-500">{month.hours_worked}h</p>
                                      <p className="text-xs text-muted-foreground">{month.shifts_count} shift{month.shifts_count !== 1 ? 's' : ''}</p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {/* Shift Details */}
                          {vol.shifts?.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-muted">
                              <p className="text-xs text-muted-foreground mb-2">Shift Details:</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {vol.shifts.map((shift, sIdx) => (
                                  <div key={sIdx} className="flex items-center justify-between text-sm p-2 bg-background rounded">
                                    <span>{formatDisplayDate(shift.date)} - {shift.shift} Shift</span>
                                    <span className="text-muted-foreground">{shift.station} ({shift.hours_worked}h)</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      No volunteer records found for this period
                    </p>
                  )}
                </div>
              ) : reportType === 'time-off' ? (
                <div className="space-y-6">
                  {/* Time Off Summary Header */}
                  <div className="text-center pb-4 border-b">
                    <img src={LOGO_URL} alt="Medina County Fire/EMS" className="h-20 mx-auto mb-3" />
                    <h2 className="font-heading text-2xl uppercase font-bold">
                      Time Off Summary
                    </h2>
                    <p className="text-muted-foreground">
                      {getBattalionName()} - Year {reportData.year}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Generated by: {user?.name} (Emp #: {user?.payroll_number}) on {new Date().toLocaleString()}
                    </p>
                  </div>

                  {/* YTD Totals */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-center">
                      <p className="text-3xl font-bold text-red-500">{reportData.sick?.ytd_total || 0}</p>
                      <p className="text-sm text-muted-foreground">Sick Days (YTD)</p>
                    </div>
                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-center">
                      <p className="text-3xl font-bold text-blue-500">{reportData.vacation?.ytd_total || 0}</p>
                      <p className="text-sm text-muted-foreground">Vacation Days (YTD)</p>
                    </div>
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
                      <p className="text-3xl font-bold text-green-500">{reportData.holiday?.ytd_total || 0}</p>
                      <p className="text-sm text-muted-foreground">Holiday Days (YTD)</p>
                    </div>
                  </div>

                  {/* Sick Leave Monthly Breakdown */}
                  <div className="space-y-3">
                    <h3 className="font-heading text-lg uppercase text-red-500 flex items-center gap-2">
                      <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                      Sick Leave
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-red-500/20 bg-red-500/5">
                            <th className="text-left p-3 font-semibold">Month</th>
                            <th className="text-center p-3 font-semibold">Days Used</th>
                            <th className="text-left p-3 font-semibold">Personnel</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.sick?.monthly?.map((month, idx) => (
                            <tr key={idx} className="border-b border-muted hover:bg-muted/30">
                              <td className="p-3 font-medium">{month.month}</td>
                              <td className="p-3 text-center font-bold text-red-500">{month.count}</td>
                              <td className="p-3 text-muted-foreground text-xs">
                                {month.personnel?.length > 0 
                                  ? month.personnel.map(p => p.name).join(', ') 
                                  : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Vacation Leave Monthly Breakdown */}
                  <div className="space-y-3">
                    <h3 className="font-heading text-lg uppercase text-blue-500 flex items-center gap-2">
                      <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                      Vacation Leave
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-blue-500/20 bg-blue-500/5">
                            <th className="text-left p-3 font-semibold">Month</th>
                            <th className="text-center p-3 font-semibold">Days Used</th>
                            <th className="text-left p-3 font-semibold">Personnel</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.vacation?.monthly?.map((month, idx) => (
                            <tr key={idx} className="border-b border-muted hover:bg-muted/30">
                              <td className="p-3 font-medium">{month.month}</td>
                              <td className="p-3 text-center font-bold text-blue-500">{month.count}</td>
                              <td className="p-3 text-muted-foreground text-xs">
                                {month.personnel?.length > 0 
                                  ? month.personnel.map(p => p.name).join(', ') 
                                  : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Holiday Leave Monthly Breakdown */}
                  <div className="space-y-3">
                    <h3 className="font-heading text-lg uppercase text-green-500 flex items-center gap-2">
                      <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                      Holiday Leave
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-green-500/20 bg-green-500/5">
                            <th className="text-left p-3 font-semibold">Month</th>
                            <th className="text-center p-3 font-semibold">Days Used</th>
                            <th className="text-left p-3 font-semibold">Personnel</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.holiday?.monthly?.map((month, idx) => (
                            <tr key={idx} className="border-b border-muted hover:bg-muted/30">
                              <td className="p-3 font-medium">{month.month}</td>
                              <td className="p-3 text-center font-bold text-green-500">{month.count}</td>
                              <td className="p-3 text-muted-foreground text-xs">
                                {month.personnel?.length > 0 
                                  ? month.personnel.map(p => p.name).join(', ') 
                                  : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : reportType === 'deployment' ? (
                <div className="space-y-6">
                  {/* Deployment Summary Header */}
                  <div className="text-center pb-4 border-b">
                    <img src={LOGO_URL} alt="Medina County Fire/EMS" className="h-20 mx-auto mb-3" />
                    <h2 className="font-heading text-2xl uppercase font-bold">
                      Deployment Summary
                    </h2>
                    <p className="text-muted-foreground">
                      {getBattalionName()} - {formatDateRange(reportData.start_date, reportData.end_date)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Generated by: {user?.name} (Emp #: {user?.payroll_number}) on {new Date().toLocaleString()}
                    </p>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-muted/30 border rounded-lg text-center">
                      <p className="text-3xl font-bold">{reportData.total_deployments || 0}</p>
                      <p className="text-sm text-muted-foreground">Total Deployments</p>
                    </div>
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-center">
                      <p className="text-3xl font-bold text-red-500">{reportData.tifmas_deployments || 0}</p>
                      <p className="text-sm text-muted-foreground">TIFMAS</p>
                    </div>
                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-center">
                      <p className="text-3xl font-bold text-blue-500">{reportData.emtf_deployments || 0}</p>
                      <p className="text-sm text-muted-foreground">EMTF</p>
                    </div>
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
                      <p className="text-3xl font-bold text-green-500">{reportData.unique_personnel_deployed || 0}</p>
                      <p className="text-sm text-muted-foreground">Personnel Deployed</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-muted/30 border rounded-lg text-center">
                      <p className="text-2xl font-bold">{reportData.total_deployment_days || 0}</p>
                      <p className="text-sm text-muted-foreground">Total Deployment Days</p>
                    </div>
                    <div className="p-4 bg-muted/30 border rounded-lg text-center">
                      <p className="text-2xl font-bold">{reportData.other_deployments || 0}</p>
                      <p className="text-sm text-muted-foreground">Other Deployments</p>
                    </div>
                  </div>

                  {/* Deployment Details Table */}
                  <div className="space-y-3">
                    <h3 className="font-heading text-lg uppercase flex items-center gap-2">
                      Deployment Details
                    </h3>
                    {reportData.deployments?.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/30">
                              <th className="text-left p-3 font-semibold">Type</th>
                              <th className="text-left p-3 font-semibold">Personnel</th>
                              <th className="text-center p-3 font-semibold">Start Date</th>
                              <th className="text-center p-3 font-semibold">End Date</th>
                              <th className="text-center p-3 font-semibold">Status</th>
                              <th className="text-left p-3 font-semibold">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.deployments.map((dep, idx) => (
                              <tr key={idx} className="border-b border-muted hover:bg-muted/30">
                                <td className={`p-3 font-bold ${dep.deployment_type?.includes('TIFMAS') ? 'text-red-500' : 'text-blue-500'}`}>
                                  {dep.deployment_type || '-'}
                                </td>
                                <td className="p-3">{dep.personnel_name || '-'}</td>
                                <td className="p-3 text-center">{dep.start_date || '-'}</td>
                                <td className="p-3 text-center">{dep.end_date || '-'}</td>
                                <td className="p-3 text-center">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    dep.status === 'active' 
                                      ? 'bg-green-500/20 text-green-500' 
                                      : 'bg-muted text-muted-foreground'
                                  }`}>
                                    {dep.status || 'N/A'}
                                  </span>
                                </td>
                                <td className="p-3 text-muted-foreground text-xs">{dep.notes || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        No deployments found for this date range
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};
