import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { MapPin } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
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
  const { tenantSlug } = useTenantAdminAuth();
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
      <DialogContent className="max-w-[420px] border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-foreground">Assign Zone</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Search */}
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search zones..."
            className="h-9 min-h-0 border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-emerald-500"
          />

          {/* Zone list */}
          <div className="max-h-[240px] space-y-1 overflow-y-auto">
            {zonesQuery.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full bg-muted" />
              ))
            ) : zones.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">No delivery zones yet</p>
                <Link
                  to={`/${tenantSlug}/admin/delivery-zones`}
                  className="text-xs font-medium text-emerald-500 hover:underline"
                  target="_blank"
                >
                  Set up delivery zones
                </Link>
              </div>
            ) : filteredZones.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No matching zones</p>
            ) : (
              filteredZones.map((zone, idx) => {
                const isCurrent = zone.id === driver.zone_id;
                const count = driverCounts.get(zone.id) ?? 0;
                const dotColor = ZONE_DOT_COLORS[idx % ZONE_DOT_COLORS.length];

                return (
                  <div
                    key={zone.id}
                    className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${
                      isCurrent ? 'bg-emerald-500/10' : 'hover:bg-accent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: dotColor }}
                      />
                      <span className="text-sm text-foreground">{zone.name}</span>
                      <span className="text-xs text-muted-foreground">{count} drivers</span>
                    </div>
                    {isCurrent ? (
                      <span className="text-xs font-medium text-emerald-500">Current</span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => assignZone.mutate(zone.id)}
                        disabled={assignZone.isPending}
                        className="h-7 border-border bg-transparent text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
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
          <div className="h-px bg-muted" />

          {/* Create new zone */}
          {!showCreateForm ? (
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 text-sm font-medium text-emerald-500 hover:underline"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Create New Zone
            </button>
          ) : (
            <div className="space-y-3 rounded-lg border border-border bg-background p-3">
              <Input
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                placeholder="Zone name"
                className="h-9 min-h-0 border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-emerald-500"
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
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-background'
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
                className="h-7 bg-emerald-500 text-xs text-white hover:bg-emerald-600"
              >
                {createZone.isPending ? 'Creating...' : 'Save Zone'}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="border-border">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
