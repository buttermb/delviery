/**
 * Date Formatting Utilities
 *
 * Provides consistent date formatting across the application with timezone support.
 * Uses tenant settings for timezone-aware formatting when available.
 *
 * @example
 * // Basic formatting
 * formatDate(new Date()) // "Feb 9, 2026"
 * formatDate(new Date(), 'yyyy-MM-dd') // "2026-02-09"
 *
 * // Relative formatting
 * formatRelative(new Date(Date.now() - 3600000)) // "1 hour ago"
 * formatRelative(yesterday) // "Yesterday"
 *
 * // Date range
 * formatDateRange(startDate, endDate) // "Feb 1 - Feb 9, 2026"
 */

import {
  format as dateFnsFormat,
  formatDistance,
  isToday,
  isYesterday,
  isTomorrow,
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  parseISO,
} from 'date-fns';

import { logger } from '@/lib/logger';

/**
 * Default timezone when tenant setting is not available
 */
const DEFAULT_TIMEZONE = 'America/New_York';

/**
 * Default date format
 */
const DEFAULT_FORMAT = 'MMM d, yyyy';

/**
 * Common format presets
 */
export const DATE_FORMATS = {
  short: 'MM/dd/yy',
  medium: 'MMM d, yyyy',
  long: 'MMMM d, yyyy',
  full: 'EEEE, MMMM d, yyyy',
  iso: 'yyyy-MM-dd',
  time: 'h:mm a',
  timeWithSeconds: 'h:mm:ss a',
  dateTime: 'MMM d, yyyy h:mm a',
  dateTimeFull: 'MMMM d, yyyy h:mm a',
} as const;

/**
 * Parse a date value into a Date object
 */
