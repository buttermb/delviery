import { useState, useCallback, useMemo } from 'react';
import { isAfter, isBefore, isEqual, differenceInDays } from 'date-fns';

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface ValidationResult {
  isValid: boolean;
  error: string | null;
}

interface UseDateRangeValidationOptions {
  maxRangeDays?: number;
  allowFutureDates?: boolean;
  allowSameDay?: boolean;
}

export function useDateRangeValidation(options: UseDateRangeValidationOptions = {}) {
  const { 
    maxRangeDays = 365, 
    allowFutureDates = false,
    allowSameDay = true 
  } = options;

  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });

  const validateRange = useCallback((range: DateRange): ValidationResult => {
    const { from, to } = range;

    if (!from && !to) {
      return { isValid: true, error: null };
    }

    if (from && !to) {
      return { isValid: true, error: null };
    }

    if (!from && to) {
      return { isValid: false, error: 'Please select a start date' };
    }

    if (from && to) {
      if (isBefore(to, from)) {
        return { isValid: false, error: 'End date cannot be before start date' };
      }

      if (!allowSameDay && isEqual(from, to)) {
        return { isValid: false, error: 'Start and end dates cannot be the same' };
      }

      if (!allowFutureDates) {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        
        if (isAfter(from, today)) {
          return { isValid: false, error: 'Start date cannot be in the future' };
        }
        if (isAfter(to, today)) {
          return { isValid: false, error: 'End date cannot be in the future' };
        }
      }

      const daysDiff = differenceInDays(to, from);
      if (daysDiff > maxRangeDays) {
        return { isValid: false, error: `Date range cannot exceed ${maxRangeDays} days` };
      }
    }

    return { isValid: true, error: null };
  }, [maxRangeDays, allowFutureDates, allowSameDay]);

  const validation = useMemo(() => validateRange(dateRange), [dateRange, validateRange]);

  const setRange = useCallback((range: DateRange) => {
    setDateRange(range);
  }, []);

  const clearRange = useCallback(() => {
    setDateRange({ from: undefined, to: undefined });
  }, []);

  return {
    dateRange,
    setRange,
    clearRange,
    isValid: validation.isValid,
    error: validation.error,
    validateRange
  };
}
