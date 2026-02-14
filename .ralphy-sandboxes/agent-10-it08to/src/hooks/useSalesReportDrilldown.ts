import { useState, useCallback } from 'react';

/**
 * Drilldown filter types for sales report charts
 */
export type DrilldownFilterType = 'date' | 'status' | 'product';

/**
 * Drilldown state representing the currently selected chart segment
 */
export interface DrilldownFilter {
  type: DrilldownFilterType;
  label: string;
  value: string;
}

/**
 * Hook to manage sales report chart drilldown state.
 * Tracks which chart segment was clicked and provides open/close controls.
 */
export function useSalesReportDrilldown() {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<DrilldownFilter | null>(null);

  const openDrilldown = useCallback((newFilter: DrilldownFilter) => {
    setFilter(newFilter);
    setIsOpen(true);
  }, []);

  const closeDrilldown = useCallback(() => {
    setIsOpen(false);
    setFilter(null);
  }, []);

  return {
    isOpen,
    filter,
    openDrilldown,
    closeDrilldown,
  };
}
