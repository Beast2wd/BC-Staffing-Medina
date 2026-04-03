// Date utility functions for consistent formatting across the app

/**
 * Format a date string (YYYY-MM-DD) to display format (MM/DD/YYYY)
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {string} Date in MM/DD/YYYY format
 */
export const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${month}/${day}/${year}`;
};

/**
 * Format a Date object to display format (MM/DD/YYYY)
 * @param {Date} date - Date object
 * @returns {string} Date in MM/DD/YYYY format
 */
export const formatDateToDisplay = (date) => {
  if (!date) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
};

/**
 * Format a date string (YYYY-MM-DD) to API format (keeps YYYY-MM-DD)
 * This is for sending to the backend
 * @param {string} dateStr - Date in any format
 * @returns {string} Date in YYYY-MM-DD format
 */
export const formatApiDate = (dateStr) => {
  if (!dateStr) return '';
  // If already in YYYY-MM-DD format, return as is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  // If in MM/DD/YYYY format, convert
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [month, day, year] = dateStr.split('/');
    return `${year}-${month}-${day}`;
  }
  return dateStr;
};

/**
 * Format date for display with weekday
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {string} Formatted date like "Friday, 04/03/2026"
 */
export const formatDisplayDateWithDay = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  return `${weekday}, ${formatDisplayDate(dateStr)}`;
};

/**
 * Format date range for display
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {string} Formatted date range like "04/03/2026 to 04/10/2026"
 */
export const formatDateRange = (startDate, endDate) => {
  return `${formatDisplayDate(startDate)} to ${formatDisplayDate(endDate)}`;
};
