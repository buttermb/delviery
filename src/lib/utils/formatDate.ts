/**
 * Date Formatting Utilities
 * Consistent date formatting across the app
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

