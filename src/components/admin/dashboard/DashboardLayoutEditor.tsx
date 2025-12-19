/**
 * DashboardLayoutEditor Component
 * 
 * Provides controls for editing dashboard layout:
 * - Edit mode toggle
 * - Preset selection
 * - Widget visibility toggles
 */

import { useDashboardLayout, type WidgetId } from '@/hooks/useDashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
    Settings2,
    LayoutGrid,
    TrendingUp,
    Package,
    RotateCcw,
    Eye,
    EyeOff,
    GripVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardLayoutEditorProps {
    className?: string;
}

export function DashboardLayoutEditor({ className }: DashboardLayoutEditorProps) {
    const {
        layout,
        isEditing,
        setIsEditing,
        applyPreset,
        resetLayout,
        toggleWidget,
    } = useDashboardLayout();

    return (
        <div className={cn('flex items-center gap-2', className)}>
            {/* Edit Mode Toggle */}
            <Button
                variant={isEditing ? 'default' : 'outline'}
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
                className="gap-2"
            >
                {isEditing ? (
                    <>
                        <GripVertical className="h-4 w-4" />
                        Editing
                    </>
                ) : (
                    <>
                        <Settings2 className="h-4 w-4" />
                        Customize
                    </>
                )}
            </Button>

            {/* Preset Dropdown */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                        <LayoutGrid className="h-4 w-4" />
                        Layout
                        <Badge variant="secondary" className="ml-1 text-xs capitalize">
                            {layout.preset}
                        </Badge>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Presets</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => applyPreset('default')}>
                        <LayoutGrid className="h-4 w-4 mr-2" />
                        Default
                        {layout.preset === 'default' && (
                            <Badge variant="outline" className="ml-auto text-xs">Active</Badge>
                        )}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => applyPreset('sales')}>
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Sales Focus
                        {layout.preset === 'sales' && (
                            <Badge variant="outline" className="ml-auto text-xs">Active</Badge>
                        )}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => applyPreset('inventory')}>
                        <Package className="h-4 w-4 mr-2" />
                        Inventory Focus
                        {layout.preset === 'inventory' && (
                            <Badge variant="outline" className="ml-auto text-xs">Active</Badge>
                        )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={resetLayout}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reset to Default
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Widget Visibility Dropdown */}
            {isEditing && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                            <Eye className="h-4 w-4" />
                            Widgets
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
                        <DropdownMenuLabel>Toggle Visibility</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {layout.widgets.map((widget) => (
                            <DropdownMenuCheckboxItem
                                key={widget.id}
                                checked={widget.visible}
                                onCheckedChange={() => toggleWidget(widget.id)}
                            >
                                {widget.visible ? (
                                    <Eye className="h-4 w-4 mr-2 text-muted-foreground" />
                                ) : (
                                    <EyeOff className="h-4 w-4 mr-2 text-muted-foreground" />
                                )}
                                {widget.label}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}

            {/* Editing indicator */}
            {isEditing && (
                <Badge variant="outline" className="text-xs animate-pulse border-primary text-primary">
                    Drag widgets to reorder
                </Badge>
            )}
        </div>
    );
}
