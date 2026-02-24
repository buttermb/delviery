/**
 * Widget Customizer Component
 * UI for customizing dashboard widget layout
 */

import { useState } from 'react';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
    Settings2,
    GripVertical,
    ChevronUp,
    ChevronDown,
    RotateCcw,
    Eye,
    EyeOff,
    LayoutDashboard,
} from 'lucide-react';
import { DashboardWidgetDefinition, DashboardWidgetState } from '@/hooks/useDashboardWidgets';

type Widget = DashboardWidgetDefinition & { title?: string; icon?: string; description?: string };
type WidgetLayout = DashboardWidgetState;

interface WidgetCustomizerProps {
    widgets: Widget[];
    layout: WidgetLayout[];
    onToggle: (widgetId: string) => void;
    onMove: (widgetId: string, direction: 'up' | 'down') => void;
    onReset: () => void;
    isCustomized: boolean;
    trigger?: React.ReactNode;
}

/**
 * Widget Customizer Sheet
 * Opens a side panel for managing widget visibility and order
 */
export function WidgetCustomizer({
    widgets,
    layout,
    onToggle,
    onMove,
    onReset,
    isCustomized,
    trigger,
}: WidgetCustomizerProps) {
    const [open, setOpen] = useState(false);

    // Get widgets in layout order
    const orderedWidgets = layout
        .map((l) => ({
            layout: l,
            widget: widgets.find((w) => w.id === l.id),
        }))
        .filter((item): item is { layout: WidgetLayout; widget: Widget } =>
            item.widget !== undefined
        );

    const visibleCount = layout.filter((l) => l.visible).length;
    const totalCount = widgets.length;

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm" className="gap-2">
                        <Settings2 className="h-4 w-4" />
                        Customize
                        {isCustomized && (
                            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                                Custom
                            </Badge>
                        )}
                    </Button>
                )}
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        <LayoutDashboard className="h-5 w-5" />
                        Customize Dashboard
                    </SheetTitle>
                    <SheetDescription>
                        Show, hide, and reorder your dashboard widgets.
                        <br />
                        <span className="text-xs">
                            {visibleCount} of {totalCount} widgets visible
                        </span>
                    </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                    {orderedWidgets.map(({ layout: l, widget }, index) => (
                        <div
                            key={widget.id}
                            className={cn(
                                'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                                l.visible
                                    ? 'bg-card border-border'
                                    : 'bg-muted/50 border-muted opacity-60'
                            )}
                        >
                            {/* Drag Handle */}
                            <div className="cursor-grab text-muted-foreground hover:text-foreground">
                                <GripVertical className="h-5 w-5" />
                            </div>

                            {/* Widget Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    {widget.icon && (
                                        <span className="text-lg">{widget.icon}</span>
                                    )}
                                    <span className="font-medium text-sm truncate">
                                        {widget.title}
                                    </span>
                                </div>
                                {widget.description && (
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                                        {widget.description}
                                    </p>
                                )}
                                {'category' in widget && (widget as Record<string, unknown>).category && (
                                    <Badge variant="outline" className="text-[10px] mt-1">
                                        {String((widget as Record<string, unknown>).category)}
                                    </Badge>
                                )}
                            </div>

                            {/* Reorder Buttons */}
                            <div className="flex flex-col gap-0.5">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => onMove(widget.id, 'up')}
                                    disabled={index === 0}
                                >
                                    <ChevronUp className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => onMove(widget.id, 'down')}
                                    disabled={index === orderedWidgets.length - 1}
                                >
                                    <ChevronDown className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* Visibility Toggle */}
                            <div className="flex items-center gap-2">
                                {l.visible ? (
                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                )}
                                <Switch
                                    checked={l.visible}
                                    onCheckedChange={() => onToggle(widget.id)}
                                    aria-label={`Toggle ${widget.title}`}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                <SheetFooter className="mt-6">
                    <div className="flex items-center justify-between w-full">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onReset}
                            disabled={!isCustomized}
                            className="gap-2"
                        >
                            <RotateCcw className="h-4 w-4" />
                            Reset to Default
                        </Button>
                        <Button onClick={() => setOpen(false)}>
                            Done
                        </Button>
                    </div>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}

/**
 * Simple inline widget toggle
 */
interface WidgetToggleProps {
    widget: Widget;
    visible: boolean;
    onToggle: () => void;
}

export function WidgetToggle({ widget, visible, onToggle }: WidgetToggleProps) {
    return (
        <button
            onClick={onToggle}
            className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors',
                visible
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
        >
            {widget.icon && <span>{widget.icon}</span>}
            <span>{widget.title}</span>
        </button>
    );
}

/**
 * Preset layouts for quick selection
 */
interface LayoutPreset {
    id: string;
    name: string;
    description: string;
    visibleWidgets: string[];
}

interface LayoutPresetsProps {
    presets: LayoutPreset[];
    widgets: Widget[];
    currentLayout: WidgetLayout[];
    onApplyPreset: (visibleWidgets: string[]) => void;
}

export function LayoutPresets({
    presets,
    onApplyPreset,
}: LayoutPresetsProps) {
    return (
        <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Quick Presets</p>
            <div className="flex flex-wrap gap-2">
                {presets.map((preset) => (
                    <Button
                        key={preset.id}
                        variant="outline"
                        size="sm"
                        onClick={() => onApplyPreset(preset.visibleWidgets)}
                        className="text-xs"
                    >
                        {preset.name}
                    </Button>
                ))}
            </div>
        </div>
    );
}

export default WidgetCustomizer;
