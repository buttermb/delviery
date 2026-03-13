/**
 * DashboardWidgetCustomizer
 *
 * Dialog that lets admins choose which dashboard widgets to show or hide.
 * Preferences are persisted to localStorage.
 */

import { useState, useCallback, useEffect } from 'react';

import { Settings2 } from 'lucide-react';

import { logger } from '@/lib/logger';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export type CustomizableWidgetId =
  | 'revenue'
  | 'orders'
  | 'customers'
  | 'inventory'
  | 'deliveries'
  | 'recent_activity'
  | 'quick_actions'
  | 'tasks';

interface WidgetOption {
  id: CustomizableWidgetId;
  label: string;
}

const WIDGET_OPTIONS: WidgetOption[] = [
  { id: 'revenue', label: 'Revenue' },
  { id: 'orders', label: 'Orders' },
  { id: 'customers', label: 'Customers' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'deliveries', label: 'Deliveries' },
  { id: 'recent_activity', label: 'Recent Activity' },
  { id: 'quick_actions', label: 'Quick Actions' },
  { id: 'tasks', label: 'Tasks' },
];

const ALL_WIDGET_IDS: CustomizableWidgetId[] = WIDGET_OPTIONS.map((w) => w.id);

function loadEnabledWidgets(): CustomizableWidgetId[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DASHBOARD_WIDGET_CUSTOMIZATION);
    if (!raw) return ALL_WIDGET_IDS;
    const parsed = JSON.parse(raw) as CustomizableWidgetId[];
    if (!Array.isArray(parsed)) return ALL_WIDGET_IDS;
    return parsed;
  } catch {
    return ALL_WIDGET_IDS;
  }
}

function saveEnabledWidgets(ids: CustomizableWidgetId[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.DASHBOARD_WIDGET_CUSTOMIZATION, JSON.stringify(ids));
  } catch {
    logger.warn('Failed to save widget preferences');
  }
}

/**
 * Hook that returns the list of enabled widget IDs.
 */
export function useCustomizableWidgets(): CustomizableWidgetId[] {
  const [enabled, setEnabled] = useState<CustomizableWidgetId[]>(loadEnabledWidgets);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.DASHBOARD_WIDGET_CUSTOMIZATION) {
        setEnabled(loadEnabledWidgets());
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return enabled;
}

export function DashboardWidgetCustomizer() {
  const [enabled, setEnabled] = useState<Set<CustomizableWidgetId>>(
    () => new Set(loadEnabledWidgets())
  );

  const toggle = useCallback((id: CustomizableWidgetId) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      const arr = ALL_WIDGET_IDS.filter((wid) => next.has(wid));
      saveEnabledWidgets(arr);
      return next;
    });
  }, []);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          Customize
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dashboard Widgets</DialogTitle>
          <DialogDescription>
            Choose which widgets to display on your dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {WIDGET_OPTIONS.map((widget) => (
            <div key={widget.id} className="flex items-center justify-between">
              <Label htmlFor={`widget-${widget.id}`} className="cursor-pointer">
                {widget.label}
              </Label>
              <Switch
                id={`widget-${widget.id}`}
                checked={enabled.has(widget.id)}
                onCheckedChange={() => toggle(widget.id)}
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
