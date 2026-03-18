/**
 * Time Validation Utilities
 * 
 * Provides robust time parsing, validation, and formatting functions.
 */

export interface TimeObject {
  hours: number;
  minutes: number;
  seconds?: number;
}

/**
 * Check if a time string is valid (HH:MM or HH:MM:SS format)
 * Validates hours 0-23 and minutes/seconds 0-59
 */
export function isValidTime(time: string): boolean {
  if (!time || typeof time !== 'string') return false;
  
  // Match HH:MM or HH:MM:SS
  const regex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])(?::([0-5][0-9]))?$/;
  return regex.test(time.trim());
}

/**
 * Parse a time string into hours and minutes
 * Returns null if invalid
 */
export function parseTime(time: string): TimeObject | null {
  if (!isValidTime(time)) return null;
  
  const parts = time.trim().split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parts[2] ? parseInt(parts[2], 10) : undefined;
  
  return { hours, minutes, seconds };
}

/**
 * Format a Date object to HH:MM string
 */
export function formatTime(date: Date, includeSeconds = false): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  if (includeSeconds) {
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }
  
  return `${hours}:${minutes}`;
}

/**
 * Format a TimeObject to HH:MM string
 */
export function formatTimeObject(time: TimeObject, includeSeconds = false): string {
  const hours = time.hours.toString().padStart(2, '0');
  const minutes = time.minutes.toString().padStart(2, '0');
  
  if (includeSeconds && time.seconds !== undefined) {
    const seconds = time.seconds.toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }
  
  return `${hours}:${minutes}`;
}

/**
 * Validate that end time is after start time
 */
export function validateTimeRange(startTime: string, endTime: string): {
  isValid: boolean;
  error?: string;
} {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  
  if (!start) {
    return { isValid: false, error: 'Invalid start time format' };
  }
  
  if (!end) {
    return { isValid: false, error: 'Invalid end time format' };
  }
  
  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;
  
  if (endMinutes <= startMinutes) {
    return { isValid: false, error: 'End time must be after start time' };
  }
  
  return { isValid: true };
}

/**
 * Get time difference in minutes
 */
export function getTimeDifferenceMinutes(startTime: string, endTime: string): number | null {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  
  if (!start || !end) return null;
  
  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;
  
  return endMinutes - startMinutes;
}

/**
 * Format duration in minutes to human-readable string
 */
export function formatDurationFromMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (mins === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${mins}m`;
}

/**
 * Convert 12-hour format to 24-hour format
 * e.g., "2:30 PM" -> "14:30"
 */
export function convert12to24(time12: string): string | null {
  const regex = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
  const match = time12.trim().match(regex);
  
  if (!match) return null;
  
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = match[3].toUpperCase();
  
  if (hours < 1 || hours > 12) return null;
  
  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return `${hours.toString().padStart(2, '0')}:${minutes}`;
}

/**
 * Convert 24-hour format to 12-hour format
 * e.g., "14:30" -> "2:30 PM"
 */
export function convert24to12(time24: string): string | null {
  const parsed = parseTime(time24);
  if (!parsed) return null;
  
  const { hours, minutes } = parsed;
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Get current time as HH:MM string
 */
export function getCurrentTime(includeSeconds = false): string {
  return formatTime(new Date(), includeSeconds);
}

/**
 * Check if a time is within business hours
 */
export function isWithinBusinessHours(
  time: string,
  businessStart = '09:00',
  businessEnd = '17:00'
): boolean {
  const parsed = parseTime(time);
  const start = parseTime(businessStart);
  const end = parseTime(businessEnd);
  
  if (!parsed || !start || !end) return false;
  
  const timeMinutes = parsed.hours * 60 + parsed.minutes;
  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;
  
  return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
}
