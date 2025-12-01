/**
 * Dashboard Widget Grid
 * Manages the layout and rendering of dashboard widgets based on user preference
 */

import { useState, useEffect } from 'react';
import { QuickActionsHub } from '@/components/tenant-admin/QuickActionsHub';
import { RealtimeSalesWidget } from '@/components/tenant-admin/RealtimeSalesWidget';
import { InventoryForecastWidget } from '@/components/tenant-admin/InventoryForecastWidget';
import { RevenueForecastWidget } from '@/components/tenant-admin/RevenueForecastWidget';
import { MultiChannelOrderList } from '@/components/tenant-admin/MultiChannelOrderList';
import { Button } from '@/components/ui/button';
import { Settings2 } from 'lucide-react';
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
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

export type WidgetId = 'quick_actions' | 'realtime_sales' | 'inventory_forecast' | 'revenue_forecast' | 'recent_orders';

interface WidgetConfig {
    id: WidgetId;
    visible: boolean;
    order: number;
    label: string;
}

const DEFAULT_CONFIG: WidgetConfig[] = [
    { id: 'quick_actions', visible: true, order: 0, label: 'Quick Actions' },
    { id: 'realtime_sales', visible: true, order: 1, label: 'Real-Time Sales' },
    { id: 'inventory_forecast', visible: true, order: 2, label: 'Inventory Forecast' },
    { id: 'revenue_forecast', visible: true, order: 3, label: 'Revenue Forecast' },
    { id: 'recent_orders', visible: true, order: 4, label: 'Recent Orders' },
];

export function DashboardWidgetGrid() {
    const { tenant } = useTenantAdminAuth();
    const tenantId = tenant?.id;
    const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_CONFIG);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load config from localStorage
    useEffect(() => {
        if (!tenantId) return;

        const savedConfig = localStorage.getItem(`dashboard_widgets_${tenantId}`);
        if (savedConfig) {
            try {
                const parsed = JSON.parse(savedConfig);
                // Merge with default to handle new widgets in future
                const merged = DEFAULT_CONFIG.map(def => {
                    const saved = parsed.find((p: WidgetConfig) => p.id === def.id);
                    return saved ? { ...def, ...saved } : def;
                });
                setWidgets(merged.sort((a, b) => a.order - b.order));
            } catch (e) {
                console.error('Failed to parse widget config', e);
            }
        }
        setIsLoaded(true);
    }, [tenantId]);

    // Save config to localStorage
    const saveConfig = (newConfig: WidgetConfig[]) => {
        setWidgets(newConfig);
        if (tenantId) {
            localStorage.setItem(`dashboard_widgets_${tenantId}`, JSON.stringify(newConfig));
        }
    };

    const toggleWidget = (id: WidgetId) => {
        const newConfig = widgets.map(w =>
            w.id === id ? { ...w, visible: !w.visible } : w
        );
        saveConfig(newConfig);
    };

    const moveWidget = (index: number, direction: 'up' | 'down') => {
        const newConfig = [...widgets];
        if (direction === 'up' && index > 0) {
            [newConfig[index], newConfig[index - 1]] = [newConfig[index - 1], newConfig[index]];
        } else if (direction === 'down' && index < newConfig.length - 1) {
            [newConfig[index], newConfig[index + 1]] = [newConfig[index + 1], newConfig[index]];
        }

        // Update order property
        newConfig.forEach((w, i) => w.order = i);
        saveConfig(newConfig);
    };

    const renderWidget = (id: WidgetId) => {
        switch (id) {
            case 'quick_actions': return <QuickActionsHub />;
            case 'realtime_sales': return <RealtimeSalesWidget />;
            case 'inventory_forecast': return <InventoryForecastWidget />;
            case 'revenue_forecast': return <RevenueForecastWidget />;
            case 'recent_orders': return <MultiChannelOrderList />;
            default: return null;
        }
    };

    if (!isLoaded) return null;

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
                            </SheetDescription>
                        </SheetHeader>
                        <div className="py-6 space-y-6">
                            {widgets.map((widget, index) => (
                                <div key={widget.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                                    <div className="flex items-center gap-3">
                                        <div className="flex flex-col gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                disabled={index === 0}
                                                onClick={() => moveWidget(index, 'up')}
                                            >
                                                ▲
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                disabled={index === widgets.length - 1}
                                                onClick={() => moveWidget(index, 'down')}
                                            >
                                                ▼
                                            </Button>
                                        </div>
                                        <Label htmlFor={`widget-${widget.id}`} className="font-medium">
                                            {widget.label}
                                        </Label>
                                    </div>
                                    <Switch
                                        id={`widget-${widget.id}`}
                                        checked={widget.visible}
                                        onCheckedChange={() => toggleWidget(widget.id)}
                                    />
                                </div>
                            ))}
                        </div>
                    </SheetContent>
                </Sheet>
            </div>

            <div className="space-y-6">
                {widgets
                    .filter(w => w.visible)
                    .map(widget => (
                        <div key={widget.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {renderWidget(widget.id)}
                        </div>
                    ))}
            </div>
        </div>
    );
}
