/**
 * WidgetCustomizePanel Component
 *
 * Popover-based dashboard widget customization panel.
 * Allows admins to toggle widget visibility and reorder widgets
 * with up/down controls. Respects role-based permissions.
 */

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import Settings2 from "lucide-react/dist/esm/icons/settings-2";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw";
import type { DashboardWidgetId, DashboardWidgetState, DashboardWidgetDefinition } from '@/hooks/useDashboardWidgets';

interface WidgetCustomizePanelProps {
  widgetStates: DashboardWidgetState[];
  permittedWidgets: DashboardWidgetDefinition[];
  toggleWidget: (id: DashboardWidgetId) => void;
  moveWidget: (index: number, direction: 'up' | 'down') => void;
  resetToDefaults: () => void;
}

export function WidgetCustomizePanel({
  widgetStates,
  permittedWidgets,
  toggleWidget,
  moveWidget,
  resetToDefaults,
}: WidgetCustomizePanelProps) {
  const visibleCount = widgetStates.filter((s) => s.visible).length;
  const totalCount = widgetStates.length;

  const getLabel = (id: DashboardWidgetId): string => {
    return permittedWidgets.find((w) => w.id === id)?.label ?? id;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          Customize
          <Badge variant="secondary" className="text-xs">
            {visibleCount}/{totalCount}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="p-3 border-b">
          <p className="text-sm font-medium">Dashboard Widgets</p>
          <p className="text-xs text-muted-foreground">
            Toggle visibility and reorder sections
          </p>
        </div>

        <div className="p-2 max-h-[320px] overflow-y-auto space-y-1">
          {widgetStates.map((state, index) => (
            <div
              key={state.id}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50"
            >
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => moveWidget(index, 'up')}
                  disabled={index === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label={`Move ${getLabel(state.id)} up`}
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => moveWidget(index, 'down')}
                  disabled={index === widgetStates.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label={`Move ${getLabel(state.id)} down`}
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>
              <span className="flex-1 text-sm truncate">
                {getLabel(state.id)}
              </span>
              <Switch
                checked={state.visible}
                onCheckedChange={() => toggleWidget(state.id)}
                aria-label={`Toggle ${getLabel(state.id)}`}
              />
            </div>
          ))}
        </div>

        <Separator />

        <div className="p-2 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetToDefaults}
            className="gap-1.5 text-xs"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
