import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { 
  Sun, 
  Thermometer, 
  Gift, 
  Clock, 
  Calendar,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

export const PersonnelAccrualRates = ({ personnelId }) => {
  const { api } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (personnelId) {
      fetchRates();
    }
  }, [personnelId]);

  const fetchRates = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/pto-settings/personnel/${personnelId}/all-rates`);
      setRates(response.data);
    } catch (err) {
      console.error('Failed to fetch accrual rates:', err);
      setError('Failed to load accrual rates');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center justify-center">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !rates) {
    return (
      <Card>
        <CardContent className="p-4 text-center text-muted-foreground text-sm">
          {error || 'No accrual data available'}
        </CardContent>
      </Card>
    );
  }

  const formatBalance = (balance, allowNegative) => {
    const isNegative = balance < 0;
    return (
      <span className={isNegative ? 'text-red-600 font-medium' : ''}>
        {balance.toFixed(1)} hrs
        {isNegative && !allowNegative && <AlertTriangle className="h-3 w-3 inline ml-1" />}
      </span>
    );
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Accrual Rates (P-021)
          </span>
          <Badge variant={rates.personnel_type === 'operations' ? 'default' : 'secondary'} className="text-xs">
            {rates.personnel_type === 'operations' ? 'Operations' : 'Administrative'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Service Info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground border-b pb-2">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Hire: {rates.hire_date || 'Not set'}
          </span>
          <span className="font-medium">
            {rates.years_of_service.toFixed(1)} years of service
          </span>
        </div>

        {/* Vacation */}
        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300 flex items-center gap-1">
              <Sun className="h-3.5 w-3.5" />
              Vacation
            </span>
            <Badge variant="outline" className="text-[10px] bg-blue-100 dark:bg-blue-900 border-blue-300">
              {rates.vacation.tier}
            </Badge>
          </div>
          <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Rate:</span>
              <p className="font-medium">{rates.vacation.hours_per_month} hrs/mo</p>
            </div>
            <div>
              <span className="text-muted-foreground">Balance:</span>
              <p className="font-medium">{formatBalance(rates.vacation.current_balance, rates.vacation.allow_negative)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Cap:</span>
              <p className="font-medium">{rates.vacation.rollover_cap} hrs</p>
            </div>
          </div>
        </div>

        {/* Sick */}
        <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-red-700 dark:text-red-300 flex items-center gap-1">
              <Thermometer className="h-3.5 w-3.5" />
              Sick
            </span>
            <Badge variant="outline" className="text-[10px] bg-red-100 dark:bg-red-900 border-red-300">
              {rates.sick.tier}
            </Badge>
          </div>
          <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Rate:</span>
              <p className="font-medium">{rates.sick.hours_per_month} hrs/mo</p>
            </div>
            <div>
              <span className="text-muted-foreground">Balance:</span>
              <p className="font-medium">{formatBalance(rates.sick.current_balance, false)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Cap:</span>
              <p className="font-medium">{rates.sick.rollover_cap} hrs</p>
            </div>
          </div>
        </div>

        {/* Holiday */}
        <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-green-700 dark:text-green-300 flex items-center gap-1">
              <Gift className="h-3.5 w-3.5" />
              Holiday
            </span>
            <Badge variant="outline" className="text-[10px] bg-green-100 dark:bg-green-900 border-green-300">
              {rates.holiday.hours_per_holiday} hrs × {rates.holiday.holiday_count}
            </Badge>
          </div>
          <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Per Holiday:</span>
              <p className="font-medium">{rates.holiday.hours_per_holiday} hrs</p>
            </div>
            <div>
              <span className="text-muted-foreground">Balance:</span>
              <p className="font-medium">{formatBalance(rates.holiday.current_balance, rates.holiday.allow_negative)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Annual:</span>
              <p className="font-medium">{rates.holiday.hours_per_year} hrs</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PersonnelAccrualRates;
