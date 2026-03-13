/**
 * Task 341: Create delivery zone visual map editor
 * Visual map editor for drawing and editing delivery zones with polygons
 */

import React, { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Polygon, Marker, useMapEvents } from 'react-leaflet';
import { Map as MapIcon, Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import 'leaflet/dist/leaflet.css';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/hooks/useTenantAdminAuth';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import type { DeliveryZone, Polygon as PolygonType, Coordinate } from '@/types/delivery-zone';

interface DeliveryZoneMapEditorProps {
  zoneId?: string;
  onSave?: () => void;
}

function MapClickHandler({ onAddPoint }: { onAddPoint: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      onAddPoint(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function DeliveryZoneMapEditor({ zoneId, onSave }: DeliveryZoneMapEditorProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [zoneName, setZoneName] = useState('');
  const [color, setColor] = useState('#16a34a');
  const [deliveryFee, setDeliveryFee] = useState('0');
  const [minimumOrder, setMinimumOrder] = useState('0');
  const [polygon, setPolygon] = useState<PolygonType>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  // Fetch existing zone if editing
  const { data: zone } = useQuery({
    queryKey: queryKeys.deliveryZones.detail(tenant?.id || '', zoneId || ''),
    queryFn: async () => {
      if (!zoneId || !tenant?.id) return null;
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .eq('id', zoneId)
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (error) throw error;
      return data as DeliveryZone | null;
    },
    enabled: !!zoneId && !!tenant?.id,
  });

  React.useEffect(() => {
    if (zone) {
      setZoneName(zone.name);
      setColor(zone.color);
      setDeliveryFee(zone.delivery_fee.toString());
      setMinimumOrder(zone.minimum_order.toString());
      setPolygon(zone.polygon);
    }
  }, [zone]);

  const handleAddPoint = useCallback((lat: number, lng: number) => {
    if (!isDrawing) return;
    const newPoint: Coordinate = [lng, lat]; // GeoJSON format: [lng, lat]
    setPolygon((prev) => [...prev, newPoint]);
  }, [isDrawing]);

  const handleStartDrawing = () => {
    setIsDrawing(true);
    setPolygon([]);
  };

  const handleClearPolygon = () => {
    setPolygon([]);
    setIsDrawing(false);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id) throw new Error('No tenant');
      if (polygon.length < 3) throw new Error('Polygon must have at least 3 points');

      const zoneData = {
        tenant_id: tenant.id,
        name: zoneName,
        color,
        polygon,
        delivery_fee: parseFloat(deliveryFee),
        minimum_order: parseFloat(minimumOrder),
        zip_codes: [],
        delivery_hours: {
          monday: { open: '09:00', close: '21:00', enabled: true },
          tuesday: { open: '09:00', close: '21:00', enabled: true },
          wednesday: { open: '09:00', close: '21:00', enabled: true },
          thursday: { open: '09:00', close: '21:00', enabled: true },
          friday: { open: '09:00', close: '21:00', enabled: true },
          saturday: { open: '10:00', close: '18:00', enabled: true },
          sunday: { open: '10:00', close: '18:00', enabled: false },
        },
        estimated_time_min: 30,
        estimated_time_max: 60,
        is_active: true,
        priority: 1,
      };

      if (zoneId) {
        const { error } = await supabase
          .from('delivery_zones')
          .update(zoneData)
          .eq('id', zoneId)
          .eq('tenant_id', tenant.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('delivery_zones')
          .insert(zoneData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(zoneId ? 'Zone updated' : 'Zone created');
      queryClient.invalidateQueries({ queryKey: queryKeys.deliveryZones.all });
      onSave?.();
    },
    onError: (error) => {
      logger.error('Failed to save delivery zone', error);
      toast.error('Failed to save zone');
    },
  });

  const center: [number, number] = [40.7128, -74.0060]; // NYC default

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapIcon className="h-5 w-5" />
          {zoneId ? 'Edit Delivery Zone' : 'Create Delivery Zone'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="zoneName">Zone Name</Label>
            <Input
              id="zoneName"
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
              placeholder="e.g., Manhattan Downtown"
            />
          </div>
          <div>
            <Label htmlFor="color">Zone Color</Label>
            <div className="flex gap-2">
              <Input
                id="color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-20"
              />
              <Input value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="deliveryFee">Delivery Fee ($)</Label>
            <Input
              id="deliveryFee"
              type="number"
              step="0.01"
              value={deliveryFee}
              onChange={(e) => setDeliveryFee(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="minimumOrder">Minimum Order ($)</Label>
            <Input
              id="minimumOrder"
              type="number"
              step="0.01"
              value={minimumOrder}
              onChange={(e) => setMinimumOrder(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant={isDrawing ? 'destructive' : 'default'}
            onClick={isDrawing ? handleClearPolygon : handleStartDrawing}
          >
            {isDrawing ? (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Draw Zone
              </>
            )}
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!zoneName || polygon.length < 3 || saveMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? 'Saving...' : 'Save Zone'}
          </Button>
        </div>

        <div className="h-96 rounded-lg overflow-hidden border">
          <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            {isDrawing && <MapClickHandler onAddPoint={handleAddPoint} />}
            {polygon.length > 0 && (
              <Polygon
                positions={polygon.map(([lng, lat]) => [lat, lng])}
                pathOptions={{ color }}
              />
            )}
            {polygon.map(([lng, lat], idx) => (
              <Marker key={idx} position={[lat, lng]} />
            ))}
          </MapContainer>
        </div>

        {polygon.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {polygon.length} point{polygon.length !== 1 ? 's' : ''} drawn
            {polygon.length < 3 && ' (need at least 3 to save)'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
