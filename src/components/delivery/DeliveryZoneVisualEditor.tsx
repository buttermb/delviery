/**
 * Task 341: Delivery Zone Visual Map Editor
 * Advanced visual editor for delivery zones with map integration, polygon drawing, and fee configuration.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Plus, Trash2, Save, Edit, Loader2, Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import { formatCurrency } from '@/lib/formatters';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

const zoneFormSchema = z.object({
  name: z.string().min(2, 'Zone name required'),
  delivery_fee: z.string().min(1, 'Fee required').refine(
    (val) => !isNaN(Number(val)) && Number(val) >= 0,
    'Fee must be a valid number'
  ),
  minimum_order: z.string().optional(),
  zip_codes: z.string().optional(),
});

type ZoneFormData = z.infer<typeof zoneFormSchema>;

interface DeliveryZone {
  id: string;
  name: string;
  delivery_fee: number;
  minimum_order: number;
  zip_codes: string[];
  is_active: boolean;
  bounds?: { lat: number; lng: number }[];
}

export function DeliveryZoneVisualEditor() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polygonsRef = useRef<Map<string, L.Polygon>>(new Map());

  const form = useForm<ZoneFormData>({
    resolver: zodResolver(zoneFormSchema),
    defaultValues: {
      name: '',
      delivery_fee: '',
      minimum_order: '',
      zip_codes: '',
    },
  });

  // Fetch delivery zones
  const { data: zones = [], isLoading } = useQuery({
    queryKey: queryKeys.delivery.zones(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('name');

      if (error) throw error;
      return data as unknown as DeliveryZone[];
    },
    enabled: !!tenant?.id,
  });

  // Create zone mutation
  const createZone = useMutation({
    mutationFn: async (data: ZoneFormData) => {
      if (!tenant?.id) throw new Error('No tenant');
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.delivery.zones(tenant?.id) });
      toast.success('Zone created successfully');
      form.reset();
    },
    onError: (error) => {
      logger.error('Failed to create delivery zone', error instanceof Error ? error : new Error(String(error)), { component: 'DeliveryZoneVisualEditor' });
      toast.error('Failed to create zone', { description: humanizeError(error) });
    },
  });

  // Update zone mutation
  const updateZone = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<DeliveryZone> }) => {
      if (!tenant?.id) throw new Error('No tenant');
      const { error } = await supabase
        .from('delivery_zones')
        .update(data)
        .eq('id', id)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.delivery.zones(tenant?.id) });
      toast.success('Zone updated successfully');
    },
    onError: (error) => {
      logger.error('Failed to update delivery zone', error instanceof Error ? error : new Error(String(error)), { component: 'DeliveryZoneVisualEditor' });
      toast.error('Failed to update zone', { description: humanizeError(error) });
    },
  });

  // Delete zone mutation
  const deleteZone = useMutation({
    mutationFn: async (id: string) => {
      if (!tenant?.id) throw new Error('No tenant');
      const { error } = await supabase
        .from('delivery_zones')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.delivery.zones(tenant?.id) });
      toast.success('Zone deleted successfully');
      setSelectedZone(null);
    },
    onError: (error) => {
      logger.error('Failed to delete delivery zone', error instanceof Error ? error : new Error(String(error)), { component: 'DeliveryZoneVisualEditor' });
      toast.error('Failed to delete zone', { description: humanizeError(error) });
    },
  });

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
      dragging: true,
      touchZoom: true,
      doubleClickZoom: true,
    }).setView([39.8283, -98.5795], 4);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 18,
    }).addTo(map);

    mapInstanceRef.current = map;
    setIsMapReady(true);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      setIsMapReady(false);
    };
  }, []);

  // Render zones on map
  const renderZones = useCallback(() => {
    if (!mapInstanceRef.current || !isMapReady) return;

    const map = mapInstanceRef.current;

    // Clear existing polygons
    polygonsRef.current.forEach((polygon) => {
      map.removeLayer(polygon);
    });
    polygonsRef.current.clear();

    // Add new polygons
    zones.forEach((zone) => {
      if (!zone.bounds || zone.bounds.length < 3) return;

      const polygon = L.polygon(
        zone.bounds.map((b) => [b.lat, b.lng] as [number, number]),
        {
          color: selectedZone?.id === zone.id ? '#16a34a' : '#94a3b8',
          fillColor: getFillColor(zone.delivery_fee),
          fillOpacity: 0.4,
          weight: selectedZone?.id === zone.id ? 3 : 2,
        }
      );

      polygon.bindPopup(`
        <div style="min-width: 140px; font-family: system-ui, sans-serif;">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px;">
            ${zone.name}
          </div>
          <div style="font-size: 13px; color: #666; margin-bottom: 3px;">
            Fee: <strong>${formatCurrency(zone.delivery_fee)}</strong>
          </div>
          ${zone.minimum_order ? `
          <div style="font-size: 13px; color: #666;">
            Min Order: <strong>${formatCurrency(zone.minimum_order)}</strong>
          </div>
          ` : ''}
        </div>
      `);

      polygon.on('click', () => {
        setSelectedZone(zone);
      });

      polygon.addTo(map);
      polygonsRef.current.set(zone.id, polygon);
    });
  }, [zones, selectedZone, isMapReady]);

  useEffect(() => {
    renderZones();
  }, [renderZones]);

  const getFillColor = (fee: number): string => {
    if (fee === 0) return '#10b981';
    if (fee <= 5) return '#22c55e';
    if (fee <= 10) return '#eab308';
    if (fee <= 15) return '#f59e0b';
    return '#ef4444';
  };

  const handleSubmit = (data: ZoneFormData) => {
    createZone.mutate(data);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Delivery Zone Visual Editor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            ref={mapRef}
            className="w-full rounded-lg border overflow-hidden"
            style={{ height: 500 }}
          />

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-4 w-4" />
            <span>Click zones to select and edit. Color intensity represents delivery fee.</span>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span>Free</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span>$5-10</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span>$10-15</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>$15+</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Zone Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedZone ? 'Edit Zone' : 'Create New Zone'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zone Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Downtown, North Side" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="delivery_fee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Delivery Fee ($)</FormLabel>
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
                      <FormLabel>Minimum Order ($)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormDescription>Optional minimum order value</FormDescription>
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
                        <Input placeholder="90210, 90211, 90212" {...field} />
                      </FormControl>
                      <FormDescription>Comma-separated ZIP codes</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={createZone.isPending}
                >
                  {createZone.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Zone
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Zones List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Delivery Zones</span>
              <Badge variant="secondary">{zones.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              </div>
            ) : zones.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No zones configured</p>
              </div>
            ) : (
              <div className="space-y-2">
                {zones.map((zone) => (
                  <div
                    key={zone.id}
                    className={`p-3 rounded-lg border transition-all cursor-pointer ${
                      selectedZone?.id === zone.id
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedZone(zone)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{zone.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(zone.delivery_fee)} fee
                          {zone.minimum_order > 0 && ` · $${zone.minimum_order} min`}
                        </div>
                        {zone.zip_codes.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {zone.zip_codes.length} ZIP code{zone.zip_codes.length !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteZone.mutate(zone.id);
                          }}
                          disabled={deleteZone.isPending}
                          aria-label={`Delete ${zone.name} zone`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
