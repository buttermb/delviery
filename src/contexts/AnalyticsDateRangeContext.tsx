/**
 * Analytics Date Range Context
 * Provides date range state that persists across Analytics Hub tabs
 */

import { createContext, useContext } from 'react';
import { subDays } from 'date-fns';

export interface DateRangeContextType {
    dateRange: { from: Date | undefined; to: Date | undefined };
    setDateRange: (range: { from: Date | undefined; to: Date | undefined }) => void;
}

export const AnalyticsDateRangeContext = createContext<DateRangeContextType | undefined>(undefined);

export function useAnalyticsDateRange() {
    const context = useContext(AnalyticsDateRangeContext);
    if (!context) {
        // Return default values if used outside of provider
        return {
            dateRange: { from: subDays(new Date(), 29), to: new Date() },
            setDateRange: () => {},
        };
    }
    return context;
}
