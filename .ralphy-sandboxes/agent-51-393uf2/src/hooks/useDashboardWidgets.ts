/**
 * useDashboardWidgets Hook
 *
 * Role-aware dashboard widget management that:
 * - Filters widgets based on user permissions
 * - Manages visibility toggle and reordering
 * - Persists user preferences to localStorage
 * - Defaults to hiding widgets the user cannot access
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { Permission } from '@/lib/permissions/rolePermissions';
import { logger } from '@/lib/logger';

export type DashboardWidgetId =
  | 'setup'
  | 'revenue'
  | 'orders'
  | 'customers'
  | 'inventory'
  | 'alerts'
  | 'activity';

export interface DashboardWidgetDefinition {
  id: DashboardWidgetId;
  label: string;
  defaultVisible: boolean;
  requiredPermissions: Permission[];
}

export interface DashboardWidgetState {
  id: DashboardWidgetId;
  visible: boolean;
  order: number;
}

/**
 * Widget definitions with their required permissions.
 * A widget is accessible if the user has ANY of the listed permissions.
 */
const WIDGET_DEFINITIONS: DashboardWidgetDefinition[] = [
  {
    id: 'setup',
    label: 'Setup Checklist',
    defaultVisible: true,
    requiredPermissions: ['settings:view'],
  },
  {
    id: 'revenue',
    label: 'Revenue',
    defaultVisible: true,
    requiredPermissions: ['finance:view', 'orders:view'],
  },
  {
    id: 'orders',
    label: 'Orders',
    defaultVisible: true,
    requiredPermissions: ['orders:view'],
  },
  {
    id: 'customers',
    label: 'Customers',
    defaultVisible: true,
    requiredPermissions: ['customers:view'],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    defaultVisible: true,
    requiredPermissions: ['inventory:view'],
  },
  {
    id: 'alerts',
    label: 'Alerts',
    defaultVisible: true,
    requiredPermissions: ['inventory:view'],
  },
  {
    id: 'activity',
    label: 'Activity Feed',
    defaultVisible: true,
    requiredPermissions: ['orders:view'],
  },
];

interface UseDashboardWidgetsReturn {
  /** All widgets the user is permitted to see (respecting role) */
  permittedWidgets: DashboardWidgetDefinition[];
  /** Permitted widgets filtered by user visibility preference, sorted by order */
  visibleWidgets: DashboardWidgetDefinition[];
  /** Current widget state (visibility + order) for permitted widgets only */
  widgetStates: DashboardWidgetState[];
  /** Toggle a widget's visibility */
  toggleWidget: (id: DashboardWidgetId) => void;
  /** Reorder a widget up or down */
  moveWidget: (index: number, direction: 'up' | 'down') => void;
  /** Reset to default layout */
  resetToDefaults: () => void;
  /** Whether widget preferences have been loaded from storage */
  isLoaded: boolean;
  /** Whether permissions are still loading */
  isPermissionsLoading: boolean;
}

function getStorageKey(tenantId: string): string {
  return `${STORAGE_KEYS.DASHBOARD_WIDGETS}_${tenantId}`;
}

/**
 * Hook for managing dashboard widgets with role-based access control.
 *
 * Widgets are first filtered by user permissions, then the user can
 * customize visibility and order of their permitted widgets.
 *
 * @example
 * ```tsx
 * const { visibleWidgets, toggleWidget, moveWidget } = useDashboardWidgets();
 *
 * return (
 *   <>
 *     {visibleWidgets.map(widget => (
 *       <WidgetRenderer key={widget.id} widgetId={widget.id} />
 *     ))}
 *   </>
 * );
 * ```
 */
