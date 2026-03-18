/**
 * useDashboardLayout Hook
 * 
 * Manages dashboard widget layout with localStorage persistence.
 * Supports custom layouts and presets.
 */

import { useState, useCallback, useEffect } from 'react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { STORAGE_KEYS } from '@/constants/storageKeys';

export type WidgetId =
    | 'stats'
    | 'quick-actions'
    | 'sales-chart'
    | 'revenue-prediction'
    | 'recent-orders'
    | 'inventory-alerts'
    | 'activity-feed'
    | 'location-map'
    | 'pending-transfers'
    | 'revenue-chart'
    | 'top-products'
    | 'insights';

export interface WidgetConfig {
    id: WidgetId;
    label: string;
    visible: boolean;
    order: number;
    size: 'small' | 'medium' | 'large' | 'full';
}

export interface DashboardLayout {
    widgets: WidgetConfig[];
    preset: 'default' | 'sales' | 'inventory' | 'custom';
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
    { id: 'stats', label: 'Key Metrics', visible: true, order: 0, size: 'full' },
    { id: 'quick-actions', label: 'Quick Actions', visible: true, order: 1, size: 'full' },
    { id: 'sales-chart', label: 'Sales Chart', visible: true, order: 2, size: 'large' },
    { id: 'revenue-prediction', label: 'Revenue Prediction', visible: true, order: 3, size: 'large' },
    { id: 'recent-orders', label: 'Recent Orders', visible: true, order: 4, size: 'large' },
    { id: 'inventory-alerts', label: 'Inventory Alerts', visible: true, order: 5, size: 'medium' },
    { id: 'activity-feed', label: 'Activity Feed', visible: true, order: 6, size: 'medium' },
    { id: 'location-map', label: 'Location Map', visible: true, order: 7, size: 'medium' },
    { id: 'pending-transfers', label: 'Pending Transfers', visible: true, order: 8, size: 'medium' },
    { id: 'revenue-chart', label: 'Revenue Chart', visible: true, order: 9, size: 'medium' },
    { id: 'top-products', label: 'Top Products', visible: true, order: 10, size: 'medium' },
    { id: 'insights', label: 'Actionable Insights', visible: true, order: 11, size: 'full' },
];

const SALES_PRESET: WidgetConfig[] = [
    { id: 'stats', label: 'Key Metrics', visible: true, order: 0, size: 'full' },
    { id: 'quick-actions', label: 'Quick Actions', visible: true, order: 1, size: 'full' },
    { id: 'sales-chart', label: 'Sales Chart', visible: true, order: 2, size: 'large' },
    { id: 'revenue-chart', label: 'Revenue Chart', visible: true, order: 3, size: 'large' },
    { id: 'revenue-prediction', label: 'Revenue Prediction', visible: true, order: 4, size: 'large' },
    { id: 'recent-orders', label: 'Recent Orders', visible: true, order: 5, size: 'large' },
    { id: 'top-products', label: 'Top Products', visible: true, order: 6, size: 'medium' },
    { id: 'activity-feed', label: 'Activity Feed', visible: false, order: 7, size: 'medium' },
    { id: 'inventory-alerts', label: 'Inventory Alerts', visible: false, order: 8, size: 'medium' },
    { id: 'location-map', label: 'Location Map', visible: false, order: 9, size: 'medium' },
    { id: 'pending-transfers', label: 'Pending Transfers', visible: false, order: 10, size: 'medium' },
    { id: 'insights', label: 'Actionable Insights', visible: true, order: 11, size: 'full' },
];

