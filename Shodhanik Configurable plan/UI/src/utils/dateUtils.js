/**
 * Utility functions for date and time formatting
 */

/**
 * Parses a date value safely. If the string is in ISO format without a timezone indicator (Z or +/-offset),
 * it treats it as UTC, avoiding unintended shifts when converted from backend UTC datetimes.
 * 
 * @param {string|Date} dateVal 
 * @returns {Date|null}
 */
export const parseUtcDate = (dateVal) => {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? null : dateVal;
  
  let s = String(dateVal).trim();
  if (!s || s === 'null' || s === 'undefined' || s === '--' || s === '-') return null;

  // If no timezone offset (Z or +/-HH:mm), treat it as UTC
  if (!s.endsWith('Z') && !/[+-]\d{2}(:\d{2})?$/.test(s)) {
    s = s.includes('T') ? `${s}Z` : `${s.replace(' ', 'T')}Z`;
  }
  
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Formats a date string into standard DD/MM/YYYY, hh:mm:ss AM/PM in user's local timezone (IST).
 * 
 * @param {string|Date} dateVal 
 * @param {object} options 
 * @returns {string} Formatted date time string (e.g. "30/09/2026, 11:14:39 AM") or "-"
 */
export const formatDateTime = (dateVal, options = {}) => {
  const d = parseUtcDate(dateVal);
  if (!d) return '-';

  const defaultOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    ...options,
  };

  return d.toLocaleString('en-IN', defaultOptions).toUpperCase();
};

/**
 * Formats a date string into standard DD/MM/YYYY.
 * 
 * @param {string|Date} dateVal 
 * @returns {string} Formatted date string (e.g. "30/09/2026") or "-"
 */
export const formatDate = (dateVal) => {
  const d = parseUtcDate(dateVal);
  if (!d) return '-';

  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};
