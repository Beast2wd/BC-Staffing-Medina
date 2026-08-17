import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { 
  Play, 
  RefreshCw, 
  Calendar,
  Sun,
  Thermometer,
  Gift,
  CheckCircle2,
  Users,
  Clock
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

const FEDERAL_HOLIDAYS = [
  { value: "new_years", label: "New Year's Day" },
  { value: "mlk_day", label: "Martin Luther King Day" },
  { value: "presidents_day", label: "Presidents Day" },
  { value: "good_friday", label: "Good Friday" },
  { value: "memorial_day", label: "Memorial Day" },
  { value: "independence_day", label: "Independence Day" },
  { value: "labor_day", label: "Labor Day" },
  { value: "veterans_day", label: "Veteran's Day" },
  { value: "thanksgiving", label: "Thanksgiving Day" },
  { value: "day_after_thanksgiving", label: "Friday after Thanksgiving" },
  { value: "christmas", label: "Christmas Eve and Christmas Day" }
];

export const AccrualProcessingPanel = () => {
  const { api } = useAuth();
  const [processingMonthly, setProcessingMonthly] = useState(false);
  const [processingHoliday, setProcessingHoliday] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState('');
  const [showMonthlyResults, setShowMonthlyResults] = useState(false);
  const [showHolidayResults, setShowHolidayResults] = useState(false);
  const [monthlyResults, setMonthlyResults] = useState(null);
  const [holidayResults, setHolidayResults] = useState(null);

  const handleProcessMonthlyAccrual = async () => {
    try {
      setProcessingMonthly(true);
      const response = await api.post('/pto-settings/process-monthly-accrual');
      setMonthlyResults(response.data);
      setShowMonthlyResults(true);
      toast.success(`Monthly accrual processed for ${response.data.summary.total_personnel} personnel`);
    } catch (error) {
      console.error('Failed to process monthly accrual:', error);
      toast.error(error.response?.data?.detail || 'Failed to process monthly accrual');
    } finally {
      setProcessingMonthly(false);
    }
  };

  const handleProcessHolidayAccrual = async () => {
    if (!selectedHoliday) {
      toast.error('Please select a holiday');
      return;
    }
    
    const holidayLabel = FEDERAL_HOLIDAYS.find(h => h.value === selectedHoliday)?.label || selectedHoliday;
    
    try {
      setProcessingHoliday(true);
      const response = await api.post(`/pto-settings/process-holiday-accrual?holiday_name=${encodeURIComponent(holidayLabel)}`);
      setHolidayResults(response.data);
      setShowHolidayResults(true);
      toast.success(`Holiday accrual processed for ${response.data.summary.total_personnel} personnel`);
    } catch (error) {
      console.error('Failed to process holiday accrual:', error);
      toast.error(error.response?.data?.detail || 'Failed to process holiday accrual');
    } finally {
      setProcessingHoliday(false);
    }
  };

  return (
    <>
      <Card className="border-amber-200 dark:border-amber-900">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Play className="h-5 w-5 text-amber-600" />
            Accrual Processing
          </CardTitle>
          <CardDescription>
            Process monthly vacation/sick accrual or holiday accrual for all active personnel
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Monthly Accrual */}
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  Monthly Accrual
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Process vacation and sick time accrual based on P-021 rates
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-xs">
                  <Sun className="h-3 w-3 mr-1" /> Vacation
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <Thermometer className="h-3 w-3 mr-1" /> Sick
                </Badge>
              </div>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1 pl-4">
              <li>• Calculates accrual based on years of service tier</li>
              <li>• Respects rollover caps (Ops: 240hr vacation, Admin: 120hr)</li>
              <li>• Applies 6-month waiting period for new hire vacation</li>
              <li>• Sick cap: 1,080 hours maximum</li>
            </ul>
            <Button 
              onClick={handleProcessMonthlyAccrual}
              disabled={processingMonthly}
              className="w-full"
              data-testid="process-monthly-accrual-btn"
            >
              {processingMonthly ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Process Monthly Accrual
                </>
              )}
            </Button>
          </div>

          {/* Holiday Accrual */}
          <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium flex items-center gap-2">
                  <Gift className="h-4 w-4 text-green-600" />
                  Holiday Accrual
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Credit holiday hours when a federal holiday occurs
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                Ops: 12 hrs | Admin: 8 hrs
              </Badge>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Select Holiday</Label>
              <Select value={selectedHoliday} onValueChange={setSelectedHoliday}>
                <SelectTrigger data-testid="holiday-select">
                  <SelectValue placeholder="Select a holiday..." />
                </SelectTrigger>
                <SelectContent>
                  {FEDERAL_HOLIDAYS.map((holiday) => (
                    <SelectItem key={holiday.value} value={holiday.value}>
                      {holiday.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleProcessHolidayAccrual}
              disabled={processingHoliday || !selectedHoliday}
              variant="outline"
              className="w-full border-green-300 hover:bg-green-100"
              data-testid="process-holiday-accrual-btn"
            >
              {processingHoliday ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Gift className="h-4 w-4 mr-2" />
                  Process Holiday Accrual
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Results Dialog */}
      <Dialog open={showMonthlyResults} onOpenChange={setShowMonthlyResults}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Monthly Accrual Processed
            </DialogTitle>
            <DialogDescription>
              Processed on {monthlyResults?.process_date}
            </DialogDescription>
          </DialogHeader>
          
          {monthlyResults && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-muted text-center">
                  <Users className="h-5 w-5 mx-auto text-primary" />
                  <p className="text-2xl font-bold">{monthlyResults.summary.total_personnel}</p>
                  <p className="text-xs text-muted-foreground">Personnel</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 text-center">
                  <Sun className="h-5 w-5 mx-auto text-blue-600" />
                  <p className="text-2xl font-bold text-blue-700">{monthlyResults.summary.total_vacation_accrued}</p>
                  <p className="text-xs text-muted-foreground">Vacation Hrs</p>
                </div>
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 text-center">
                  <Thermometer className="h-5 w-5 mx-auto text-red-600" />
                  <p className="text-2xl font-bold text-red-700">{monthlyResults.summary.total_sick_accrued}</p>
                  <p className="text-xs text-muted-foreground">Sick Hrs</p>
                </div>
              </div>

              {/* Personnel List */}
              <div className="border rounded-lg max-h-60 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-right">Vacation</th>
                      <th className="px-3 py-2 text-right">Sick</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyResults.personnel_processed.map((p, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-3 py-2">
                          <span className="font-medium">{p.name}</span>
                          <span className="text-muted-foreground text-xs ml-1">({p.payroll_number})</span>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-xs">
                            {p.personnel_type}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {p.vacation_eligible ? (
                            <span className="text-blue-600">+{p.vacation_accrued} → {p.vacation_new_balance}</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">Waiting period</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-red-600">
                          +{p.sick_accrued} → {p.sick_new_balance}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setShowMonthlyResults(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Holiday Results Dialog */}
      <Dialog open={showHolidayResults} onOpenChange={setShowHolidayResults}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Holiday Accrual Processed
            </DialogTitle>
            <DialogDescription>
              {holidayResults?.holiday_name} - {holidayResults?.process_date}
            </DialogDescription>
          </DialogHeader>
          
          {holidayResults && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted text-center">
                  <Users className="h-5 w-5 mx-auto text-primary" />
                  <p className="text-2xl font-bold">{holidayResults.summary.total_personnel}</p>
                  <p className="text-xs text-muted-foreground">Personnel</p>
                </div>
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 text-center">
                  <Gift className="h-5 w-5 mx-auto text-green-600" />
                  <p className="text-2xl font-bold text-green-700">{holidayResults.summary.total_holiday_hours_accrued}</p>
                  <p className="text-xs text-muted-foreground">Total Holiday Hrs</p>
                </div>
              </div>

              {/* Personnel List */}
              <div className="border rounded-lg max-h-60 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-right">Accrued</th>
                      <th className="px-3 py-2 text-right">New Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holidayResults.personnel_processed.map((p, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-3 py-2">
                          <span className="font-medium">{p.name}</span>
                          <span className="text-muted-foreground text-xs ml-1">({p.payroll_number})</span>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-xs">
                            {p.personnel_type}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right text-green-600">
                          +{p.holiday_accrued} hrs
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {p.holiday_new_balance} hrs
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setShowHolidayResults(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AccrualProcessingPanel;