export function useDashboardWidgets(): UseDashboardWidgetsReturn {
  const { tenant } = useTenantAdminAuth();
  const { hasPermission, isLoading: isPermissionsLoading } = usePermissions();
  const tenantId = tenant?.id;

  // Filter widgets by user permissions
  const permittedWidgets = useMemo(() => {
    if (isPermissionsLoading) return [];

    return WIDGET_DEFINITIONS.filter((widget) => {
      // Widget is permitted if user has ANY of the required permissions
      return widget.requiredPermissions.some((perm) => hasPermission(perm));
    });
  }, [hasPermission, isPermissionsLoading]);

  // Build default states from permitted widgets
  const getDefaultStates = useCallback((): DashboardWidgetState[] => {
    return permittedWidgets.map((widget, index) => ({
      id: widget.id,
      visible: widget.defaultVisible,
      order: index,
    }));
  }, [permittedWidgets]);

  const [widgetStates, setWidgetStates] = useState<DashboardWidgetState[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved preferences from localStorage, filtered by current permissions
  useEffect(() => {
    if (!tenantId || isPermissionsLoading || permittedWidgets.length === 0) {
      return;
    }

    const permittedIds = new Set(permittedWidgets.map((w) => w.id));
    let states: DashboardWidgetState[];

    try {
      const saved = localStorage.getItem(getStorageKey(tenantId));
      if (saved) {
        const parsed = JSON.parse(saved) as DashboardWidgetState[];

        // Only keep saved states for widgets the user still has permission for
        const validSaved = parsed.filter((s) => permittedIds.has(s.id));
        const savedIds = new Set(validSaved.map((s) => s.id));

        // Add any new permitted widgets not in saved state
        let maxOrder = validSaved.length;
        const newWidgets: DashboardWidgetState[] = permittedWidgets
          .filter((w) => !savedIds.has(w.id))
          .map((w) => ({
            id: w.id,
            visible: w.defaultVisible,
            order: maxOrder++,
          }));

        states = [...validSaved, ...newWidgets].sort((a, b) => a.order - b.order);
      } else {
        states = getDefaultStates();
      }
    } catch {
      logger.warn('Failed to parse dashboard widget preferences', undefined, {
        component: 'useDashboardWidgets',
      });
      states = getDefaultStates();
    }

    setWidgetStates(states);
    setIsLoaded(true);
  }, [tenantId, isPermissionsLoading, permittedWidgets, getDefaultStates]);

  // Persist to localStorage when states change
  useEffect(() => {
    if (!tenantId || !isLoaded || widgetStates.length === 0) return;

    try {
      localStorage.setItem(getStorageKey(tenantId), JSON.stringify(widgetStates));
    } catch {
      // Storage unavailable
    }
  }, [widgetStates, tenantId, isLoaded]);

  // Get visible widgets in order
  const visibleWidgets = useMemo(() => {
    return widgetStates
      .filter((s) => s.visible)
      .sort((a, b) => a.order - b.order)
      .map((s) => permittedWidgets.find((w) => w.id === s.id))
      .filter((w): w is DashboardWidgetDefinition => w !== undefined);
  }, [widgetStates, permittedWidgets]);

  const toggleWidget = useCallback((id: DashboardWidgetId) => {
    setWidgetStates((prev) =>
      prev.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s))
    );
  }, []);

  const moveWidget = useCallback((index: number, direction: 'up' | 'down') => {
    setWidgetStates((prev) => {
      const result = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;

      if (targetIndex < 0 || targetIndex >= result.length) return prev;

      [result[index], result[targetIndex]] = [result[targetIndex], result[index]];

      // Update order values
      return result.map((s, i) => ({ ...s, order: i }));
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    const defaults = getDefaultStates();
    setWidgetStates(defaults);

    if (tenantId) {
      try {
        localStorage.removeItem(getStorageKey(tenantId));
      } catch {
        // Storage unavailable
      }
    }
  }, [getDefaultStates, tenantId]);

  return {
    permittedWidgets,
    visibleWidgets,
    widgetStates,
    toggleWidget,
    moveWidget,
    resetToDefaults,
    isLoaded,
    isPermissionsLoading,
  };
}
