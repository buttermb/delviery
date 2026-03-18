/**
 * Dashboard Widget Grid
 * Renders dashboard widgets filtered by user role/permissions.
 * Uses useDashboardWidgets hook for role-based access control.
 */

import { QuickActionsHub } from '@/components/tenant-admin/QuickActionsHub';
import { RealtimeSalesWidget } from '@/components/tenant-admin/RealtimeSalesWidget';
import { InventoryForecastWidget } from '@/components/tenant-admin/InventoryForecastWidget';
import { RevenueForecastWidget } from '@/components/tenant-admin/RevenueForecastWidget';
import { MultiChannelOrderList } from '@/components/tenant-admin/MultiChannelOrderList';
import { StorefrontPerformanceWidget } from '@/components/tenant-admin/StorefrontPerformanceWidget';
import { Button } from '@/components/ui/button';
import { Settings2, RotateCcw } from 'lucide-react';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useDashboardWidgets, DashboardWidgetId } from '@/hooks/useDashboardWidgets';
import { Skeleton } from '@/components/ui/skeleton';

function renderWidget(id: DashboardWidgetId) {
    switch (id) {
        case 'quick_actions': return <QuickActionsHub />;
        case 'realtime_sales': return <RealtimeSalesWidget />;
        case 'storefront_summary': return <StorefrontPerformanceWidget />;
        case 'inventory_forecast': return <InventoryForecastWidget />;
        case 'revenue_forecast': return <RevenueForecastWidget />;
        case 'recent_orders': return <MultiChannelOrderList />;
        default: return null;
    }
}

export function DashboardWidgetGrid() {
    const {
        permittedWidgets,
        visibleWidgets,
        widgetStates,
        toggleWidget,
        moveWidget,
        resetToDefaults,
        isLoaded,
        isPermissionsLoading,
    } = useDashboardWidgets();

    if (isPermissionsLoading || !isLoaded) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-48 ml-auto" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
            </div>
        );
    }

    if (widgetStates.length === 0) {
        return null;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                            <Settings2 className="h-4 w-4" />
                            Customize Dashboard
                        </Button>
                    </SheetTrigger>
                    <SheetContent>
                        <SheetHeader>
                            <SheetTitle>Customize Dashboard</SheetTitle>
                            <SheetDescription>
                                Toggle visibility and reorder your widgets.
                                Only widgets you have permission to access are shown.
                            </SheetDescription>
                        </SheetHeader>
                        <div className="py-6 space-y-4">
                            {widgetStates.map((state, index) => {
                                const def = permittedWidgets.find(w => w.id === state.id);

                                return (
                                    <div key={state.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-col gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    disabled={index === 0}
                                                    onClick={() => moveWidget(index, 'up')}
                                                    aria-label="Move widget up"
                                                >
                                                    ▲
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    disabled={index === widgetStates.length - 1}
                                                    onClick={() => moveWidget(index, 'down')}
                                                    aria-label="Move widget down"
                                                >
                                                    ▼
                                                </Button>
                                            </div>
                                            <Label htmlFor={`widget-${state.id}`} className="font-medium">
                                                {def?.label ?? state.id}
                                            </Label>
                                        </div>
                                        <Switch
                                            id={`widget-${state.id}`}
                                            checked={state.visible}
                                            onCheckedChange={() => toggleWidget(state.id)}
                                        />
                                    </div>
                                );
                            })}
                            <Button
                                variant="ghost"
                                size="sm"
                                className="gap-2 mt-4 w-full"
                                onClick={resetToDefaults}
                            >
                                <RotateCcw className="h-4 w-4" />
                                Reset to Defaults
                            </Button>
                        </div>
                    </SheetContent>
                </Sheet>
            </div>

            <div className="space-y-6">
                {visibleWidgets.map(widget => (
                    <div key={widget.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {renderWidget(widget.id)}
                    </div>
                ))}
            </div>
        </div>
    );
}
