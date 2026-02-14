/**
 * Date Formatting Utilities
 * Consistent date formatting across the app
 * Includes timezone-aware formatting
 */

import { format, formatDistance, formatRelative, isToday, isYesterday, isThisWeek } from 'date-fns';

/**
 * Format date with smart relative time
 */
export function formatSmartDate(
  date: string | Date | null | undefined,
  options?: {
    includeTime?: boolean;
    relative?: boolean;
  }
): string {
  if (!date) return '—';

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) return '—';

  const { includeTime = false, relative = true } = options || {};

  if (relative) {
    if (isToday(dateObj)) {
      return includeTime
        ? `Today at ${format(dateObj, 'h:mm a')}`
        : 'Today';
    }
    if (isYesterday(dateObj)) {
      return includeTime
        ? `Yesterday at ${format(dateObj, 'h:mm a')}`
        : 'Yesterday';
    }
    if (isThisWeek(dateObj)) {
      return formatRelative(dateObj, new Date());
    }
  }

  if (includeTime) {
    return format(dateObj, 'MMM d, yyyy h:mm a');
  }

  return format(dateObj, 'MMM d, yyyy');
}

/**
 * Format date as relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(
  date: string | Date | null | undefined
): string {
  if (!date) return '—';

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) return '—';

  return formatDistance(dateObj, new Date(), { addSuffix: true });
}

/**
 * Format date range
 */
export function formatDateRange(
  startDate: string | Date | null | undefined,
  endDate: string | Date | null | undefined
): string {
  if (!startDate || !endDate) return '—';

  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return '—';

  const startFormatted = format(start, 'MMM d');
  const endFormatted = format(end, 'MMM d, yyyy');

  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${format(start, 'MMM d')} - ${format(end, 'd, yyyy')}`;
  }

  return `${startFormatted} - ${endFormatted}`;
}

/**
 * Format date with timezone indicator
 * Shows user's local timezone abbreviation for clarity
 */
export function formatDateWithTimezone(
  date: string | Date | null | undefined,
  options?: { 
    includeTime?: boolean; 
    showTimezone?: boolean;
    dateFormat?: string;
  }
): string {
  if (!date) return '—';

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) return '—';

  const { includeTime = true, showTimezone = true, dateFormat } = options || {};

  // Get timezone abbreviation
  const getTimezoneAbbr = (): string => {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { 
        timeZoneName: 'short' 
      }).formatToParts(dateObj);
      const tzPart = parts.find(p => p.type === 'timeZoneName');
      return tzPart?.value || '';
    } catch {
      return '';
    }
  };

  const formatStr = dateFormat || (includeTime ? 'MMM d, yyyy h:mm a' : 'MMM d, yyyy');
  const formatted = format(dateObj, formatStr);

  if (showTimezone && includeTime) {
    const tzAbbr = getTimezoneAbbr();
    return tzAbbr ? `${formatted} (${tzAbbr})` : formatted;
  }

  return formatted;
}

/**
 * Get user's current timezone info
 */
export function getUserTimezone(): { name: string; abbreviation: string; offset: string } {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', { 
    timeZoneName: 'short' 
  }).formatToParts(now);
  const abbreviation = parts.find(p => p.type === 'timeZoneName')?.value || '';
  
  const offsetMinutes = now.getTimezoneOffset();
  const offsetHours = Math.abs(offsetMinutes / 60);
  const offsetSign = offsetMinutes <= 0 ? '+' : '-';
  const offset = `UTC${offsetSign}${offsetHours}`;

  return { name: timezone, abbreviation, offset };
}