const INVENTORY_PRESET: WidgetConfig[] = [
    { id: 'stats', label: 'Key Metrics', visible: true, order: 0, size: 'full' },
    { id: 'quick-actions', label: 'Quick Actions', visible: true, order: 1, size: 'full' },
    { id: 'inventory-alerts', label: 'Inventory Alerts', visible: true, order: 2, size: 'large' },
    { id: 'pending-transfers', label: 'Pending Transfers', visible: true, order: 3, size: 'large' },
    { id: 'location-map', label: 'Location Map', visible: true, order: 4, size: 'large' },
    { id: 'top-products', label: 'Top Products', visible: true, order: 5, size: 'medium' },
    { id: 'activity-feed', label: 'Activity Feed', visible: true, order: 6, size: 'medium' },
    { id: 'sales-chart', label: 'Sales Chart', visible: false, order: 7, size: 'large' },
    { id: 'revenue-chart', label: 'Revenue Chart', visible: false, order: 8, size: 'medium' },
    { id: 'revenue-prediction', label: 'Revenue Prediction', visible: false, order: 9, size: 'large' },
    { id: 'recent-orders', label: 'Recent Orders', visible: false, order: 10, size: 'large' },
    { id: 'insights', label: 'Actionable Insights', visible: true, order: 11, size: 'full' },
];

const LAYOUT_STORAGE_KEY = STORAGE_KEYS.DASHBOARD_LAYOUT;

function getPresetWidgets(preset: DashboardLayout['preset']): WidgetConfig[] {
    switch (preset) {
        case 'sales':
            return [...SALES_PRESET];
        case 'inventory':
            return [...INVENTORY_PRESET];
        default:
            return [...DEFAULT_WIDGETS];
    }
}

export function useDashboardLayout() {
    const { tenant } = useTenantAdminAuth();
    const tenantId = tenant?.id;

    const [layout, setLayout] = useState<DashboardLayout>(() => {
        if (typeof window === 'undefined') {
            return { widgets: DEFAULT_WIDGETS, preset: 'default' };
        }

        const key = tenantId ? `${LAYOUT_STORAGE_KEY}-${tenantId}` : LAYOUT_STORAGE_KEY;
        const saved = localStorage.getItem(key);

        if (saved) {
            try {
                return JSON.parse(saved);
            } catch {
                return { widgets: DEFAULT_WIDGETS, preset: 'default' };
            }
        }

        return { widgets: DEFAULT_WIDGETS, preset: 'default' };
    });

    const [isEditing, setIsEditing] = useState(false);

    // Persist to localStorage when layout changes
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const key = tenantId ? `${LAYOUT_STORAGE_KEY}-${tenantId}` : LAYOUT_STORAGE_KEY;
        localStorage.setItem(key, JSON.stringify(layout));
    }, [layout, tenantId]);

    // Reorder widgets
    const reorderWidgets = useCallback((activeId: WidgetId, overId: WidgetId) => {
        setLayout((prev) => {
            const widgets = [...prev.widgets];
            const activeIndex = widgets.findIndex((w) => w.id === activeId);
            const overIndex = widgets.findIndex((w) => w.id === overId);

            if (activeIndex === -1 || overIndex === -1) return prev;

            // Swap positions
            const [removed] = widgets.splice(activeIndex, 1);
            widgets.splice(overIndex, 0, removed);

            // Update order values
            widgets.forEach((w, i) => {
                w.order = i;
            });

            return { ...prev, widgets, preset: 'custom' };
        });
    }, []);

    // Toggle widget visibility
    const toggleWidget = useCallback((widgetId: WidgetId) => {
        setLayout((prev) => {
            const widgets = prev.widgets.map((w) =>
                w.id === widgetId ? { ...w, visible: !w.visible } : w
            );
            return { ...prev, widgets, preset: 'custom' };
        });
    }, []);

    // Apply preset
    const applyPreset = useCallback((preset: DashboardLayout['preset']) => {
        setLayout({
            widgets: getPresetWidgets(preset),
            preset,
        });
    }, []);

    // Reset to default
    const resetLayout = useCallback(() => {
        applyPreset('default');
    }, [applyPreset]);

    // Get visible widgets sorted by order
    const visibleWidgets = layout.widgets
        .filter((w) => w.visible)
        .sort((a, b) => a.order - b.order);

    return {
        layout,
        visibleWidgets,
        isEditing,
        setIsEditing,
        reorderWidgets,
        toggleWidget,
        applyPreset,
        resetLayout,
    };
}
