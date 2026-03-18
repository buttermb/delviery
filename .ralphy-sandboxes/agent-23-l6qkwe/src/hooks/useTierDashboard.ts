import { useBusinessTier } from './useBusinessTier';
import { useMemo } from 'react';

export function useTierDashboard() {
    const { tier, preset, isLoading } = useBusinessTier();

    const widgets = useMemo(() => {
        if (!preset) return [];
        return preset.dashboardWidgets ?? [];
    }, [preset]);

    // Return true during loading to prevent widgets from disappearing
    const hasWidget = (widgetId: string) => {
        if (isLoading) return true; // Show widgets while loading
        if (!preset) return false;
        return widgets.includes(widgetId);
    };

    return {
        tier,
        preset,
        widgets,
        hasWidget,
        isLoading,
        pulseMetrics: preset?.pulseMetrics ?? [],
        quickActions: preset?.quickActions ?? [],
    };
}
