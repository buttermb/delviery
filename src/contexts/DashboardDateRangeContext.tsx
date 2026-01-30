/**
 * Dashboard Date Range Context
 * Provides shared date range state for filtering all dashboard widgets.
 * Default range is "Last 30 Days".
 */

import { createContext, useContext, useState, ReactNode, useMemo } from 'react';
import { subDays, startOfDay, endOfDay } from 'date-fns';

export interface DateRange {
  from: Date;
  to: Date;
}

interface DashboardDateRangeContextType {
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  /** ISO strings for query use */
  dateRangeISO: { from: string; to: string };
  /** Key for React Query caching - changes when dates change */
  dateRangeKey: string;
}

const DashboardDateRangeContext = createContext<DashboardDateRangeContextType | undefined>(undefined);

function getDefaultDateRange(): DateRange {
  const now = new Date();
  return {
    from: startOfDay(subDays(now, 29)), // Last 30 days including today
    to: endOfDay(now),
  };
}

interface DashboardDateRangeProviderProps {
  children: ReactNode;
  /** Optional initial date range override */
  initialRange?: DateRange;
}

export function DashboardDateRangeProvider({
  children,
  initialRange,
}: DashboardDateRangeProviderProps) {
  const [dateRange, setDateRange] = useState<DateRange>(
    initialRange ?? getDefaultDateRange()
  );

  const value = useMemo(() => {
    const dateRangeISO = {
      from: startOfDay(dateRange.from).toISOString(),
      to: endOfDay(dateRange.to).toISOString(),
    };

    // Create a stable key for React Query caching
    const dateRangeKey = `${dateRange.from.toISOString().split('T')[0]}_${dateRange.to.toISOString().split('T')[0]}`;

    return {
      dateRange,
      setDateRange,
      dateRangeISO,
      dateRangeKey,
    };
  }, [dateRange]);

  return (
    <DashboardDateRangeContext.Provider value={value}>
      {children}
    </DashboardDateRangeContext.Provider>
  );
}

export function useDashboardDateRange() {
  const context = useContext(DashboardDateRangeContext);
  if (context === undefined) {
    throw new Error('useDashboardDateRange must be used within a DashboardDateRangeProvider');
  }
  return context;
}

/**
 * Optional hook that returns undefined if used outside the provider.
 * Useful for widgets that can work with or without date filtering.
 */
export function useDashboardDateRangeOptional() {
  return useContext(DashboardDateRangeContext);
}
