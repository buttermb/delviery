import { useBusinessTier } from './useBusinessTier';
import { useMemo } from 'react';

export function useTierDashboard() {
    const { tier, preset, isLoading } = useBusinessTier();

    const widgets = useMemo(() => {
        if (!preset) return [];
        return preset.dashboardWidgets || [];
    }, [preset]);

    const hasWidget = (widgetId: string) => {
        if (!preset) return false;
        // 'all' support if we ever add it to widgets, though usually explicit
        return widgets.includes(widgetId);
    };

    return {
        tier,
        preset,
        widgets,
        hasWidget,
        isLoading,
        pulseMetrics: preset?.pulseMetrics || [],
        quickActions: preset?.quickActions || [],
    };
}
