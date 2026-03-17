import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Car } from 'lucide-react';

import type { DriverProfile } from '@/pages/drivers/DriverProfilePage';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const vehicleSchema = z.object({
  vehicle_make: z.string().min(1, 'Required').max(50),
  vehicle_model: z.string().min(1, 'Required').max(50),
  vehicle_year: z.coerce.number().int().min(1990).max(2030),
  vehicle_color: z.string().min(1, 'Required').max(30),
  vehicle_plate: z.string().min(1, 'Required').max(20),
  vehicle_type: z.enum(['car', 'van', 'motorcycle', 'bicycle', 'truck']),
});

type VehicleFormValues = z.infer<typeof vehicleSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Insurance expiry is not yet tracked in the database
// Placeholder for future implementation

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface VehicleTabProps {
  driver: DriverProfile;
  tenantId: string;
}

export function VehicleTab({ driver, tenantId }: VehicleTabProps) {
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      vehicle_make: driver.vehicle_make ?? '',
      vehicle_model: driver.vehicle_model ?? '',
      vehicle_year: driver.vehicle_year ?? new Date().getFullYear(),
      vehicle_color: driver.vehicle_color ?? '',
      vehicle_plate: driver.vehicle_plate ?? '',
      vehicle_type: (driver.vehicle_type as VehicleFormValues['vehicle_type']) ?? 'car',
    },
  });

  const updateVehicle = useMutation({
    mutationFn: async (values: VehicleFormValues) => {
      const { error } = await supabase
        .from('couriers')
        .update(values)
        .eq('id', driver.id)
        .eq('tenant_id', tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.couriersAdmin.byTenant(tenantId) });
      toast.success('Vehicle information updated');
      setEditing(false);
    },
    onError: (err) => {
      logger.error('Vehicle update failed', err);
      toast.error('Failed to update vehicle');
    },
  });

  return (
    <div className="space-y-4">
      {/* Vehicle Information Card */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Vehicle Information</span>
          </div>
          {!editing && (
            <Button
              size="sm"
              onClick={() => setEditing(true)}
              className="h-7 bg-emerald-500 text-xs text-white hover:bg-emerald-600"
            >
              Edit Vehicle
            </Button>
          )}
        </div>

        {editing ? (
          <form
            onSubmit={form.handleSubmit((v) => updateVehicle.mutate(v))}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div>
                <Label className="mb-1 text-xs text-muted-foreground">Make</Label>
                <Input
                  {...form.register('vehicle_make')}
                  error={!!form.formState.errors.vehicle_make}
                  className="h-9 min-h-0 border-border bg-background text-sm text-foreground focus-visible:ring-emerald-500"
                />
              </div>
              <div>
                <Label className="mb-1 text-xs text-muted-foreground">Model</Label>
                <Input
                  {...form.register('vehicle_model')}
                  error={!!form.formState.errors.vehicle_model}
                  className="h-9 min-h-0 border-border bg-background text-sm text-foreground focus-visible:ring-emerald-500"
                />
              </div>
              <div>
                <Label className="mb-1 text-xs text-muted-foreground">Year</Label>
                <Input
                  {...form.register('vehicle_year')}
                  type="number"
                  className="h-9 min-h-0 border-border bg-background text-sm text-foreground focus-visible:ring-emerald-500"
                />
              </div>
              <div>
                <Label className="mb-1 text-xs text-muted-foreground">Color</Label>
                <Input
                  {...form.register('vehicle_color')}
                  className="h-9 min-h-0 border-border bg-background text-sm text-foreground focus-visible:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 text-xs text-muted-foreground">License Plate</Label>
                <Input
                  {...form.register('vehicle_plate')}
                  className="h-9 min-h-0 border-border bg-background text-sm uppercase text-foreground focus-visible:ring-emerald-500"
                />
              </div>
              <div>
                <Label className="mb-1 text-xs text-muted-foreground">Vehicle Type</Label>
                <select
                  {...form.register('vehicle_type')}
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {['car', 'van', 'motorcycle', 'bicycle', 'truck'].map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { setEditing(false); form.reset(); }}
                className="h-7 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={updateVehicle.isPending}
                className="h-7 bg-emerald-500 text-xs text-white hover:bg-emerald-600"
              >
                Save Changes
              </Button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <InfoField label="Make & Model" value={`${driver.vehicle_make ?? '—'} ${driver.vehicle_model ?? ''} ${driver.vehicle_year ?? ''}`} />
            <InfoField label="License Plate" value={driver.vehicle_plate ?? '—'} mono />
            <InfoField label="Color" value={driver.vehicle_color ?? '—'} />
            <InfoField label="Year" value={String(driver.vehicle_year ?? '—')} />
            <InfoField label="Vehicle Type" value={driver.vehicle_type ? driver.vehicle_type.charAt(0).toUpperCase() + driver.vehicle_type.slice(1) : '—'} />
          </div>
        )}
      </div>

      {/* Insurance & Documents Card */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Insurance & Documents</span>
        </div>
        <p className="text-xs text-muted-foreground">No insurance documents on file.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Info field helper
// ---------------------------------------------------------------------------

function InfoField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </span>
      <p className={`mt-0.5 text-sm text-foreground ${mono ? "font-['JetBrains_Mono']" : ''}`}>
        {value}
      </p>
    </div>
  );
}
