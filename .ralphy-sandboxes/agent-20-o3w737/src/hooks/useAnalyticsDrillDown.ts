/**
 * Analytics Drill-Down Hook
 *
 * Manages state for analytics drill-down functionality.
 * Tracks which data point was clicked and what records to show.
 * Uses useEntityNavigation for cross-module navigation from drill-down views.
 */

import { useState, useCallback, useMemo } from 'react';

import type { EntityType } from '@/lib/constants/entityTypes';
import { useEntityNavigation } from '@/hooks/useEntityNavigation';
import { logger } from '@/lib/logger';

export interface DrillDownContext {
  /** The entity type being drilled into (ORDER, CUSTOMER, DELIVERY, PRODUCT) */
  entityType: EntityType;
  /** Human-readable title for the drill-down panel */
  title: string;
  /** The filter key that was clicked (e.g. a date string, customer type, status) */
  filterKey: string;
  /** The filter value label for display */
  filterLabel: string;
  /** The raw records matching the clicked data point */
  records: DrillDownRecord[];
}

export interface DrillDownRecord {
  id: string;
  label: string;
  sublabel?: string;
  value?: string;
  entityType: EntityType;
}

export interface UseAnalyticsDrillDownResult {
  /** Current drill-down context, null when closed */
  drillDown: DrillDownContext | null;
  /** Open a drill-down panel with the given context */
  openDrillDown: (context: DrillDownContext) => void;
  /** Close the drill-down panel */
  closeDrillDown: () => void;
  /** Navigate to a specific entity from the drill-down list */
  navigateToRecord: (entityType: EntityType, entityId: string) => void;
  /** Whether the drill-down panel is open */
  isOpen: boolean;
  /** Breadcrumb trail for the drill-down path */
  breadcrumbTrail: Array<{ label: string; onClick?: () => void }>;
}

export function useAnalyticsDrillDown(
  analyticsLabel: string
): UseAnalyticsDrillDownResult {
  const [drillDown, setDrillDown] = useState<DrillDownContext | null>(null);
  const { navigateToEntity } = useEntityNavigation();

  const openDrillDown = useCallback(
    (context: DrillDownContext) => {
      logger.debug('[useAnalyticsDrillDown] Opening drill-down', {
        entityType: context.entityType,
        filterKey: context.filterKey,
        recordCount: context.records.length,
      });
      setDrillDown(context);
    },
    []
  );

  const closeDrillDown = useCallback(() => {
    logger.debug('[useAnalyticsDrillDown] Closing drill-down');
    setDrillDown(null);
  }, []);

  const navigateToRecord = useCallback(
    (entityType: EntityType, entityId: string) => {
      logger.debug('[useAnalyticsDrillDown] Navigating to record', {
        entityType,
        entityId,
      });
      navigateToEntity(entityType, entityId);
    },
    [navigateToEntity]
  );

  const isOpen = drillDown !== null;

  const breadcrumbTrail = useMemo(() => {
    const trail: Array<{ label: string; onClick?: () => void }> = [
      { label: analyticsLabel, onClick: closeDrillDown },
    ];

    if (drillDown) {
      trail.push({
        label: `${drillDown.filterLabel}`,
      });
    }

    return trail;
  }, [analyticsLabel, drillDown, closeDrillDown]);

  return {
    drillDown,
    openDrillDown,
    closeDrillDown,
    navigateToRecord,
    isOpen,
    breadcrumbTrail,
  };
}
