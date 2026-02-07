/**
 * Dashboard Widget Customization
 * 
 * Allows users to customize their dashboard layout by:
 * - Showing/hiding widgets
 * - Reordering widgets via drag-and-drop
 * - Saving preferences to localStorage
 */

import { useState, useCallback, useEffect } from 'react';

export interface Widget {
    id: string;
    title: string;
    description?: string;
    icon?: string;
    defaultVisible?: boolean;
    minTier?: string;
    category?: string;
}

export interface WidgetLayout {
    id: string;
    visible: boolean;
    order: number;
}

interface UseDashboardWidgetsOptions {
    widgets: Widget[];
    storageKey?: string;
    defaultLayout?: WidgetLayout[];
}

interface UseDashboardWidgetsReturn {
    layout: WidgetLayout[];
    visibleWidgets: Widget[];
    isWidgetVisible: (widgetId: string) => boolean;
    toggleWidget: (widgetId: string) => void;
    showWidget: (widgetId: string) => void;
    hideWidget: (widgetId: string) => void;
    reorderWidgets: (startIndex: number, endIndex: number) => void;
    moveWidget: (widgetId: string, direction: 'up' | 'down') => void;
    resetToDefaults: () => void;
    isCustomized: boolean;
}

/**
 * Hook for managing dashboard widget layout and visibility
 * 
 * @example
 * ```tsx
 * const widgets: Widget[] = [
 *   { id: 'revenue', title: 'Revenue Stats', defaultVisible: true },
 *   { id: 'orders', title: 'Recent Orders', defaultVisible: true },
 *   { id: 'inventory', title: 'Inventory Alerts', defaultVisible: false },
 * ];
 * 
 * const {
 *   visibleWidgets,
 *   toggleWidget,
 *   reorderWidgets,
 * } = useDashboardWidgets({ widgets, storageKey: 'dashboard-layout' });
 * 
 * return (
 *   <DndContext onDragEnd={handleDragEnd}>
 *     {visibleWidgets.map(widget => (
 *       <WidgetComponent key={widget.id} widget={widget} />
 *     ))}
 *   </DndContext>
 * );
 * ```
 */
export function useDashboardWidgets({
    widgets,
    storageKey = 'dashboard-widgets',
    defaultLayout,
}: UseDashboardWidgetsOptions): UseDashboardWidgetsReturn {
    // Create default layout from widgets
    const getDefaultLayout = useCallback((): WidgetLayout[] => {
        if (defaultLayout) return defaultLayout;

        return widgets.map((widget, index) => ({
            id: widget.id,
            visible: widget.defaultVisible !== false,
            order: index,
        }));
    }, [widgets, defaultLayout]);

    // Initialize layout from localStorage or defaults
    const [layout, setLayout] = useState<WidgetLayout[]>(() => {
        if (typeof window === 'undefined') return getDefaultLayout();

        try {
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const parsed = JSON.parse(stored) as WidgetLayout[];

                // Merge with current widgets (in case new widgets were added)
                const layoutMap = new Map(parsed.map((l) => [l.id, l]));
                const merged: WidgetLayout[] = [];
                let maxOrder = parsed.length;

                // Add existing layouts in their saved order
                parsed.forEach((l) => {
                    if (widgets.some((w) => w.id === l.id)) {
                        merged.push(l);
                    }
                });

                // Add new widgets that weren't in saved layout
                widgets.forEach((widget) => {
                    if (!layoutMap.has(widget.id)) {
                        merged.push({
                            id: widget.id,
                            visible: widget.defaultVisible !== false,
                            order: maxOrder++,
                        });
                    }
                });

                return merged.sort((a, b) => a.order - b.order);
            }
        } catch {
            // Ignore errors
        }

        return getDefaultLayout();
    });

    // Check if layout has been customized
    const isCustomized = layout.some((l, i) => {
        const defaultL = getDefaultLayout()[i];
        return !defaultL || l.id !== defaultL.id || l.visible !== defaultL.visible;
    });

    // Persist layout to localStorage
    useEffect(() => {
        if (typeof window === 'undefined') return;

        try {
            localStorage.setItem(storageKey, JSON.stringify(layout));
        } catch {
            // Ignore storage errors
        }
    }, [layout, storageKey]);

    // Get visible widgets in order
    const visibleWidgets = layout
        .filter((l) => l.visible)
        .sort((a, b) => a.order - b.order)
        .map((l) => widgets.find((w) => w.id === l.id))
        .filter((w): w is Widget => w !== undefined);

    const isWidgetVisible = useCallback(
        (widgetId: string) => layout.find((l) => l.id === widgetId)?.visible ?? false,
        [layout]
    );

    const toggleWidget = useCallback((widgetId: string) => {
        setLayout((prev) =>
            prev.map((l) =>
                l.id === widgetId ? { ...l, visible: !l.visible } : l
            )
        );
    }, []);

    const showWidget = useCallback((widgetId: string) => {
        setLayout((prev) =>
            prev.map((l) =>
                l.id === widgetId ? { ...l, visible: true } : l
            )
        );
    }, []);

    const hideWidget = useCallback((widgetId: string) => {
        setLayout((prev) =>
            prev.map((l) =>
                l.id === widgetId ? { ...l, visible: false } : l
            )
        );
    }, []);

    const reorderWidgets = useCallback((startIndex: number, endIndex: number) => {
        setLayout((prev) => {
            const result = [...prev];
            const [removed] = result.splice(startIndex, 1);
            result.splice(endIndex, 0, removed);

            // Update order values
            return result.map((l, i) => ({ ...l, order: i }));
        });
    }, []);

    const moveWidget = useCallback((widgetId: string, direction: 'up' | 'down') => {
        setLayout((prev) => {
            const index = prev.findIndex((l) => l.id === widgetId);
            if (index === -1) return prev;

            const newIndex = direction === 'up'
                ? Math.max(0, index - 1)
                : Math.min(prev.length - 1, index + 1);

            if (newIndex === index) return prev;

            const result = [...prev];
            const [removed] = result.splice(index, 1);
            result.splice(newIndex, 0, removed);

            return result.map((l, i) => ({ ...l, order: i }));
        });
    }, []);

    const resetToDefaults = useCallback(() => {
        setLayout(getDefaultLayout());
        if (typeof window !== 'undefined') {
            try {
                localStorage.removeItem(storageKey);
            } catch {
                // Ignore errors
            }
        }
    }, [getDefaultLayout, storageKey]);

    return {
        layout,
        visibleWidgets,
        isWidgetVisible,
        toggleWidget,
        showWidget,
        hideWidget,
        reorderWidgets,
        moveWidget,
        resetToDefaults,
        isCustomized,
    };
}
