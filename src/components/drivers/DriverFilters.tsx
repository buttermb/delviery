import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

export interface DriverFilterValues {
  status: string;
  availability: string;
  vehicleType: string;
  ratingMin: number;
  ratingMax: number;
  zones: string[];
}

interface DriverFiltersProps {
  values: DriverFilterValues;
  tenantId: string;
  onApply: (values: DriverFilterValues) => void;
  onClear: () => void;
  activeCount: number;
}

// ---------------------------------------------------------------------------
// Chip toggle helper
// ---------------------------------------------------------------------------

function ChipToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-[#10B981] text-white'
          : 'bg-[#1E293B] text-[#94A3B8] hover:bg-[#263548] hover:text-[#F8FAFC]'
      }`}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DriverFilters({ values, tenantId, onApply, onClear, activeCount }: DriverFiltersProps) {
  const [draft, setDraft] = useState<DriverFilterValues>(values);

  // Fetch zones for multi-select
  const zonesQuery = useQuery({
    queryKey: [...queryKeys.delivery.zones(tenantId), 'filter-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('delivery_zones')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('name');
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  const zones = zonesQuery.data ?? [];

  function toggleChip(field: 'status' | 'availability' | 'vehicleType', value: string) {
    setDraft((prev) => ({
      ...prev,
      [field]: prev[field] === value ? 'all' : value,
    }));
  }

  function toggleZone(zoneId: string) {
    setDraft((prev) => {
      const next = prev.zones.includes(zoneId)
        ? prev.zones.filter((z) => z !== zoneId)
        : [...prev.zones, zoneId];
      return { ...prev, zones: next };
    });
  }

  return (
    <div className="rounded-lg border border-[#334155] bg-[#1E293B] p-4">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Status */}
        <div>
          <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.05em] text-[#64748B]">
            Status
          </label>
          <div className="flex flex-wrap gap-1.5">
            {['active', 'pending', 'inactive', 'suspended'].map((s) => (
              <ChipToggle
                key={s}
                label={s.charAt(0).toUpperCase() + s.slice(1)}
                active={draft.status === s}
                onClick={() => toggleChip('status', s)}
              />
            ))}
          </div>
        </div>

        {/* Availability */}
        <div>
          <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.05em] text-[#64748B]">
            Availability
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[
              { value: 'online', label: 'Online' },
              { value: 'offline', label: 'Offline' },
              { value: 'on_delivery', label: 'On Delivery' },
            ].map((a) => (
              <ChipToggle
                key={a.value}
                label={a.label}
                active={draft.availability === a.value}
                onClick={() => toggleChip('availability', a.value)}
              />
            ))}
          </div>
        </div>

        {/* Vehicle type */}
        <div>
          <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.05em] text-[#64748B]">
            Vehicle Type
          </label>
          <div className="flex flex-wrap gap-1.5">
            {['car', 'van', 'truck', 'bike'].map((v) => (
              <ChipToggle
                key={v}
                label={v.charAt(0).toUpperCase() + v.slice(1)}
                active={draft.vehicleType === v}
                onClick={() => toggleChip('vehicleType', v)}
              />
            ))}
          </div>
        </div>

        {/* Rating range */}
        <div>
          <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.05em] text-[#64748B]">
            Rating: {draft.ratingMin.toFixed(1)} – {draft.ratingMax.toFixed(1)}
          </label>
          <Slider
            min={1}
            max={5}
            step={0.5}
            value={[draft.ratingMin, draft.ratingMax]}
            onValueChange={([min, max]) =>
              setDraft((prev) => ({ ...prev, ratingMin: min, ratingMax: max }))
            }
            className="[&_[data-radix-slider-range]]:bg-[#10B981] [&_[data-radix-slider-thumb]]:border-[#10B981] [&_[data-radix-slider-thumb]]:bg-[#0F172A] [&_[data-radix-slider-track]]:bg-[#334155]"
          />
        </div>
      </div>

      {/* Zones row */}
      {zones.length > 0 && (
        <div className="mt-4">
          <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.05em] text-[#64748B]">
            Zones
          </label>
          <div className="flex flex-wrap gap-1.5">
            {zones.map((z) => (
              <ChipToggle
                key={z.id}
                label={z.name}
                active={draft.zones.includes(z.id)}
                onClick={() => toggleZone(z.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center justify-end gap-2">
        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const cleared: DriverFilterValues = {
                status: 'all',
                availability: 'all',
                vehicleType: 'all',
                ratingMin: 1,
                ratingMax: 5,
                zones: [],
              };
              setDraft(cleared);
              onClear();
            }}
            className="h-7 text-xs text-[#64748B] hover:bg-[#263548] hover:text-[#F8FAFC]"
          >
            Clear All
          </Button>
        )}
        <Button
          size="sm"
          onClick={() => onApply(draft)}
          className="h-7 bg-[#10B981] text-xs text-white hover:bg-[#059669]"
        >
          Apply Filters
        </Button>
      </div>
    </div>
  );
}
