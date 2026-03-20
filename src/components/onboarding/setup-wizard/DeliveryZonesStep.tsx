/**
 * Setup Wizard Step 3: Smart Delivery Zones & Fees
 * Features: ZIP chip input with geocoding, zone presets, auto-fill, graceful degradation
 */

import { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { MapPin, Plus, Loader2, CheckCircle2, Trash2, Info } from 'lucide-react';

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
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import { ZipCodeInput } from '@/components/onboarding/setup-wizard/ZipCodeInput';
import { ZonePresets } from '@/components/onboarding/setup-wizard/ZonePresets';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import {
  calculateDistance,
  suggestDeliveryFee,
  generateZoneName,
} from '@/lib/deliveryZoneHelpers';

import type { ZipChip, ZonePreset } from '@/types/setup-wizard';

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
  id: string;
  name: string;
  delivery_fee: number;
  zip_codes: string[];
}

interface BusinessLocation {
  address: string;
  lat: number;
  lng: number;
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

  // Smart features state
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || null;
  const hasSmartFeatures = !!mapboxToken;
  const [businessLocation, setBusinessLocation] = useState<BusinessLocation | null>(null);
  const [businessAddress, setBusinessAddress] = useState('');
  const [zipChips, setZipChips] = useState<ZipChip[]>([]);

  const form = useForm<DeliveryZoneFormData>({
    resolver: zodResolver(deliveryZoneSchema),
    defaultValues: {
      name: '',
      zip_codes: '',
      delivery_fee: '',
      minimum_order: '',
    },
  });

  // Auto-fill zone name when ZIP chips change
  useEffect(() => {
    if (!hasSmartFeatures || zipChips.length === 0) return;
    const validChips = zipChips.filter((c) => c.status === 'valid');
    if (validChips.length === 0) return;

    const name = generateZoneName(zipChips);
    if (name) {
      form.setValue('name', name, { shouldValidate: true });
    }
  }, [zipChips, hasSmartFeatures, form]);

  // Auto-suggest fee when ZIP chips change + business location available
  useEffect(() => {
    if (!businessLocation || zipChips.length === 0) return;
    const validChips = zipChips.filter((c) => c.status === 'valid' && c.lat !== 0);
    if (validChips.length === 0) return;

    const avgDistance =
      validChips.reduce(
        (sum, chip) =>
          sum + calculateDistance(businessLocation.lat, businessLocation.lng, chip.lat, chip.lng),
        0
      ) / validChips.length;

    const fee = suggestDeliveryFee(avgDistance);
    form.setValue('delivery_fee', fee.toString(), { shouldValidate: true });
  }, [zipChips, businessLocation, form]);

  const handleSelectAddress = useCallback(
    (address: string, lat: number, lng: number) => {
      setBusinessLocation({ address, lat, lng });
    },
    []
  );

  const handleSelectPreset = useCallback(
    (preset: ZonePreset) => {
      form.setValue('name', preset.label, { shouldValidate: true });
      form.setValue('delivery_fee', preset.suggestedFee.toString(), { shouldValidate: true });
      setZipChips([]);
    },
    [form]
  );

  const handleZipChipsChange = useCallback((chips: ZipChip[]) => {
    setZipChips(chips);
  }, []);

  const onSubmitZone = async (data: DeliveryZoneFormData) => {
    if (!tenant?.id) return;
    setIsSubmitting(true);

    try {
      // Derive zip codes from chips (smart mode) or from text input (fallback mode)
      let zipCodes: string[];
      if (hasSmartFeatures) {
        zipCodes = zipChips.map((c) => c.zip);
      } else {
        zipCodes = data.zip_codes
          ? data.zip_codes.split(',').map((zc) => zc.trim()).filter(Boolean)
          : [];
      }

      const { data: inserted, error } = await supabase
        .from('delivery_zones')
        .insert({
          tenant_id: tenant.id,
          name: data.name,
          delivery_fee: Number(data.delivery_fee),
          minimum_order: data.minimum_order ? Number(data.minimum_order) : 0,
          zip_codes: zipCodes,
          is_active: true,
        })
        .select('id')
        .single();

      if (error) throw error;

      setAddedZones((prev) => [
        ...prev,
        {
          id: inserted.id,
          name: data.name,
          delivery_fee: Number(data.delivery_fee),
          zip_codes: zipCodes,
        },
      ]);
      form.reset();
      setZipChips([]);
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
        .eq('id', zone.id);

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
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-xl">
          <MapPin className="h-6 w-6 text-orange-600 dark:text-orange-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Delivery Zones & Fees</h3>
          <p className="text-sm text-muted-foreground">Define where you deliver and how much it costs</p>
        </div>
      </div>

      {/* Business Location (smart mode only) */}
      {hasSmartFeatures && (
        <div className="space-y-2">
          <FormLabel>Business Location</FormLabel>
          <AddressAutocomplete
            value={businessAddress}
            onChange={setBusinessAddress}
            onSelectAddress={handleSelectAddress}
            placeholder="Enter your business address for smart zone suggestions"
          />
          {businessLocation && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Location set — zone presets and fee suggestions enabled
            </p>
          )}
        </div>
      )}

      {/* Zone Presets (smart mode only) */}
      {hasSmartFeatures && (
        <ZonePresets
          onSelectPreset={handleSelectPreset}
          hasBusinessLocation={!!businessLocation}
        />
      )}

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

      {/* Zone Form */}
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
                {hasSmartFeatures && zipChips.length > 0 && (
                  <FormDescription>Auto-filled from ZIP code cities</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          {/* ZIP Codes — smart chips or plain text fallback */}
          {hasSmartFeatures ? (
            <div className="space-y-2">
              <FormLabel>ZIP Codes</FormLabel>
              <ZipCodeInput
                value={zipChips}
                onChange={handleZipChipsChange}
                mapboxToken={mapboxToken}
              />
              <p className="text-xs text-muted-foreground">
                Type a ZIP code and press Enter to add
              </p>
            </div>
          ) : (
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
          )}

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
                  {hasSmartFeatures && businessLocation && zipChips.length > 0 && (
                    <FormDescription>Suggested from distance</FormDescription>
                  )}
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

      {/* Fallback hint when no Mapbox token */}
      {!hasSmartFeatures && (
        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Add a Mapbox token in settings for smart zone features like ZIP code geocoding, zone presets, and auto-fill.
          </p>
        </div>
      )}

      {/* Continue / Skip */}
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
