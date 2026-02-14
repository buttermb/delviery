/**
 * DashboardLayoutCustomizer Component
 *
 * A comprehensive dashboard layout customizer with drag-and-drop widget reordering.
 * Features:
 * - Drag and drop to reorder widgets
 * - Toggle widget visibility
 * - Apply layout presets (Default, Sales Focus, Inventory Focus)
 * - Reset to default layout
 * - Persists to localStorage per tenant
 */

import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import Settings2 from "lucide-react/dist/esm/icons/settings-2";
import LayoutGrid from "lucide-react/dist/esm/icons/layout-grid";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import Package from "lucide-react/dist/esm/icons/package";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw";
import GripVertical from "lucide-react/dist/esm/icons/grip-vertical";
import Eye from "lucide-react/dist/esm/icons/eye";
import EyeOff from "lucide-react/dist/esm/icons/eye-off";
import { cn } from '@/lib/utils';
import {
  useDashboardLayout,
  type WidgetConfig,
  type WidgetId,
  type DashboardLayout,
} from '@/hooks/useDashboardLayout';

interface DashboardLayoutCustomizerProps {
  /** Additional CSS classes */
  className?: string;
}

interface SortableWidgetItemProps {
  widget: WidgetConfig;
  onToggleVisibility: (id: WidgetId) => void;
}

/**
 * Individual sortable widget item with visibility toggle
 */
function SortableWidgetItem({ widget, onToggleVisibility }: SortableWidgetItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 p-3 bg-card border rounded-lg',
        'transition-all duration-200',
        isDragging && 'opacity-50 shadow-lg scale-[1.02] z-50',
        !widget.visible && 'opacity-60 bg-muted/50'
      )}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        type="button"
        className={cn(
          'flex-shrink-0 p-1 rounded hover:bg-accent',
          'cursor-grab active:cursor-grabbing',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1'
        )}
        aria-label={`Drag to reorder ${widget.label}`}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Widget Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('font-medium text-sm', !widget.visible && 'text-muted-foreground')}>
            {widget.label}
          </span>
          <Badge variant="outline" className="text-xs capitalize">
            {widget.size}
          </Badge>
        </div>
      </div>

      {/* Visibility Toggle */}
      <div className="flex items-center gap-2">
        {widget.visible ? (
          <Eye className="h-4 w-4 text-muted-foreground" />
        ) : (
          <EyeOff className="h-4 w-4 text-muted-foreground" />
        )}
        <Switch
          checked={widget.visible}
          onCheckedChange={() => onToggleVisibility(widget.id)}
          aria-label={`Toggle ${widget.label} visibility`}
        />
      </div>
    </div>
  );
}

/**
 * Drag overlay widget (shown while dragging)
 */
function DragOverlayItem({ widget }: { widget: WidgetConfig }) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 bg-card border rounded-lg shadow-xl',
        'scale-105',
        !widget.visible && 'opacity-60 bg-muted/50'
      )}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('font-medium text-sm', !widget.visible && 'text-muted-foreground')}>
            {widget.label}
          </span>
          <Badge variant="outline" className="text-xs capitalize">
            {widget.size}
          </Badge>
        </div>
      </div>
      {widget.visible ? (
        <Eye className="h-4 w-4 text-muted-foreground" />
      ) : (
        <EyeOff className="h-4 w-4 text-muted-foreground" />
      )}
    </div>
  );
}

interface PresetButtonProps {
  preset: DashboardLayout['preset'];
  currentPreset: DashboardLayout['preset'];
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

/**
 * Preset selection button
 */
function PresetButton({ preset, currentPreset, label, icon, onClick }: PresetButtonProps) {
  const isActive = preset === currentPreset;

  return (
    <Button
      variant={isActive ? 'default' : 'outline'}
      size="sm"
      onClick={onClick}
      className="flex-1 gap-2"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      {isActive && (
        <Badge variant="secondary" className="ml-auto text-xs">
          Active
        </Badge>
      )}
    </Button>
  );
}

/**
 * DashboardLayoutCustomizer - Main component
 *
 * Provides a sheet-based UI for customizing dashboard widget layout with:
 * - Drag and drop reordering
 * - Widget visibility toggles
 * - Preset layouts
 * - Reset functionality
 *
 * @example
 * ```tsx
 * <DashboardLayoutCustomizer className="ml-auto" />
 * ```
 */
export function DashboardLayoutCustomizer({ className }: DashboardLayoutCustomizerProps) {
  const {
    layout,
    reorderWidgets,
    toggleWidget,
    applyPreset,
    resetLayout,
  } = useDashboardLayout();

  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<WidgetId | null>(null);

  // Configure sensors for pointer and keyboard accessibility
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Find the active widget for drag overlay
  const activeWidget = activeId
    ? layout.widgets.find((w) => w.id === activeId)
    : null;

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as WidgetId);
  };

  // Handle drag end - reorder widgets
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);

    if (!over || active.id === over.id) return;

    reorderWidgets(active.id as WidgetId, over.id as WidgetId);
  };

  // Count visible widgets
  const visibleCount = layout.widgets.filter((w) => w.visible).length;
  const totalCount = layout.widgets.length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className={cn('gap-2', className)}>
          <Settings2 className="h-4 w-4" />
          Customize
          <Badge variant="secondary" className="text-xs">
            {visibleCount}/{totalCount}
          </Badge>
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5" />
            Customize Dashboard
          </SheetTitle>
          <SheetDescription>
            Drag widgets to reorder, toggle visibility, or select a preset layout.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Preset Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Layout Presets</Label>
            <div className="flex gap-2">
              <PresetButton
                preset="default"
                currentPreset={layout.preset}
                label="Default"
                icon={<LayoutGrid className="h-4 w-4" />}
                onClick={() => applyPreset('default')}
              />
              <PresetButton
                preset="sales"
                currentPreset={layout.preset}
                label="Sales"
                icon={<TrendingUp className="h-4 w-4" />}
                onClick={() => applyPreset('sales')}
              />
              <PresetButton
                preset="inventory"
                currentPreset={layout.preset}
                label="Inventory"
                icon={<Package className="h-4 w-4" />}
                onClick={() => applyPreset('inventory')}
              />
            </div>
            {layout.preset === 'custom' && (
              <Badge variant="outline" className="text-xs">
                Custom layout - changes saved automatically
              </Badge>
            )}
          </div>

          <Separator />

          {/* Widget List with Drag and Drop */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Widgets</Label>
              <span className="text-xs text-muted-foreground">
                {visibleCount} of {totalCount} visible
              </span>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={layout.widgets.map((w) => w.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {layout.widgets.map((widget) => (
                    <SortableWidgetItem
                      key={widget.id}
                      widget={widget}
                      onToggleVisibility={toggleWidget}
                    />
                  ))}
                </div>
              </SortableContext>

              {/* Drag Overlay */}
              <DragOverlay>
                {activeWidget && <DragOverlayItem widget={activeWidget} />}
              </DragOverlay>
            </DndContext>
          </div>

          <Separator />

          {/* Reset Button */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetLayout();
              }}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset to Default
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
