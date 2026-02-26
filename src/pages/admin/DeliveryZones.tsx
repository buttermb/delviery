/**
 * Delivery Zones Admin Page
 * Define delivery zones on a map with polygon drawing
 * Set delivery fee, minimum order, and delivery hours per zone
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';

import { useTenantContext } from '@/hooks/useTenantContext';
import { useDeliveryZones } from '@/hooks/useDeliveryZones';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { formatCurrency } from '@/lib/formatters';
import { SEOHead } from '@/components/SEOHead';
import { PullToRefresh } from '@/components/mobile/PullToRefresh';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import {
  MapPin,
  Trash2,
  Edit2,
  Clock,
  DollarSign,
  Loader2,
  Map,
  Settings,
  AlertCircle,
} from 'lucide-react';
import type { DeliveryZone, DeliveryZoneFormData, Polygon, DeliveryHours } from '@/types/delivery-zone';
import { DEFAULT_DELIVERY_HOURS } from '@/types/delivery-zone';
import { FieldHelp, fieldHelpTexts } from '@/components/ui/field-help';

// Fix Leaflet default marker icon issue
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Leaflet internal: _getIconUrl is a private property not exposed in types
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Zone form schema
const zoneFormSchema = z.object({
  name: z.string().min(1, 'Zone name is required').max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
  zip_codes: z.string().optional(),
  delivery_fee: z.number().min(0, 'Delivery fee must be 0 or greater'),
  minimum_order: z.number().min(0, 'Minimum order must be 0 or greater'),
  estimated_time_min: z.number().int().min(0),
  estimated_time_max: z.number().int().min(0),
  is_active: z.boolean(),
  priority: z.number().int().min(0),
});

type ZoneFormValues = z.infer<typeof zoneFormSchema>;

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

const DEFAULT_CENTER: L.LatLngTuple = [39.8283, -98.5795]; // Center of USA
const DEFAULT_ZOOM = 4;

export default function DeliveryZones() {
  const { tenantId: _tenantId, hasPermission, isReady } = useTenantContext();
  const {
    zones,
    isLoading,
    refetch,
    createZone,
    isCreating,
    updateZone,
    isUpdating,
    deleteZone,
    isDeleting,
    toggleZone,
  } = useDeliveryZones();

  // Map state
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const drawControlRef = useRef<L.Control.Draw | null>(null);
  const zoneLayersRef = useRef<Map<string, L.Polygon> | null>(null);

  // UI state
  const [isMapReady, setIsMapReady] = useState(false);
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentPolygon, setCurrentPolygon] = useState<Polygon>([]);
  const [deliveryHours, setDeliveryHours] = useState<DeliveryHours>(DEFAULT_DELIVERY_HOURS);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [zoneToDelete, setZoneToDelete] = useState<DeliveryZone | null>(null);
  const [hoursDialogOpen, setHoursDialogOpen] = useState(false);

  // Form
  const form = useForm<ZoneFormValues>({
    resolver: zodResolver(zoneFormSchema),
    defaultValues: {
      name: '',
      description: '',
      color: '#10b981',
      zip_codes: '',
      delivery_fee: 5,
      minimum_order: 0,
      estimated_time_min: 30,
      estimated_time_max: 60,
      is_active: true,
      priority: 0,
    },
  });

  const canManageZones = useMemo(
    () => hasPermission('manage:deliveries'),
    [hasPermission]
  );

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
      dragging: true,
      touchZoom: true,
      doubleClickZoom: true,
    }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Create feature group for drawn items
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    drawnItemsRef.current = drawnItems;

    // Initialize draw control
    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true,
          drawError: {
            color: '#e1e4e8',
            message: '<strong>Error:</strong> Shape edges cannot cross!',
          },
          shapeOptions: {
            color: '#10b981',
            fillOpacity: 0.3,
          },
        },
        polyline: false,
        circle: false,
        circlemarker: false,
        rectangle: {
          shapeOptions: {
            color: '#10b981',
            fillOpacity: 0.3,
          },
        },
        marker: false,
      },
      edit: {
        featureGroup: drawnItems,
        remove: true,
      },
    });

    map.addControl(drawControl);
    drawControlRef.current = drawControl;

    // Handle polygon creation
    map.on(L.Draw.Event.CREATED, (event: L.LeafletEvent) => {
      const layer = (event as L.DrawEvents.Created).layer as L.Polygon;
      drawnItems.addLayer(layer);

      // Extract coordinates
      const latlngs = layer.getLatLngs()[0] as L.LatLng[];
      const polygon: Polygon = latlngs.map((latlng) => [latlng.lng, latlng.lat]);
      setCurrentPolygon(polygon);

      // Open form for new zone
      setIsEditMode(false);
      setSelectedZone(null);
      form.reset({
        name: '',
        description: '',
        color: '#10b981',
        zip_codes: '',
        delivery_fee: 5,
        minimum_order: 0,
        estimated_time_min: 30,
        estimated_time_max: 60,
        is_active: true,
        priority: 0,
      });
      setDeliveryHours(DEFAULT_DELIVERY_HOURS);
      setIsFormOpen(true);
    });

    // Handle polygon edit
    map.on(L.Draw.Event.EDITED, (event: L.LeafletEvent) => {
      const layers = (event as L.DrawEvents.Edited).layers;
      layers.eachLayer((layer) => {
        if (layer instanceof L.Polygon) {
          const latlngs = layer.getLatLngs()[0] as L.LatLng[];
          const polygon: Polygon = latlngs.map((latlng) => [latlng.lng, latlng.lat]);
          setCurrentPolygon(polygon);
        }
      });
    });

    mapInstanceRef.current = map;
    setIsMapReady(true);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      setIsMapReady(false);
    };
  }, [form]);

  // Render zones on map when they change
  useEffect(() => {
    if (!mapInstanceRef.current || !isMapReady) return;

    const map = mapInstanceRef.current;

    // Clear existing zone layers
    zoneLayersRef.current.forEach((layer) => {
      map.removeLayer(layer);
    });
    zoneLayersRef.current.clear();

    // Add zone polygons
    zones.forEach((zone) => {
      if (zone.polygon && zone.polygon.length >= 3) {
        const latlngs: L.LatLngTuple[] = zone.polygon.map(([lng, lat]) => [lat, lng]);
        const polygon = L.polygon(latlngs, {
          color: zone.color || '#10b981',
          fillOpacity: zone.is_active ? 0.3 : 0.1,
          weight: zone.is_active ? 2 : 1,
          dashArray: zone.is_active ? undefined : '5, 5',
        });

        polygon.bindPopup(`
          <div style="min-width: 150px;">
            <strong>${zone.name}</strong>
            ${!zone.is_active ? '<span style="color: #666;"> (Inactive)</span>' : ''}
            <br/>
            <span style="color: #555;">Fee: ${formatCurrency(zone.delivery_fee)}</span>
            ${zone.minimum_order > 0 ? `<br/><span style="color: #555;">Min: ${formatCurrency(zone.minimum_order)}</span>` : ''}
          </div>
        `);

        polygon.on('click', () => {
          setSelectedZone(zone);
        });

        polygon.addTo(map);
        zoneLayersRef.current.set(zone.id, polygon);
      }
    });

    // Fit bounds if zones exist
    if (zones.length > 0) {
      const allCoords: L.LatLngTuple[] = [];
      zones.forEach((zone) => {
        if (zone.polygon) {
          zone.polygon.forEach(([lng, lat]) => {
            allCoords.push([lat, lng]);
          });
        }
      });
      if (allCoords.length > 0) {
        const bounds = L.latLngBounds(allCoords);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
      }
    }
  }, [zones, isMapReady]);

  // Handle form submission
  const onSubmit = async (values: ZoneFormValues) => {
    try {
      const zipCodes = values.zip_codes
        ? values.zip_codes.split(',').map((z) => z.trim()).filter(Boolean)
        : [];

      const formData: DeliveryZoneFormData = {
        name: values.name,
        description: values.description,
        color: values.color,
        polygon: currentPolygon,
        zip_codes: zipCodes,
        delivery_fee: values.delivery_fee,
        minimum_order: values.minimum_order,
        delivery_hours: deliveryHours,
        estimated_time_min: values.estimated_time_min,
        estimated_time_max: values.estimated_time_max,
        is_active: values.is_active,
        priority: values.priority,
      };

      if (isEditMode && selectedZone) {
        await updateZone({ zoneId: selectedZone.id, formData });
        toast.success("Zone updated");
      } else {
        await createZone(formData);
        toast.success("Zone created");
      }

      // Clear drawn items and reset form
      drawnItemsRef.current?.clearLayers();
      setCurrentPolygon([]);
      setIsFormOpen(false);
      setSelectedZone(null);
    } catch (error) {
      logger.error('Failed to save zone', error);
      toast.error("Failed to save zone. Please try again.");
    }
  };

  // Handle edit zone
  const handleEditZone = (zone: DeliveryZone) => {
    setIsEditMode(true);
    setSelectedZone(zone);
    setCurrentPolygon(zone.polygon);
    setDeliveryHours(zone.delivery_hours);

    form.reset({
      name: zone.name,
      description: zone.description ?? '',
      color: zone.color,
      zip_codes: zone.zip_codes.join(', '),
      delivery_fee: zone.delivery_fee,
      minimum_order: zone.minimum_order,
      estimated_time_min: zone.estimated_time_min,
      estimated_time_max: zone.estimated_time_max,
      is_active: zone.is_active,
      priority: zone.priority,
    });

    setIsFormOpen(true);
  };

  // Handle delete zone
  const handleDeleteZone = async () => {
    if (!zoneToDelete) return;

    try {
      await deleteZone(zoneToDelete.id);
      toast.success("Zone deleted");
      setDeleteDialogOpen(false);
      setZoneToDelete(null);
      setSelectedZone(null);
    } catch (error) {
      logger.error('Failed to delete zone', error);
      toast.error("Failed to delete zone. Please try again.");
    }
  };

  // Handle toggle zone active
  const handleToggleZone = async (zone: DeliveryZone) => {
    try {
      await toggleZone({ zoneId: zone.id, isActive: !zone.is_active });
      toast.success(zone.is_active ? 'Zone deactivated' : 'Zone activated');
    } catch (error) {
      logger.error('Failed to toggle zone', error);
      toast.error("Failed to update zone status.");
    }
  };

  // Update delivery hours
  const updateHours = (day: keyof DeliveryHours, field: 'open' | 'close' | 'enabled', value: string | boolean) => {
    setDeliveryHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  // Cancel form
  const handleCancelForm = () => {
    drawnItemsRef.current?.clearLayers();
    setCurrentPolygon([]);
    setIsFormOpen(false);
    setSelectedZone(null);
    form.reset();
  };

  if (!isReady) {
    return (
      <div className="w-full max-w-full px-4 py-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  return (
    <>
      <SEOHead title="Delivery Zones | Admin" description="Manage delivery zones" />

      <PullToRefresh onRefresh={async () => { await refetch(); }}>
        <div className="w-full max-w-full px-3 sm:px-4 md:px-4 py-3 sm:py-4 md:py-4 space-y-4 md:space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Map className="h-7 w-7" />
                Delivery Zones
                <FieldHelp tooltip={fieldHelpTexts.deliveryZonePolygon.tooltip} size="md" />
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Define delivery areas, fees, and hours
              </p>
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary" className="text-sm">
                {zones.filter((z) => z.is_active).length} active zone{zones.filter((z) => z.is_active).length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </div>

          {/* Instructions */}
          {canManageZones && (
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">How to create a zone:</p>
                    <ol className="list-decimal list-inside mt-1 space-y-1">
                      <li>Use the drawing tools on the right side of the map to draw a polygon</li>
                      <li>Fill in the zone details including delivery fee and hours</li>
                      <li>Save your zone to start accepting orders in that area</li>
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main content */}
          <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
            {/* Map */}
            <Card className="overflow-hidden">
              <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Zone Map
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <Skeleton className="h-[500px] w-full" />
                ) : (
                  <div ref={mapRef} className="h-[500px] w-full" />
                )}
              </CardContent>
            </Card>

            {/* Zone list */}
            <Card className="h-fit">
              <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Zones ({zones.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : zones.length === 0 ? (
                  <div className="p-8 text-center">
                    <Map className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">No zones configured</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Draw a polygon on the map to create your first zone
                    </p>
                  </div>
                ) : (
                  <div className="divide-y max-h-[450px] overflow-y-auto">
                    {zones.map((zone) => (
                      <div
                        key={zone.id}
                        className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                          selectedZone?.id === zone.id ? 'bg-muted/50 border-l-4 border-primary' : ''
                        }`}
                        onClick={() => setSelectedZone(zone)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded-full border"
                              style={{ backgroundColor: zone.color }}
                            />
                            <div>
                              <p className="font-medium text-sm">{zone.name}</p>
                              {zone.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {zone.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <Badge variant={zone.is_active ? 'default' : 'secondary'} className="text-xs">
                            {zone.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {formatCurrency(zone.delivery_fee)} fee
                          </span>
                          {zone.minimum_order > 0 && (
                            <span>{formatCurrency(zone.minimum_order)} min</span>
                          )}
                        </div>
                        {canManageZones && (
                          <div className="mt-3 flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditZone(zone);
                              }}
                            >
                              <Edit2 className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleZone(zone);
                              }}
                            >
                              {zone.is_active ? 'Deactivate' : 'Activate'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setZoneToDelete(zone);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </PullToRefresh>

      {/* Zone Form Sheet */}
      <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{isEditMode ? 'Edit Zone' : 'Create New Zone'}</SheetTitle>
            <SheetDescription>
              {isEditMode
                ? 'Update the zone settings below'
                : 'Configure delivery settings for the drawn area'}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-6">
            {/* Zone Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Zone Name *</Label>
              <Input
                id="name"
                {...form.register('name')}
                placeholder="e.g., Downtown, North Side"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...form.register('description')}
                placeholder="Optional description for this zone..."
                rows={2}
              />
              {form.formState.errors.description && (
                <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
              )}
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label htmlFor="color">Zone Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  id="color"
                  {...form.register('color')}
                  className="w-12 h-10 p-1 cursor-pointer"
                />
                <Input {...form.register('color')} className="flex-1" />
              </div>
              {form.formState.errors.color && (
                <p className="text-sm text-destructive">{form.formState.errors.color.message}</p>
              )}
            </div>

            {/* ZIP Codes */}
            <div className="space-y-2">
              <Label htmlFor="zip_codes" className="flex items-center gap-1.5">
                ZIP Codes (optional)
                <FieldHelp tooltip={fieldHelpTexts.deliveryZoneZipCodes.tooltip} example={fieldHelpTexts.deliveryZoneZipCodes.example} />
              </Label>
              <Input
                id="zip_codes"
                {...form.register('zip_codes')}
                placeholder="e.g., 10001, 10002, 10003"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated list of ZIP codes for this zone (in addition to polygon)
              </p>
            </div>

            <Separator />

            {/* Delivery Fee */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="delivery_fee">Delivery Fee ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  id="delivery_fee"
                  {...form.register('delivery_fee', { valueAsNumber: true })}
                />
                {form.formState.errors.delivery_fee && (
                  <p className="text-sm text-destructive">{form.formState.errors.delivery_fee.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="minimum_order">Minimum Order ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  id="minimum_order"
                  {...form.register('minimum_order', { valueAsNumber: true })}
                />
                {form.formState.errors.minimum_order && (
                  <p className="text-sm text-destructive">{form.formState.errors.minimum_order.message}</p>
                )}
              </div>
            </div>

            {/* Estimated Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="estimated_time_min">Est. Time Min (mins)</Label>
                <Input
                  type="number"
                  min="0"
                  id="estimated_time_min"
                  {...form.register('estimated_time_min', { valueAsNumber: true })}
                />
                {form.formState.errors.estimated_time_min && (
                  <p className="text-sm text-destructive">{form.formState.errors.estimated_time_min.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimated_time_max">Est. Time Max (mins)</Label>
                <Input
                  type="number"
                  min="0"
                  id="estimated_time_max"
                  {...form.register('estimated_time_max', { valueAsNumber: true })}
                />
                {form.formState.errors.estimated_time_max && (
                  <p className="text-sm text-destructive">{form.formState.errors.estimated_time_max.message}</p>
                )}
              </div>
            </div>

            {/* Delivery Hours */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Delivery Hours
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setHoursDialogOpen(true)}
                >
                  Configure
                </Button>
              </div>
              <div className="text-sm text-muted-foreground">
                {DAYS.filter((day) => deliveryHours[day].enabled).length} day(s) enabled
              </div>
            </div>

            <Separator />

            {/* Active Status */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Active</Label>
                <p className="text-sm text-muted-foreground">Zone accepts orders</p>
              </div>
              <Switch
                checked={form.watch('is_active')}
                onCheckedChange={(checked) => form.setValue('is_active', checked)}
              />
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority" className="flex items-center gap-1.5">
                Priority
                <FieldHelp tooltip={fieldHelpTexts.deliveryZonePriority.tooltip} example={fieldHelpTexts.deliveryZonePriority.example} />
              </Label>
              <Input
                type="number"
                id="priority"
                {...form.register('priority', { valueAsNumber: true })}
              />
              {form.formState.errors.priority && (
                <p className="text-sm text-destructive">{form.formState.errors.priority.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Higher priority zones are matched first when areas overlap
              </p>
            </div>

            {/* Polygon info */}
            {currentPolygon.length > 0 && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <p className="font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Zone Area Defined
                </p>
                <p className="text-muted-foreground text-xs mt-1">
                  {currentPolygon.length} points in polygon
                </p>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleCancelForm}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={isCreating || isUpdating || currentPolygon.length < 3}
              >
                {(isCreating || isUpdating) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditMode ? 'Update Zone' : 'Create Zone'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delivery Hours Dialog */}
      <Dialog open={hoursDialogOpen} onOpenChange={setHoursDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Delivery Hours</DialogTitle>
            <DialogDescription>
              Set delivery hours for each day of the week
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {DAYS.map((day) => (
              <div key={day} className="flex items-center gap-3">
                <Switch
                  checked={deliveryHours[day].enabled}
                  onCheckedChange={(checked) => updateHours(day, 'enabled', checked)}
                />
                <span className="w-24 capitalize text-sm font-medium">{day}</span>
                {deliveryHours[day].enabled ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      type="time"
                      value={deliveryHours[day].open}
                      onChange={(e) => updateHours(day, 'open', e.target.value)}
                      aria-label={`${day} delivery start time`}
                      className="w-28"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={deliveryHours[day].close}
                      onChange={(e) => updateHours(day, 'close', e.target.value)}
                      aria-label={`${day} delivery end time`}
                      className="w-28"
                    />
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">Closed</span>
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button onClick={() => setHoursDialogOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteZone}
        itemType="zone"
        itemName={zoneToDelete?.name}
        isLoading={isDeleting}
      />
    </>
  );
}