function parseDate(date: string | Date | null | undefined): Date | null {
  if (!date) return null;

  try {
    if (date instanceof Date) {
      return isNaN(date.getTime()) ? null : date;
    }

    // Try parsing as ISO string
    const parsed = parseISO(date);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch (error) {
    logger.warn('Failed to parse date', { date, error });
    return null;
  }
}

/**
 * Get timezone from tenant settings or use default
 */
function resolveTimezone(timezone?: string | null): string {
  if (timezone && typeof timezone === 'string' && timezone.length > 0) {
    return timezone;
  }
  return DEFAULT_TIMEZONE;
}

/**
 * Convert a date to a specific timezone using Intl API
 */
function toTimezone(date: Date, timezone: string): Date {
  try {
    // Get the date string in the target timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const getValue = (type: string): string =>
      parts.find((p) => p.type === type)?.value || '0';

    // Construct a new date from the parts (in local time)
    const year = parseInt(getValue('year'), 10);
    const month = parseInt(getValue('month'), 10) - 1;
    const day = parseInt(getValue('day'), 10);
    const hour = parseInt(getValue('hour'), 10);
    const minute = parseInt(getValue('minute'), 10);
    const second = parseInt(getValue('second'), 10);

    return new Date(year, month, day, hour, minute, second);
  } catch {
    return date;
  }
}

/**
 * Format a date in a specific timezone using Intl API
 */
function formatInTimezone(
  date: Date,
  timezone: string,
  formatStr: string
): string {
  // Use date-fns format with the timezone-adjusted date for most cases
  // For simple formatting, use Intl API directly
  const zonedDate = toTimezone(date, timezone);
  return dateFnsFormat(zonedDate, formatStr);
}

/**
 * Format a date with optional format string
 *
 * @param date - Date to format (string, Date, or null/undefined)
 * @param formatStr - Format string (uses date-fns format tokens)
 * @param options - Additional options
 * @returns Formatted date string or placeholder for invalid dates
 *
 * @example
 * formatDate(new Date()) // "Feb 9, 2026"
 * formatDate(new Date(), 'yyyy-MM-dd') // "2026-02-09"
 * formatDate(new Date(), DATE_FORMATS.full) // "Sunday, February 9, 2026"
 * formatDate(new Date(), 'h:mm a', { timezone: 'America/Los_Angeles' })
 */
export function formatDate(
  date: string | Date | null | undefined,
  formatStr: string = DEFAULT_FORMAT,
  options?: {
    timezone?: string | null;
    placeholder?: string;
  }
): string {
  const { timezone, placeholder = '—' } = options || {};

  const parsedDate = parseDate(date);
  if (!parsedDate) return placeholder;

  try {
    const tz = resolveTimezone(timezone);
    return formatInTimezone(parsedDate, tz, formatStr);
  } catch (error) {
    logger.warn('Failed to format date with timezone, falling back to local', {
      date,
      formatStr,
      timezone,
      error,
    });

    // Fallback to local formatting
    try {
      return dateFnsFormat(parsedDate, formatStr);
    } catch {
      return placeholder;
    }
  }
}

/**
 * Format a date as relative time
 *
 * Returns human-readable relative time like "2 hours ago", "Yesterday", "Tomorrow"
 *
 * @param date - Date to format
 * @param options - Additional options
 * @returns Relative time string
 *
 * @example
 * formatRelative(new Date(Date.now() - 60000)) // "1 minute ago"
 * formatRelative(new Date(Date.now() - 3600000)) // "1 hour ago"
 * formatRelative(yesterday) // "Yesterday"
 * formatRelative(tomorrow) // "Tomorrow"
 */
export function formatRelative(
  date: string | Date | null | undefined,
  options?: {
    timezone?: string | null;
    placeholder?: string;
    addSuffix?: boolean;
  }
): string {
  const { timezone, placeholder = '—', addSuffix = true } = options || {};

  const parsedDate = parseDate(date);
  if (!parsedDate) return placeholder;

  try {
    const tz = resolveTimezone(timezone);
    const now = new Date();
    const zonedDate = toTimezone(parsedDate, tz);
    const zonedNow = toTimezone(now, tz);

    // Check for special cases first
    if (isYesterday(zonedDate)) {
      return 'Yesterday';
    }

    if (isToday(zonedDate)) {
      // For today, use relative time
      const minutesAgo = differenceInMinutes(zonedNow, zonedDate);

      if (minutesAgo < 1) {
        return 'Just now';
      }

      if (minutesAgo < 60) {
        return `${minutesAgo} minute${minutesAgo === 1 ? '' : 's'} ago`;
      }

      const hoursAgo = differenceInHours(zonedNow, zonedDate);
      if (hoursAgo < 24) {
        return `${hoursAgo} hour${hoursAgo === 1 ? '' : 's'} ago`;
      }
    }

    if (isTomorrow(zonedDate)) {
      return 'Tomorrow';
    }

    // For dates within the last week
    const daysAgo = differenceInDays(zonedNow, zonedDate);
    if (daysAgo > 0 && daysAgo < 7) {
      return `${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`;
    }

    // For future dates within a week
    if (daysAgo < 0 && daysAgo > -7) {
      const daysUntil = Math.abs(daysAgo);
      return `in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`;
    }

    // For older/further dates, use formatDistance
    return formatDistance(zonedDate, zonedNow, { addSuffix });
  } catch (error) {
    logger.warn('Failed to format relative date', { date, error });

    // Fallback to simple relative formatting
    try {
      return formatDistance(parsedDate, new Date(), { addSuffix });
    } catch {
      return placeholder;
    }
  }
}

/**
 * Format a date range
 *
 * Intelligently formats date ranges, avoiding redundant information
 *
 * @param startDate - Start of the range
 * @param endDate - End of the range
 * @param options - Additional options
 * @returns Formatted date range string
 *
 * @example
 * // Same month and year
 * formatDateRange('2026-02-01', '2026-02-15') // "Feb 1 - 15, 2026"
 *
 * // Different months, same year
 * formatDateRange('2026-01-15', '2026-02-15') // "Jan 15 - Feb 15, 2026"
 *
 * // Different years
 * formatDateRange('2025-12-15', '2026-01-15') // "Dec 15, 2025 - Jan 15, 2026"
 *
 * // Same day
 * formatDateRange('2026-02-09', '2026-02-09') // "Feb 9, 2026"
 */
export function formatDateRange(
  startDate: string | Date | null | undefined,
  endDate: string | Date | null | undefined,
  options?: {
    timezone?: string | null;
    placeholder?: string;
    separator?: string;
    includeTime?: boolean;
  }
): string {
  const {
    timezone,
    placeholder = '—',
    separator = ' - ',
    includeTime = false,
  } = options || {};

  const parsedStart = parseDate(startDate);
  const parsedEnd = parseDate(endDate);

  if (!parsedStart && !parsedEnd) return placeholder;

  // If only one date is provided
  if (!parsedStart) {
    return formatDate(parsedEnd, includeTime ? DATE_FORMATS.dateTime : DEFAULT_FORMAT, { timezone });
  }
  if (!parsedEnd) {
    return formatDate(parsedStart, includeTime ? DATE_FORMATS.dateTime : DEFAULT_FORMAT, { timezone });
  }

  try {
    const tz = resolveTimezone(timezone);
    const zonedStart = toTimezone(parsedStart, tz);
    const zonedEnd = toTimezone(parsedEnd, tz);

    const startYear = zonedStart.getFullYear();
    const endYear = zonedEnd.getFullYear();
    const startMonth = zonedStart.getMonth();
    const endMonth = zonedEnd.getMonth();
    const startDay = zonedStart.getDate();
    const endDay = zonedEnd.getDate();

    // Same day
    if (startYear === endYear && startMonth === endMonth && startDay === endDay) {
      if (includeTime) {
        return `${dateFnsFormat(zonedStart, 'MMM d, yyyy')} ${dateFnsFormat(zonedStart, 'h:mm a')}${separator}${dateFnsFormat(zonedEnd, 'h:mm a')}`;
      }
      return dateFnsFormat(zonedStart, DEFAULT_FORMAT);
    }

    // Same month and year
    if (startYear === endYear && startMonth === endMonth) {
      const timeFormat = includeTime ? ' h:mm a' : '';
      return `${dateFnsFormat(zonedStart, `MMM d${timeFormat}`)}${separator}${dateFnsFormat(zonedEnd, `d, yyyy${timeFormat}`)}`;
    }

    // Same year, different months
    if (startYear === endYear) {
      const timeFormat = includeTime ? ' h:mm a' : '';
      return `${dateFnsFormat(zonedStart, `MMM d${timeFormat}`)}${separator}${dateFnsFormat(zonedEnd, `MMM d, yyyy${timeFormat}`)}`;
    }

    // Different years
    const dateFormat = includeTime ? DATE_FORMATS.dateTime : DEFAULT_FORMAT;
    return `${dateFnsFormat(zonedStart, dateFormat)}${separator}${dateFnsFormat(zonedEnd, dateFormat)}`;
  } catch (error) {
    logger.warn('Failed to format date range', { startDate, endDate, error });

    // Fallback to simple formatting
    try {
      const startStr = dateFnsFormat(parsedStart, DEFAULT_FORMAT);
      const endStr = dateFnsFormat(parsedEnd, DEFAULT_FORMAT);
      return startStr === endStr ? startStr : `${startStr}${separator}${endStr}`;
    } catch {
      return placeholder;
    }
  }
}

/**
 * Get the current timezone
 *
 * Tries to detect the user's timezone using the Intl API
 */
export function getCurrentTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/**
 * Get timezone abbreviation
 *
 * @param timezone - IANA timezone name
 * @param date - Date to get abbreviation for (defaults to now)
 * @returns Timezone abbreviation (e.g., "EST", "PST")
 */
export function getTimezoneAbbreviation(
  timezone?: string | null,
  date: Date = new Date()
): string {
  try {
    const tz = resolveTimezone(timezone);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'short',
    }).formatToParts(date);

    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    return tzPart?.value || '';
  } catch {
    return '';
  }
}

/**
 * Format date with timezone indicator
 *
 * @param date - Date to format
 * @param options - Formatting options
 * @returns Formatted date with timezone abbreviation
 *
 * @example
 * formatDateWithTimezone(new Date()) // "Feb 9, 2026 2:30 PM (EST)"
 */
export function formatDateWithTimezone(
  date: string | Date | null | undefined,
  options?: {
    timezone?: string | null;
    formatStr?: string;
    placeholder?: string;
    showTimezone?: boolean;
  }
): string {
  const {
    timezone,
    formatStr = DATE_FORMATS.dateTime,
    placeholder = '—',
    showTimezone = true,
  } = options || {};

  const formatted = formatDate(date, formatStr, { timezone, placeholder });
  if (formatted === placeholder) return placeholder;

  if (!showTimezone) return formatted;

  const parsedDate = parseDate(date);
  if (!parsedDate) return formatted;

  const tzAbbr = getTimezoneAbbreviation(timezone, parsedDate);
  return tzAbbr ? `${formatted} (${tzAbbr})` : formatted;
}
