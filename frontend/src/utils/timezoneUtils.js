/**
 * Timezone utilities for handling tenant-specific timezone settings
 */

// Get the browser's timezone
export const getBrowserTimezone = () => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

// Get today's date in a specific timezone as YYYY-MM-DD
export const getDateInTimezone = (timezone, date = new Date()) => {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(date);
  } catch (error) {
    console.error('Invalid timezone, falling back to local:', error);
    // Fallback to local date
    const now = date;
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
};

// Get current time in a specific timezone
export const getTimeInTimezone = (timezone) => {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    return formatter.format(new Date());
  } catch (error) {
    return new Date().toLocaleTimeString();
  }
};

// Format a date string for display in a specific timezone
export const formatDateInTimezone = (dateStr, timezone, options = {}) => {
  try {
    const date = new Date(dateStr + 'T12:00:00'); // Use noon to avoid date shift issues
    const defaultOptions = {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    };
    const formatter = new Intl.DateTimeFormat('en-US', { ...defaultOptions, ...options });
    return formatter.format(date);
  } catch (error) {
    return dateStr;
  }
};

// Get timezone abbreviation (e.g., "CST", "CDT", "EST")
export const getTimezoneAbbreviation = (timezone) => {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short'
    });
    const parts = formatter.formatToParts(new Date());
    const tzPart = parts.find(part => part.type === 'timeZoneName');
    return tzPart ? tzPart.value : '';
  } catch (error) {
    return '';
  }
};

// Common US timezones (matching backend)
export const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)', offset: 'UTC-5/-4' },
  { value: 'America/Chicago', label: 'Central Time (CT)', offset: 'UTC-6/-5' },
  { value: 'America/Denver', label: 'Mountain Time (MT)', offset: 'UTC-7/-6' },
  { value: 'America/Phoenix', label: 'Arizona Time (AZ)', offset: 'UTC-7' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', offset: 'UTC-8/-7' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)', offset: 'UTC-9/-8' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)', offset: 'UTC-10' }
];

export default {
  getBrowserTimezone,
  getDateInTimezone,
  getTimeInTimezone,
  formatDateInTimezone,
  getTimezoneAbbreviation,
  US_TIMEZONES
};
