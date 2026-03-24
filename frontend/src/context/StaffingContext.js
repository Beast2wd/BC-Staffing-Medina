import { createContext, useContext, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';

const StaffingContext = createContext(null);

export const StaffingProvider = ({ children }) => {
  const { api } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
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
  const getShiftForDate = useCallback((dateStr) => {
    const referenceDate = new Date('2026-01-01');
    const targetDate = new Date(dateStr);
    const daysDiff = Math.floor((targetDate - referenceDate) / (1000 * 60 * 60 * 24));
    const shifts = ['A', 'B', 'C'];
    return shifts[((daysDiff % 3) + 3) % 3];
  }, []);

  const currentShift = getShiftForDate(selectedDate);

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
      getShiftForDate,
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
