/**
 * Setup Wizard Step 3: Set Delivery Zones and Fees
 * Add delivery zones with names, zip codes, and fee amounts
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { MapPin, Plus, Loader2, CheckCircle2, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';

const deliveryZoneSchema = z.object({
  name: z.string().min(2, 'Zone name is required'),
  zip_codes: z.string().optional(),
  delivery_fee: z.string().min(1, 'Delivery fee is required').refine(
    (val) => !isNaN(Number(val)) && Number(val) >= 0,
    'Fee must be a valid number'
  ),
  minimum_order: z.string().optional(),
});

type DeliveryZoneFormData = z.infer<typeof deliveryZoneSchema>;

interface AddedZone {
  name: string;
  delivery_fee: number;
  zip_codes: string[];
}

interface DeliveryZonesStepProps {
  onComplete: () => void;
}

export function DeliveryZonesStep({ onComplete }: DeliveryZonesStepProps) {
  const { tenant } = useTenantAdminAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addedZones, setAddedZones] = useState<AddedZone[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [zoneToDelete, setZoneToDelete] = useState<number | null>(null);

  const form = useForm<DeliveryZoneFormData>({
    resolver: zodResolver(deliveryZoneSchema),
    defaultValues: {
      name: '',
      zip_codes: '',
      delivery_fee: '',
      minimum_order: '',
    },
  });

  const onSubmitZone = async (data: DeliveryZoneFormData) => {
    if (!tenant?.id) return;
    setIsSubmitting(true);

    try {
      const zipCodes = data.zip_codes
        ? data.zip_codes.split(',').map((z) => z.trim()).filter(Boolean)
        : [];

      const { error } = await supabase
        .from('delivery_zones')
        .insert({
          tenant_id: tenant.id,
          name: data.name,
          delivery_fee: Number(data.delivery_fee),
          minimum_order: data.minimum_order ? Number(data.minimum_order) : 0,
          zip_codes: zipCodes,
          is_active: true,
        });

      if (error) throw error;

      setAddedZones((prev) => [
        ...prev,
        {
          name: data.name,
          delivery_fee: Number(data.delivery_fee),
          zip_codes: zipCodes,
        },
      ]);
      form.reset();
      toast.success(`Zone "${data.name}" added!`);
    } catch (error) {
      logger.error('Failed to add delivery zone', error instanceof Error ? error : new Error(String(error)), { component: 'DeliveryZonesStep' });
      toast.error('Failed to add zone. Please try again.', { description: humanizeError(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeZone = async (index: number) => {
    const zone = addedZones[index];
    if (!tenant?.id) return;

    try {
      const { error } = await supabase
        .from('delivery_zones')
        .delete()
        .eq('tenant_id', tenant.id)
        .eq('name', zone.name);

      if (error) throw error;

      setAddedZones((prev) => prev.filter((_, i) => i !== index));
      toast.success(`Zone "${zone.name}" removed`);
    } catch (error) {
      logger.error('Failed to remove delivery zone', error instanceof Error ? error : new Error(String(error)), { component: 'DeliveryZonesStep' });
      toast.error('Failed to remove zone', { description: humanizeError(error) });
    }
  };

  const handleConfirmDelete = async () => {
    if (zoneToDelete !== null) {
      await removeZone(zoneToDelete);
      setDeleteDialogOpen(false);
      setZoneToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-xl">
          <MapPin className="h-6 w-6 text-orange-600 dark:text-orange-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Delivery Zones & Fees</h3>
          <p className="text-sm text-muted-foreground">Define where you deliver and how much it costs</p>
        </div>
      </div>

      {/* Added zones list */}
      {addedZones.length > 0 && (
        <div className="space-y-2">
          {addedZones.map((zone, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">{zone.name}</span>
                <span className="text-xs text-muted-foreground">
                  ${zone.delivery_fee.toFixed(2)} fee
                  {zone.zip_codes.length > 0 && ` · ${zone.zip_codes.length} zip codes`}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 sm:h-7 sm:w-7"
                onClick={() => { setZoneToDelete(i); setDeleteDialogOpen(true); }}
                aria-label={`Delete ${zone.name} delivery zone`}
              >
                <Trash2 className="h-3 w-3 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmitZone)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Zone Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Downtown, Suburbs" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="zip_codes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ZIP Codes</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., 90210, 90211, 90212" {...field} />
                </FormControl>
                <FormDescription>Comma-separated list of zip codes (optional)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="delivery_fee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Delivery Fee ($)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min="0" placeholder="5.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="minimum_order"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Min. Order ($)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button type="submit" variant="outline" disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding Zone...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add Zone
              </>
            )}
          </Button>
        </form>
      </Form>

      {addedZones.length > 0 ? (
        <Button onClick={onComplete} className="w-full">
          Continue to Next Step
        </Button>
      ) : (
        <button
          type="button"
          onClick={onComplete}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
        >
          Skip for now
        </button>
      )}

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        itemType="delivery zone"
        itemName={addedZones[zoneToDelete ?? 0]?.name}
      />
    </div>
  );
}
