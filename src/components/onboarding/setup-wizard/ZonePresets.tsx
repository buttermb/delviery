/**
 * Quick-add zone preset cards
 * 1-click templates: Nearby (5mi), Standard (10mi), Extended (20mi)
 */

import { Home, Truck, MapPin } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ZONE_PRESETS } from '@/types/setup-wizard';

import type { ZonePreset } from '@/types/setup-wizard';

const ICONS: Record<ZonePreset['id'], React.ElementType> = {
  nearby: Home,
  standard: Truck,
  extended: MapPin,
};

const COLORS: Record<ZonePreset['id'], { bg: string; icon: string; border: string }> = {
  nearby: {
    bg: 'bg-blue-50 hover:bg-blue-100',
    icon: 'text-blue-600',
    border: 'border-blue-200 hover:border-blue-300',
  },
  standard: {
    bg: 'bg-green-50 hover:bg-green-100',
    icon: 'text-green-600',
    border: 'border-green-200 hover:border-green-300',
  },
  extended: {
    bg: 'bg-orange-50 hover:bg-orange-100',
    icon: 'text-orange-600',
    border: 'border-orange-200 hover:border-orange-300',
  },
};

interface ZonePresetsProps {
  onSelectPreset: (preset: ZonePreset) => void;
  hasBusinessLocation: boolean;
  disabled?: boolean;
}

export function ZonePresets({ onSelectPreset, hasBusinessLocation, disabled }: ZonePresetsProps) {
  const isDisabled = disabled || !hasBusinessLocation;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">Quick Start</p>
      {!hasBusinessLocation && (
        <p className="text-xs text-muted-foreground">
          Add your business address above to enable zone presets
        </p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {ZONE_PRESETS.map((preset) => {
          const Icon = ICONS[preset.id];
          const colors = COLORS[preset.id];

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectPreset(preset)}
              disabled={isDisabled}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-colors text-center',
                isDisabled
                  ? 'opacity-40 cursor-not-allowed border-border bg-muted'
                  : cn(colors.bg, colors.border, 'cursor-pointer'),
                'min-h-[80px]'
              )}
            >
              <Icon className={cn('h-5 w-5', isDisabled ? 'text-muted-foreground' : colors.icon)} />
              <span className="text-sm font-medium">{preset.label}</span>
              <span className="text-[11px] text-muted-foreground">
                {preset.description} · ${preset.suggestedFee}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
