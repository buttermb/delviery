/**
 * 🚚 Mobile Runner View
 * Mobile-optimized view for delivery runners
 *
 * Features:
 * - Shows assigned deliveries in route order
 * - Customer details, address, items, special instructions
 * - Navigation button to open maps app
 * - Status update buttons (picked up, in transit, delivered)
 * - Photo proof of delivery upload
 * - Offline support with queue sync
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { DeliveryStatus } from '@/types/interconnected';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Navigation,
  Phone,
  CheckCircle2,
  MapPin,
  Package,
  Clock,
  Camera,
  AlertTriangle,
  RefreshCw,
  WifiOff,
  Truck,
  ArrowRight,
  User,
  FileText,
  ChevronDown,
  ChevronUp,
  X,
  Upload,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { logger } from '@/lib/logger';
import { useOnlineStatus } from '@/hooks/useOfflineQueue';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/queryKeys';
import { STORAGE_KEYS } from '@/constants/storageKeys';

// Types for delivery data
interface DeliveryItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface RunnerDelivery {
  id: string;
  order_id: string;
  order_number: string;
  status: DeliveryStatus;
  customer_name: string;
  customer_phone: string | null;
  delivery_address: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  items: DeliveryItem[];
  special_instructions: string | null;
  scheduled_at: string | null;
  estimated_delivery_at: string | null;
  route_order: number;
  total_amount: number;
  tenant_id: string;
}

interface OfflineAction {
  id: string;
  type: 'status_update' | 'photo_upload';
  deliveryId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

// Offline storage key
const OFFLINE_QUEUE_KEY = STORAGE_KEYS.RUNNER_OFFLINE_QUEUE;

export default function RunnerView() {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const [runnerId, setRunnerId] = useState<string | null>(null);
  const [runnerIdInput, setRunnerIdInput] = useState('');
  const [expandedDelivery, setExpandedDelivery] = useState<string | null>(null);
  const [photoProofDeliveryId, setPhotoProofDeliveryId] = useState<string | null>(null);
  const [proofPhoto, setProofPhoto] = useState<File | null>(null);
  const [proofPhotoPreview, setProofPhotoPreview] = useState<string | null>(null);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [offlineQueue, setOfflineQueue] = useState<OfflineAction[]>([]);

  // Load offline queue from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (stored) {
        setOfflineQueue(JSON.parse(stored));
      }
    } catch (error) {
      logger.error('Failed to load offline queue', error);
    }
  }, []);

  // Save offline queue to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(offlineQueue));
    } catch (error) {
      logger.error('Failed to save offline queue', error);
    }
  }, [offlineQueue]);

  // Keep a ref to the latest syncOfflineQueue so the effect
  // always calls the current version without re-running when the callback identity changes.
  const syncOfflineQueueRef = useRef<() => void>(() => {});
  // syncOfflineQueueRef is updated later after syncOfflineQueue is declared via useCallback

  // Sync offline queue when coming back online.
  // Only `isOnline` is a trigger — the queue length guard prevents unnecessary calls.
  useEffect(() => {
    if (isOnline) {
      syncOfflineQueueRef.current();
    }
  }, [isOnline]);

  // Check for existing runner session
  useEffect(() => {
    const storedRunnerId = localStorage.getItem(STORAGE_KEYS.RUNNER_ID);
    if (storedRunnerId) {
      setRunnerId(storedRunnerId);
    }
  }, []);

  // Fetch assigned deliveries
  const { data: deliveries = [], isLoading, refetch } = useQuery({
    queryKey: queryKeys.runnerDeliveries.byRunner(runnerId),
    queryFn: async (): Promise<RunnerDelivery[]> => {
      if (!runnerId) return [];

      // Query orders assigned to this runner/courier
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          customer_name,
          customer_phone,
          delivery_address,
          delivery_lat,
          delivery_lng,
          special_instructions,
          delivery_scheduled_at,
          estimated_delivery_at,
          total_amount,
          tenant_id,
          courier_id,
          order_items:order_items(
            id,
            product_name,
            quantity,
            unit_price
          )
        `)
        .eq('courier_id', runnerId)
        .in('status', ['confirmed', 'processing', 'out_for_delivery', 'picked_up', 'in_transit'])
        .order('delivery_scheduled_at', { ascending: true });

      if (error) {
        logger.error('Failed to fetch runner deliveries', error);
        throw error;
      }

      // Transform to RunnerDelivery format with route order
      return (data ?? []).map((order, index) => ({
        id: order.id,
        order_id: order.id,
        order_number: order.order_number || `ORD-${order.id.slice(0, 8)}`,
        status: mapOrderStatusToDeliveryStatus(order.status),
        customer_name: order.customer_name || 'Unknown Customer',
        customer_phone: order.customer_phone,
        delivery_address: order.delivery_address || 'No address provided',
        delivery_lat: order.delivery_lat,
        delivery_lng: order.delivery_lng,
        items: (order.order_items ?? []).map((item: Record<string, unknown>) => ({
          id: item.id as string,
          product_name: item.product_name as string || 'Unknown Item',
          quantity: item.quantity as number || 1,
          unit_price: item.unit_price as number ?? 0,
        })),
        special_instructions: order.special_instructions,
        scheduled_at: order.delivery_scheduled_at,
        estimated_delivery_at: order.estimated_delivery_at,
        route_order: index + 1,
        total_amount: order.total_amount ?? 0,
        tenant_id: order.tenant_id,
      }));
    },
    enabled: !!runnerId,
    refetchInterval: isOnline ? 30000 : false, // Refresh every 30 seconds when online
  });

  // Set up realtime subscription for delivery updates
  useEffect(() => {
    if (!runnerId) return;

    const channel = supabase
      .channel(`runner-deliveries-${runnerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `courier_id=eq.${runnerId}`,
        },
        () => {
          logger.debug('Delivery update received');
          refetch();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('Subscribed to runner delivery updates');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [runnerId, refetch]);

  // Status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ deliveryId, newStatus, tenantId }: {
      deliveryId: string;
      newStatus: string;
      tenantId: string;
    }) => {
      const updates: Record<string, unknown> = {
        status: mapDeliveryStatusToOrderStatus(newStatus),
        updated_at: new Date().toISOString(),
      };

      if (newStatus === 'picked_up') {
        updates.courier_picked_up_at = new Date().toISOString();
      } else if (newStatus === 'in_transit') {
        updates.status = 'out_for_delivery';
      } else if (newStatus === 'delivered') {
        updates.delivered_at = new Date().toISOString();
        updates.delivery_completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', deliveryId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.runnerDeliveries.all });
      toast.success('Status updated');
    },
    onError: (error) => {
      logger.error('Failed to update status', error);
      toast.error('Failed to update status', { description: humanizeError(error) });
    },
  });

  // Photo upload mutation
  const uploadProofMutation = useMutation({
    mutationFn: async ({ deliveryId, photo, notes, tenantId }: {
      deliveryId: string;
      photo: File;
      notes: string;
      tenantId: string;
    }) => {
      // Upload photo to storage
      const fileName = `delivery-proofs/${tenantId}/${deliveryId}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('public')
        .upload(fileName, photo, {
          contentType: photo.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('public')
        .getPublicUrl(fileName);

      // Update order with proof
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          proof_photo_url: publicUrl,
          delivery_notes: notes,
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          delivery_completed_at: new Date().toISOString(),
        })
        .eq('id', deliveryId)
        .eq('tenant_id', tenantId);

      if (updateError) throw updateError;

      return publicUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.runnerDeliveries.all });
      toast.success('Delivery completed with proof');
      setPhotoProofDeliveryId(null);
      setProofPhoto(null);
      setProofPhotoPreview(null);
      setDeliveryNotes('');
    },
    onError: (error) => {
      logger.error('Failed to upload proof', error);
      toast.error('Failed to upload proof', { description: humanizeError(error) });
    },
  });

  // Map order status to delivery status
  function mapOrderStatusToDeliveryStatus(orderStatus: string): DeliveryStatus {
    const mapping: Record<string, DeliveryStatus> = {
      confirmed: 'assigned',
      processing: 'assigned',
      picked_up: 'picked_up',
      out_for_delivery: 'in_transit',
      in_transit: 'in_transit',
      delivered: 'delivered',
      cancelled: 'cancelled',
    };
    return mapping[orderStatus] || 'pending';
  }

  // Map delivery status to order status
  function mapDeliveryStatusToOrderStatus(deliveryStatus: string): string {
    const mapping: Record<string, string> = {
      assigned: 'confirmed',
      picked_up: 'picked_up',
      in_transit: 'out_for_delivery',
      delivered: 'delivered',
      cancelled: 'cancelled',
    };
    return mapping[deliveryStatus] || deliveryStatus;
  }

  // Handle status update (with offline support)
  const handleStatusUpdate = useCallback(async (
    delivery: RunnerDelivery,
    newStatus: DeliveryStatus
  ) => {
    if (!isOnline) {
      // Queue for offline sync
      const action: OfflineAction = {
        id: `${Date.now()}-${delivery.id}`,
        type: 'status_update',
        deliveryId: delivery.id,
        data: {
          newStatus,
          tenantId: delivery.tenant_id
        },
        timestamp: new Date().toISOString(),
      };
      setOfflineQueue(prev => [...prev, action]);
      toast.info('Status update queued for sync');
      return;
    }

    updateStatusMutation.mutate({
      deliveryId: delivery.id,
      newStatus,
      tenantId: delivery.tenant_id,
    });
  }, [isOnline, updateStatusMutation]);

  // Handle photo capture
  const handlePhotoCapture = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setProofPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProofPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  // Submit proof of delivery
  const handleSubmitProof = useCallback(async (delivery: RunnerDelivery) => {
    if (!proofPhoto) {
      toast.error('Please take a photo');
      return;
    }

    if (!isOnline) {
      // Queue for offline sync
      const action: OfflineAction = {
        id: `${Date.now()}-${delivery.id}`,
        type: 'photo_upload',
        deliveryId: delivery.id,
        data: {
          notes: deliveryNotes,
          tenantId: delivery.tenant_id,
          // Note: Can't queue actual file for offline, just metadata
        },
        timestamp: new Date().toISOString(),
      };
      setOfflineQueue(prev => [...prev, action]);
      toast.info('Proof queued for upload when online');
      setPhotoProofDeliveryId(null);
      return;
    }

    uploadProofMutation.mutate({
      deliveryId: delivery.id,
      photo: proofPhoto,
      notes: deliveryNotes,
      tenantId: delivery.tenant_id,
    });
  }, [proofPhoto, deliveryNotes, isOnline, uploadProofMutation]);

  // Sync offline queue
  const syncOfflineQueue = useCallback(async () => {
    if (!isOnline || offlineQueue.length === 0) return;

    const toProcess = [...offlineQueue];
    const failed: OfflineAction[] = [];

    for (const action of toProcess) {
      try {
        if (action.type === 'status_update') {
          await updateStatusMutation.mutateAsync({
            deliveryId: action.deliveryId,
            newStatus: action.data.newStatus as string,
            tenantId: action.data.tenantId as string,
          });
        }
        // Photo uploads need to be re-captured when online
      } catch (error) {
        logger.error('Failed to sync offline action', error);
        failed.push(action);
      }
    }

    setOfflineQueue(failed);
    if (toProcess.length - failed.length > 0) {
      toast.success(`Synced ${toProcess.length - failed.length} offline actions`);
    }
  }, [isOnline, offlineQueue, updateStatusMutation]);

  // Update the ref after syncOfflineQueue is declared
  useEffect(() => { syncOfflineQueueRef.current = syncOfflineQueue; }, [syncOfflineQueue]);

  // Open maps for navigation
  const openMapsNavigation = useCallback((delivery: RunnerDelivery) => {
    const address = encodeURIComponent(delivery.delivery_address);

    // Check for coordinates
    if (delivery.delivery_lat && delivery.delivery_lng) {
      // Use coordinates for more accurate navigation
      const coords = `${delivery.delivery_lat},${delivery.delivery_lng}`;
      // Try Google Maps first, fallback to Apple Maps
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        window.open(`maps://maps.apple.com/?daddr=${coords}`, '_blank', 'noopener,noreferrer');
      } else {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${coords}`, '_blank', 'noopener,noreferrer');
      }
    } else {
      // Fallback to address-based navigation
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        window.open(`maps://maps.apple.com/?daddr=${address}`, '_blank', 'noopener,noreferrer');
      } else {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${address}`, '_blank', 'noopener,noreferrer');
      }
    }
  }, []);

  // Call customer
  const callCustomer = useCallback((phone: string | null) => {
    if (phone) {
      window.location.href = `tel:${phone}`;
    } else {
      toast.error('No phone number available');
    }
  }, []);

  // Handle runner login
  const handleLogin = useCallback(() => {
    if (!runnerIdInput.trim()) {
      toast.error('Please enter your runner ID');
      return;
    }
    localStorage.setItem(STORAGE_KEYS.RUNNER_ID, runnerIdInput.trim());
    setRunnerId(runnerIdInput.trim());
  }, [runnerIdInput]);

  // Handle logout
  const handleLogout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.RUNNER_ID);
    setRunnerId(null);
    setRunnerIdInput('');
  }, []);

  // Get status badge color
  const getStatusColor = (status: DeliveryStatus) => {
    switch (status) {
      case 'assigned':
        return 'bg-blue-500';
      case 'picked_up':
        return 'bg-yellow-500';
      case 'in_transit':
        return 'bg-purple-500';
      case 'delivered':
        return 'bg-green-500';
      case 'failed':
      case 'cancelled':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Get next action for delivery
  const getNextAction = (status: DeliveryStatus): { label: string; nextStatus: DeliveryStatus } | null => {
    switch (status) {
      case 'assigned':
        return { label: 'Pick Up', nextStatus: 'picked_up' };
      case 'picked_up':
        return { label: 'Start Delivery', nextStatus: 'in_transit' };
      case 'in_transit':
        return { label: 'Delivered', nextStatus: 'delivered' };
      default:
        return null;
    }
  };

  // Login screen
  if (!runnerId) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-6 w-6" />
              Runner Portal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Enter your runner ID to access your deliveries
            </p>
            <Input
              placeholder="Runner ID"
              value={runnerIdInput}
              onChange={(e) => setRunnerIdInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              aria-label="Runner ID"
            />
            <Button className="w-full" onClick={handleLogin}>
              Access Deliveries
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-20">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="sticky top-0 z-50 bg-yellow-500 text-yellow-950 px-4 py-2 flex items-center gap-2">
          <WifiOff className="h-4 w-4" />
          <span className="text-sm font-medium">
            Offline Mode - Changes will sync when online
          </span>
          {offlineQueue.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {offlineQueue.length} pending
            </Badge>
          )}
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Truck className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-lg font-bold">My Deliveries</h1>
              <p className="text-xs text-muted-foreground">
                {deliveries.length} active {deliveries.length === 1 ? 'delivery' : 'deliveries'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={!isOnline}
              aria-label="Refresh"
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
            >
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Offline Queue Sync */}
        {isOnline && offlineQueue.length > 0 && (
          <Card className="border-yellow-500/50 bg-yellow-500/10">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm">{offlineQueue.length} actions pending sync</span>
              </div>
              <Button size="sm" onClick={syncOfflineQueue}>
                Sync Now
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && deliveries.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <h3 className="text-lg font-semibold mb-2">No Active Deliveries</h3>
              <p className="text-muted-foreground">
                You're all caught up! New deliveries will appear here.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Delivery Cards */}
        {deliveries.map((delivery, index) => {
          const isExpanded = expandedDelivery === delivery.id;
          const nextAction = getNextAction(delivery.status);
          const isFirst = index === 0;

          return (
            <Card
              key={delivery.id}
              className={cn(
                "transition-all",
                isFirst && "ring-2 ring-primary"
              )}
            >
              <CardContent className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted text-sm font-bold">
                      {delivery.route_order}
                    </div>
                    <div>
                      <p className="font-semibold">#{delivery.order_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {delivery.scheduled_at
                          ? format(new Date(delivery.scheduled_at), 'h:mm a')
                          : 'ASAP'}
                      </p>
                    </div>
                  </div>
                  <Badge className={cn("text-white", getStatusColor(delivery.status))}>
                    {delivery.status.replace('_', ' ')}
                  </Badge>
                </div>

                {/* Customer & Address */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{delivery.customer_name}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{delivery.delivery_address}</span>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2 mb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openMapsNavigation(delivery)}
                  >
                    <Navigation className="h-4 w-4 mr-1" />
                    Navigate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => callCustomer(delivery.customer_phone)}
                  >
                    <Phone className="h-4 w-4 mr-1" />
                    Call
                  </Button>
                </div>

                {/* Main Action Button */}
                {nextAction && (
                  <Button
                    className="w-full mb-3"
                    onClick={() => handleStatusUpdate(delivery, nextAction.nextStatus)}
                    disabled={updateStatusMutation.isPending}
                  >
                    {nextAction.nextStatus === 'delivered' ? (
                      <Camera className="h-4 w-4 mr-2" />
                    ) : (
                      <ArrowRight className="h-4 w-4 mr-2" />
                    )}
                    {nextAction.label}
                  </Button>
                )}

                {/* Photo Proof Button (for in_transit) */}
                {delivery.status === 'in_transit' && (
                  <Button
                    variant="secondary"
                    className="w-full mb-3"
                    onClick={() => setPhotoProofDeliveryId(delivery.id)}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Complete with Photo Proof
                  </Button>
                )}

                {/* Expandable Details */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => setExpandedDelivery(isExpanded ? null : delivery.id)}
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Less Details
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      More Details
                    </>
                  )}
                </Button>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t space-y-4">
                    {/* Items */}
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Items ({delivery.items.length})
                      </h4>
                      <div className="space-y-1">
                        {delivery.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex justify-between text-sm bg-muted/50 rounded px-2 py-1"
                          >
                            <span>{item.quantity}x {item.product_name}</span>
                            <span className="text-muted-foreground">
                              ${(item.quantity * item.unit_price).toFixed(2)}
                            </span>
                          </div>
                        ))}
                        <div className="flex justify-between font-medium pt-2">
                          <span>Total</span>
                          <span>${delivery.total_amount.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Special Instructions */}
                    {delivery.special_instructions && (
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Special Instructions
                        </h4>
                        <p className="text-sm bg-yellow-500/10 border border-yellow-500/20 rounded p-2">
                          {delivery.special_instructions}
                        </p>
                      </div>
                    )}

                    {/* ETA */}
                    {delivery.estimated_delivery_at && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>
                          ETA: {format(new Date(delivery.estimated_delivery_at), 'h:mm a')}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Photo Proof Modal */}
      {photoProofDeliveryId && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Proof of Delivery
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setPhotoProofDeliveryId(null);
                    setProofPhoto(null);
                    setProofPhotoPreview(null);
                    setDeliveryNotes('');
                  }}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Photo Preview or Upload */}
              {proofPhotoPreview ? (
                <div className="relative">
                  <img
                    src={proofPhotoPreview}
                    alt="Proof of delivery"
                    className="w-full h-48 object-cover rounded-lg"
                    loading="lazy"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      setProofPhoto(null);
                      setProofPhotoPreview(null);
                    }}
                    aria-label="Remove photo"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Tap to take photo
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoCapture}
                  />
                </label>
              )}

              {/* Notes */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Delivery Notes (optional)
                </label>
                <Textarea
                  placeholder="Left at front door, handed to customer, etc."
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Submit Button */}
              <Button
                className="w-full"
                onClick={() => {
                  const delivery = deliveries.find(d => d.id === photoProofDeliveryId);
                  if (delivery) {
                    handleSubmitProof(delivery);
                  }
                }}
                disabled={!proofPhoto || uploadProofMutation.isPending}
              >
                {uploadProofMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Complete Delivery
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
