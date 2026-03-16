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

function insuranceDaysRemaining(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

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

  const daysLeft = insuranceDaysRemaining(driver.insurance_expiry);

  return (
    <div className="space-y-4">
      {/* Vehicle Information Card */}
      <div className="rounded-lg border border-[#334155] bg-[#1E293B] p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="h-5 w-5 text-[#94A3B8]" />
            <span className="text-sm font-medium text-[#F8FAFC]">Vehicle Information</span>
          </div>
          {!editing && (
            <Button
              size="sm"
              onClick={() => setEditing(true)}
              className="h-7 bg-[#10B981] text-xs text-white hover:bg-[#059669]"
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
                <Label className="mb-1 text-xs text-[#64748B]">Make</Label>
                <Input
                  {...form.register('vehicle_make')}
                  error={!!form.formState.errors.vehicle_make}
                  className="h-9 min-h-0 border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC] focus-visible:ring-[#10B981]"
                />
              </div>
              <div>
                <Label className="mb-1 text-xs text-[#64748B]">Model</Label>
                <Input
                  {...form.register('vehicle_model')}
                  error={!!form.formState.errors.vehicle_model}
                  className="h-9 min-h-0 border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC] focus-visible:ring-[#10B981]"
                />
              </div>
              <div>
                <Label className="mb-1 text-xs text-[#64748B]">Year</Label>
                <Input
                  {...form.register('vehicle_year')}
                  type="number"
                  className="h-9 min-h-0 border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC] focus-visible:ring-[#10B981]"
                />
              </div>
              <div>
                <Label className="mb-1 text-xs text-[#64748B]">Color</Label>
                <Input
                  {...form.register('vehicle_color')}
                  className="h-9 min-h-0 border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC] focus-visible:ring-[#10B981]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 text-xs text-[#64748B]">License Plate</Label>
                <Input
                  {...form.register('vehicle_plate')}
                  className="h-9 min-h-0 border-[#334155] bg-[#0F172A] text-sm uppercase text-[#F8FAFC] focus-visible:ring-[#10B981]"
                />
              </div>
              <div>
                <Label className="mb-1 text-xs text-[#64748B]">Vehicle Type</Label>
                <select
                  {...form.register('vehicle_type')}
                  className="h-9 w-full rounded-md border border-[#334155] bg-[#0F172A] px-3 text-sm text-[#F8FAFC] focus:border-[#10B981] focus:outline-none focus:ring-1 focus:ring-[#10B981]"
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
                className="h-7 text-xs text-[#64748B] hover:bg-[#263548] hover:text-[#F8FAFC]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={updateVehicle.isPending}
                className="h-7 bg-[#10B981] text-xs text-white hover:bg-[#059669]"
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
      <div className="rounded-lg border border-[#334155] bg-[#1E293B] p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-medium text-[#F8FAFC]">Insurance & Documents</span>
          {daysLeft !== null && daysLeft > 0 && daysLeft <= 30 && (
            <span className="rounded-full bg-[#F59E0B]/20 px-2 py-0.5 text-[11px] font-medium text-[#F59E0B]">
              Expiring Soon
            </span>
          )}
          {daysLeft !== null && daysLeft <= 0 && (
            <span className="rounded-full bg-[#EF4444]/20 px-2 py-0.5 text-[11px] font-medium text-[#EF4444]">
              Expired
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <InfoField label="Expiry Date" value={
            driver.insurance_expiry
              ? new Date(driver.insurance_expiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : 'Not set'
          } />
          {daysLeft !== null && daysLeft > 0 && (
            <div className="flex items-center">
              <span
                className="text-xs font-medium"
                style={{ color: daysLeft <= 30 ? '#F59E0B' : '#64748B' }}
              >
                {daysLeft} days remaining
              </span>
            </div>
          )}
        </div>
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
      <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#64748B]">
        {label}
      </span>
      <p className={`mt-0.5 text-sm text-[#F8FAFC] ${mono ? "font-['JetBrains_Mono']" : ''}`}>
        {value}
      </p>
    </div>
  );
}
