import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

// ---------------------------------------------------------------------------
// Color swatches for new zones
// ---------------------------------------------------------------------------

const ZONE_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#10B981',
  '#3B82F6', '#8B5CF6', '#EC4899', '#94A3B8',
] as const;

// Map zone index to a color for visual indicator
const ZONE_DOT_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F97316', '#EF4444', '#F59E0B', '#EC4899', '#06B6D4'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AssignZoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: { id: string; full_name: string; zone_id: string | null };
  tenantId: string;
}

export function AssignZoneDialog({ open, onOpenChange, driver, tenantId }: AssignZoneDialogProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneColor, setNewZoneColor] = useState<string>(ZONE_COLORS[3]);

  useEffect(() => {
    if (open) {
      setSearch('');
      setShowCreateForm(false);
      setNewZoneName('');
      setNewZoneColor(ZONE_COLORS[3]);
    }
  }, [open]);

  // Fetch zones
  const zonesQuery = useQuery({
    queryKey: [...queryKeys.delivery.zones(tenantId), 'assign-zone'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('name');
      if (error) {
        logger.error('Failed to fetch zones', error);
        throw error;
      }
      return data ?? [];
    },
    enabled: !!tenantId && open,
  });

  // Count drivers per zone
  const driverCountsQuery = useQuery({
    queryKey: [...queryKeys.couriersAdmin.byTenant(tenantId), 'zone-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('couriers')
        .select('zone_id')
        .eq('tenant_id', tenantId)
        .not('zone_id', 'is', null);
      if (error) {
        logger.error('Failed to fetch driver counts', error);
        throw error;
      }
      const counts = new Map<string, number>();
      for (const row of data ?? []) {
        if (row.zone_id) {
          counts.set(row.zone_id, (counts.get(row.zone_id) ?? 0) + 1);
        }
      }
      return counts;
    },
    enabled: !!tenantId && open,
  });

  const zones = zonesQuery.data ?? [];
  const driverCounts = driverCountsQuery.data ?? new Map<string, number>();
  const filteredZones = search
    ? zones.filter((z) => z.name.toLowerCase().includes(search.toLowerCase()))
    : zones;

  // Assign zone mutation
  const assignZone = useMutation({
    mutationFn: async (zoneId: string) => {
      const { error, count } = await supabase
        .from('couriers')
        .update({ zone_id: zoneId }, { count: 'exact' })
        .eq('id', driver.id)
        .eq('tenant_id', tenantId);
      if (error) throw error;
      if (count === 0) throw new Error('Driver not found in this tenant');

      // Log activity — safe because the update above verified tenant ownership
      const { error: logError } = await supabase.from('driver_activity_log').insert({
        tenant_id: tenantId,
        driver_id: driver.id,
        event_type: 'zone_assigned',
        event_data: { zone_id: zoneId },
      });
      if (logError) logger.error('Failed to log zone assignment', logError);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.couriersAdmin.byTenant(tenantId) });
      toast.success('Zone assigned');
      onOpenChange(false);
    },
    onError: (err) => {
      logger.error('Assign zone failed', err);
      toast.error('Failed to assign zone');
    },
  });

  // Create zone mutation
  const createZone = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('delivery_zones')
        .insert({
          tenant_id: tenantId,
          name: newZoneName.trim(),
          color: newZoneColor,
          is_active: true,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.delivery.zones(tenantId) });
      toast.success('Zone created');
      setShowCreateForm(false);
      setNewZoneName('');
      // Auto-assign the new zone
      if (data?.id) {
        assignZone.mutate(data.id);
      }
    },
    onError: (err) => {
      logger.error('Create zone failed', err);
      toast.error('Failed to create zone');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] border-[#334155] bg-[#1E293B] text-[#F8FAFC]">
        <DialogHeader>
          <DialogTitle className="text-[#F8FAFC]">Assign Zone</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Search */}
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search zones..."
            className="h-9 min-h-0 border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC] placeholder:text-[#475569] focus-visible:ring-[#10B981]"
          />

          {/* Zone list */}
          <div className="max-h-[240px] space-y-1 overflow-y-auto">
            {zonesQuery.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full bg-[#334155]" />
              ))
            ) : filteredZones.length === 0 ? (
              <p className="py-4 text-center text-xs text-[#64748B]">No zones found</p>
            ) : (
              filteredZones.map((zone, idx) => {
                const isCurrent = zone.id === driver.zone_id;
                const count = driverCounts.get(zone.id) ?? 0;
                const dotColor = ZONE_DOT_COLORS[idx % ZONE_DOT_COLORS.length];

                return (
                  <div
                    key={zone.id}
                    className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${
                      isCurrent ? 'bg-[#10B981]/10' : 'hover:bg-[#263548]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: dotColor }}
                      />
                      <span className="text-sm text-[#F8FAFC]">{zone.name}</span>
                      <span className="text-xs text-[#64748B]">{count} drivers</span>
                    </div>
                    {isCurrent ? (
                      <span className="text-xs font-medium text-[#10B981]">Current</span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => assignZone.mutate(zone.id)}
                        disabled={assignZone.isPending}
                        className="h-7 border-[#334155] bg-transparent text-xs text-[#94A3B8] hover:bg-[#263548] hover:text-[#F8FAFC]"
                      >
                        Assign
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-[#334155]" />

          {/* Create new zone */}
          {!showCreateForm ? (
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 text-sm font-medium text-[#10B981] hover:underline"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Create New Zone
            </button>
          ) : (
            <div className="space-y-3 rounded-lg border border-[#334155] bg-[#0F172A] p-3">
              <Input
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                placeholder="Zone name"
                className="h-9 min-h-0 border-[#334155] bg-[#1E293B] text-sm text-[#F8FAFC] placeholder:text-[#475569] focus-visible:ring-[#10B981]"
                data-autofocus
              />

              {/* Color swatches */}
              <div className="flex items-center gap-2">
                {ZONE_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewZoneColor(color)}
                    className={`h-6 w-6 rounded-full transition-all ${
                      newZoneColor === color
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0F172A]'
                        : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>

              <Button
                size="sm"
                onClick={() => createZone.mutate()}
                disabled={!newZoneName.trim() || createZone.isPending}
                className="h-7 bg-[#10B981] text-xs text-white hover:bg-[#059669]"
              >
                {createZone.isPending ? 'Creating...' : 'Save Zone'}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="border-[#334155]">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-[#64748B] hover:bg-[#263548] hover:text-[#F8FAFC]"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
