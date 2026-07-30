import { createContext, useContext, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';

const StaffingContext = createContext(null);

// Get today's date in local timezone as YYYY-MM-DD
const getLocalDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const StaffingProvider = ({ children }) => {
  const { api } = useAuth();
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [selectedBattalion, setSelectedBattalion] = useState('bat-8110');
  const [battalions, setBattalions] = useState([]);
  const [stations, setStations] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [staffingRecords, setStaffingRecords] = useState([]);
  const [leaveRecords, setLeaveRecords] = useState([]);
  const [overtimeRecords, setOvertimeRecords] = useState([]);
  const [apparatusAssignments, setApparatusAssignments] = useState([]);
  const [loading, setLoading] = useState(false);

  // Calculate shift for a date (A, B, or C)
  // Shift rotation: 48 hours on, 96 hours off (2 days on, 4 days off)
  // Reference: C shift on 3/24/2026 and 3/25/2026
  const getShiftForDate = useCallback((dateStr) => {
    // Reference date: March 24, 2026 is C shift (first day of C's 2-day block)
    const referenceDate = new Date('2026-03-24');
    const targetDate = new Date(dateStr);
    const daysDiff = Math.floor((targetDate - referenceDate) / (1000 * 60 * 60 * 24));
    
    // Pattern repeats every 6 days: C,C,A,A,B,B,C,C,A,A,B,B...
    // Day 0,1 = C; Day 2,3 = A; Day 4,5 = B; Day 6,7 = C; etc.
    const normalizedDay = ((daysDiff % 6) + 6) % 6; // Handle negative days
    
    if (normalizedDay < 2) return 'C';
    if (normalizedDay < 4) return 'A';
    return 'B';
  }, []);

  // Get which day of the shift rotation (Day 1 or Day 2)
  const getShiftDay = useCallback((dateStr) => {
    const referenceDate = new Date('2026-03-24');
    const targetDate = new Date(dateStr);
    const daysDiff = Math.floor((targetDate - referenceDate) / (1000 * 60 * 60 * 24));
    
    // Pattern repeats every 6 days
    const normalizedDay = ((daysDiff % 6) + 6) % 6;
    
    // Day 0, 2, 4 = 1st day; Day 1, 3, 5 = 2nd day
    return (normalizedDay % 2) + 1;
  }, []);

  const currentShift = getShiftForDate(selectedDate);
  const currentShiftDay = getShiftDay(selectedDate);

  const fetchBattalions = useCallback(async () => {
    try {
      const response = await api.get('/battalions');
      setBattalions(response.data);
    } catch (error) {
      console.error('Error fetching battalions:', error);
    }
  }, [api]);

  const fetchStations = useCallback(async () => {
    try {
      const response = await api.get('/stations', {
        params: { battalion_id: selectedBattalion }
      });
      setStations(response.data);
    } catch (error) {
      console.error('Error fetching stations:', error);
    }
  }, [api, selectedBattalion]);

  const fetchPersonnel = useCallback(async () => {
    try {
      const response = await api.get('/personnel', {
        params: { battalion_id: selectedBattalion }
      });
      setPersonnel(response.data);
    } catch (error) {
      console.error('Error fetching personnel:', error);
    }
  }, [api, selectedBattalion]);

  const fetchStaffingRecords = useCallback(async () => {
    try {
      const response = await api.get('/staffing', {
        params: { 
          date: selectedDate,
          battalion_id: selectedBattalion
        }
      });
      setStaffingRecords(response.data);
    } catch (error) {
      console.error('Error fetching staffing records:', error);
    }
  }, [api, selectedDate, selectedBattalion]);

  const fetchLeaveRecords = useCallback(async () => {
    try {
      const response = await api.get('/leave-records', {
        params: {
          start_date: selectedDate,
          end_date: selectedDate
        }
      });
      setLeaveRecords(response.data);
    } catch (error) {
      console.error('Error fetching leave records:', error);
    }
  }, [api, selectedDate]);

  const fetchOvertimeRecords = useCallback(async () => {
    try {
      const response = await api.get('/overtime', {
        params: {
          date: selectedDate,
          battalion_id: selectedBattalion
        }
      });
      setOvertimeRecords(response.data);
    } catch (error) {
      console.error('Error fetching overtime records:', error);
    }
  }, [api, selectedDate, selectedBattalion]);

  const fetchApparatusAssignments = useCallback(async () => {
    try {
      const response = await api.get('/apparatus-assignments', {
        params: {
          date: selectedDate,
          battalion_id: selectedBattalion
        }
      });
      setApparatusAssignments(response.data);
    } catch (error) {
      console.error('Error fetching apparatus assignments:', error);
    }
  }, [api, selectedDate, selectedBattalion]);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchBattalions(),
        fetchStations(),
        fetchPersonnel(),
        fetchStaffingRecords(),
        fetchLeaveRecords(),
        fetchOvertimeRecords(),
        fetchApparatusAssignments()
      ]);
    } finally {
      setLoading(false);
    }
  }, [fetchBattalions, fetchStations, fetchPersonnel, fetchStaffingRecords, fetchLeaveRecords, fetchOvertimeRecords, fetchApparatusAssignments]);

  const getPersonnelByStation = useCallback((stationId, shift = null) => {
    return personnel.filter(p => 
      p.station_id === stationId && 
      (shift === null || p.shift === shift)
    );
  }, [personnel]);

  const getPersonnelOnLeave = useCallback((leaveType = null) => {
    const personnelOnLeave = leaveRecords.filter(l => 
      leaveType === null || l.leave_type === leaveType
    ).map(l => l.personnel_id);
    
    return personnel.filter(p => personnelOnLeave.includes(p.id));
  }, [personnel, leaveRecords]);

  const getAvailableForOvertime = useCallback(() => {
    return overtimeRecords.filter(o => o.status === 'available');
  }, [overtimeRecords]);

  return (
    <StaffingContext.Provider value={{
      selectedDate,
      setSelectedDate,
      selectedBattalion,
      setSelectedBattalion,
      currentShift,
      currentShiftDay,
      getShiftForDate,
      getShiftDay,
      battalions,
      stations,
      personnel,
      staffingRecords,
      leaveRecords,
      overtimeRecords,
      apparatusAssignments,
      loading,
      fetchAllData,
      fetchBattalions,
      fetchStations,
      fetchPersonnel,
      fetchStaffingRecords,
      fetchLeaveRecords,
      fetchOvertimeRecords,
      fetchApparatusAssignments,
      getPersonnelByStation,
      getPersonnelOnLeave,
      getAvailableForOvertime
    }}>
      {children}
    </StaffingContext.Provider>
  );
};

export const useStaffing = () => {
  const context = useContext(StaffingContext);
  if (!context) {
    throw new Error('useStaffing must be used within a StaffingProvider');
  }
  return context;
};
