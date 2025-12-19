import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useMemo } from 'react';

// Default timezone if tenant doesn't have one set
const DEFAULT_TIMEZONE = 'America/New_York';

/**
 * Hook to get tenant timezone and formatting utilities
 * Falls back to browser locale if tenant timezone not set
 */
export function useTenantTimezone() {
  const { tenant } = useTenantAdminAuth();
  
  const timezone = useMemo(() => {
    // @ts-expect-error - timezone may not be in types yet
    return tenant?.timezone || DEFAULT_TIMEZONE;
  }, [tenant]);

  /**
   * Format a date in the tenant's timezone
   */
  const formatDate = (date: Date | string, options?: Intl.DateTimeFormatOptions): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      timeZone: timezone,
      ...options
    });
  };

  /**
   * Format a time in the tenant's timezone
   */
  const formatTime = (date: Date | string, options?: Intl.DateTimeFormatOptions): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('en-US', {
      timeZone: timezone,
      ...options
    });
  };

  /**
   * Format date and time in the tenant's timezone
   */
  const formatDateTime = (date: Date | string, options?: Intl.DateTimeFormatOptions): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('en-US', {
      timeZone: timezone,
      ...options
    });
  };

  /**
   * Get start of day in tenant's timezone (as UTC Date)
   */
  const getStartOfDay = (date?: Date): Date => {
    const d = date || new Date();
    const dateStr = d.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD format
    return new Date(`${dateStr}T00:00:00`);
  };

  /**
   * Get end of day in tenant's timezone (as UTC Date)
   */
  const getEndOfDay = (date?: Date): Date => {
    const d = date || new Date();
    const dateStr = d.toLocaleDateString('en-CA', { timeZone: timezone });
    return new Date(`${dateStr}T23:59:59.999`);
  };

  /**
   * Check if a date is "today" in tenant's timezone
   */
  const isToday = (date: Date | string): boolean => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const today = new Date();
    return formatDate(d, { year: 'numeric', month: '2-digit', day: '2-digit' }) === 
           formatDate(today, { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  /**
   * Get relative time string (e.g., "2 hours ago", "yesterday")
   */
  const getRelativeTime = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return formatDate(d);
  };

  return {
    timezone,
    formatDate,
    formatTime,
    formatDateTime,
    getStartOfDay,
    getEndOfDay,
    isToday,
    getRelativeTime
  };
}

export default useTenantTimezone;
