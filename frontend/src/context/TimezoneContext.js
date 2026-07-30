import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getBrowserTimezone, getDateInTimezone } from '../utils/timezoneUtils';

const TimezoneContext = createContext(null);

export const TimezoneProvider = ({ children }) => {
  const { api, isAuthenticated } = useAuth();
  const [timezone, setTimezone] = useState('America/Chicago'); // Default
  const [useBrowserTimezone, setUseBrowserTimezone] = useState(false);
  const [shiftReferenceDate, setShiftReferenceDate] = useState('2026-03-24');
  const [shiftReferenceShift, setShiftReferenceShift] = useState('C');
  const [loading, setLoading] = useState(true);

  // Determine the effective timezone to use
  const effectiveTimezone = useBrowserTimezone ? getBrowserTimezone() : timezone;

  // Fetch timezone settings from tenant
  const fetchTimezoneSettings = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      const response = await api.get('/tenants/settings/timezone');
      const data = response.data;
      
      setTimezone(data.timezone || 'America/Chicago');
      setUseBrowserTimezone(data.use_browser_timezone || false);
      setShiftReferenceDate(data.shift_reference_date || '2026-03-24');
      setShiftReferenceShift(data.shift_reference_shift || 'C');
    } catch (error) {
      console.error('Failed to fetch timezone settings:', error);
      // Use defaults on error
    } finally {
      setLoading(false);
    }
  }, [api, isAuthenticated]);

  useEffect(() => {
    fetchTimezoneSettings();
  }, [fetchTimezoneSettings]);

  // Update timezone settings
  const updateTimezoneSettings = async (settings) => {
    try {
      await api.put('/tenants/settings/timezone', settings);
      
      if (settings.timezone !== undefined) setTimezone(settings.timezone);
      if (settings.use_browser_timezone !== undefined) setUseBrowserTimezone(settings.use_browser_timezone);
      if (settings.shift_reference_date !== undefined) setShiftReferenceDate(settings.shift_reference_date);
      if (settings.shift_reference_shift !== undefined) setShiftReferenceShift(settings.shift_reference_shift);
      
      return { success: true };
    } catch (error) {
      console.error('Failed to update timezone settings:', error);
      return { success: false, error: error.message };
    }
  };

  // Get today's date in the effective timezone
  const getTodayDate = useCallback(() => {
    return getDateInTimezone(effectiveTimezone);
  }, [effectiveTimezone]);

  // Calculate shift for a given date
  const getShiftForDate = useCallback((dateStr) => {
    const referenceDate = new Date(shiftReferenceDate);
    const targetDate = new Date(dateStr);
    const daysDiff = Math.floor((targetDate - referenceDate) / (1000 * 60 * 60 * 24));
    
    // Pattern repeats every 6 days based on reference shift
    // If reference is C: C,C,A,A,B,B
    // If reference is A: A,A,B,B,C,C
    // If reference is B: B,B,C,C,A,A
    const normalizedDay = ((daysDiff % 6) + 6) % 6;
    
    const shiftOrder = {
      'C': ['C', 'C', 'A', 'A', 'B', 'B'],
      'A': ['A', 'A', 'B', 'B', 'C', 'C'],
      'B': ['B', 'B', 'C', 'C', 'A', 'A']
    };
    
    const order = shiftOrder[shiftReferenceShift] || shiftOrder['C'];
    return order[normalizedDay];
  }, [shiftReferenceDate, shiftReferenceShift]);

  // Get shift day (1 or 2) for a given date
  const getShiftDay = useCallback((dateStr) => {
    const referenceDate = new Date(shiftReferenceDate);
    const targetDate = new Date(dateStr);
    const daysDiff = Math.floor((targetDate - referenceDate) / (1000 * 60 * 60 * 24));
    
    const normalizedDay = ((daysDiff % 6) + 6) % 6;
    return (normalizedDay % 2) + 1;
  }, [shiftReferenceDate]);

  return (
    <TimezoneContext.Provider value={{
      timezone,
      useBrowserTimezone,
      effectiveTimezone,
      shiftReferenceDate,
      shiftReferenceShift,
      loading,
      getTodayDate,
      getShiftForDate,
      getShiftDay,
      updateTimezoneSettings,
      refreshSettings: fetchTimezoneSettings
    }}>
      {children}
    </TimezoneContext.Provider>
  );
};

export const useTimezone = () => {
  const context = useContext(TimezoneContext);
  if (!context) {
    throw new Error('useTimezone must be used within a TimezoneProvider');
  }
  return context;
};
