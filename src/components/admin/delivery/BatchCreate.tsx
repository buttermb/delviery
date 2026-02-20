/**
 * BatchCreate Component
 * Select multiple confirmed wholesale orders and create deliveries in batch.
 * Auto-groups orders by delivery zone, suggests runners per zone, and creates
 * delivery records for all selected orders at once with progress tracking.
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Package,
  Truck,
  Users,
  MapPin,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

import type { DeliveryZone } from '@/types/delivery-zone';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { useAvailableRunners } from '@/hooks/useAvailableRunners';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ConfirmedOrder {
  id: string;
  order_number: string;
  client_id: string;
  client_name: string;
  client_address: string;
  delivery_address: string;
  total_amount: number;
  confirmed_at: string;
  delivery_notes: string | null;
}

interface ZoneGroup {
  zone: DeliveryZone | null;
  zoneName: string;
  orders: ConfirmedOrder[];
  selectedRunnerId: string | null;
}

interface BatchResult {
  orderId: string;
  orderNumber: string;
  success: boolean;
  error?: string;
}

type BatchStep = 'select' | 'review' | 'processing' | 'complete';

interface BatchCreateProps {
  className?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BatchCreate({ className }: BatchCreateProps) {
  const { tenantId, hasPermission, isReady } = useTenantContext();
  const queryClient = useQueryClient();

  // State
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<BatchStep>('select');
  const [zoneGroups, setZoneGroups] = useState<ZoneGroup[]>([]);
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [batchProgress, setBatchProgress] = useState(0);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const canManageDeliveries = useMemo(
    () => hasPermission('manage:deliveries'),
    [hasPermission]
  );

  // ─── Queries ─────────────────────────────────────────────────────────────

  const { data: confirmedOrders = [], isLoading: isOrdersLoading, error: ordersError, refetch: refetchOrders } = useQuery({
    queryKey: [...queryKeys.wholesaleOrders.all, 'confirmed-for-batch', tenantId],
    queryFn: async (): Promise<ConfirmedOrder[]> => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('wholesale_orders')
        .select(`
          id,
          order_number,
          client_id,
          total_amount,
          confirmed_at,
          delivery_address,
          delivery_notes,
          status,
          wholesale_clients!inner(business_name, address)
        `)
        .eq('tenant_id', tenantId)
        .eq('status', 'confirmed')
        .is('runner_id', null)
        .order('confirmed_at', { ascending: true });

      if (error) {
        logger.error('Failed to fetch confirmed orders', error, { component: 'BatchCreate' });
        throw error;
      }

      return (data || []).map((order) => ({
        id: order.id,
        order_number: order.order_number,
        client_id: order.client_id,
        client_name: (order.wholesale_clients as unknown as { business_name: string; address: string }).business_name,
        client_address: (order.wholesale_clients as unknown as { business_name: string; address: string }).address,
        delivery_address: order.delivery_address,
        total_amount: order.total_amount,
        confirmed_at: order.confirmed_at ?? '',
        delivery_notes: order.delivery_notes,
      }));
    },
    enabled: !!tenantId,
    staleTime: 30000,
  });

  const { data: zones = [], isLoading: isZonesLoading } = useQuery({
    queryKey: ['delivery-zones', tenantId],
    queryFn: async (): Promise<DeliveryZone[]> => {
      if (!tenantId) return [];

      const { data, error } = await (supabase as any)
        .from('delivery_zones')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (error) {
        logger.error('Failed to fetch delivery zones', error, { component: 'BatchCreate' });
        return [];
      }

      return (data || []) as DeliveryZone[];
    },
    enabled: !!tenantId,
    staleTime: 60000,
  });

  const { data: runners = [], isLoading: isRunnersLoading } = useAvailableRunners({
    onlyAvailable: false,
  });

  const availableRunners = useMemo(
    () => runners.filter((r) => r.status === 'available'),
    [runners]
  );

  // ─── Zone grouping logic ──────────────────────────────────────────────────

  const matchOrderToZone = useCallback(
    (order: ConfirmedOrder): DeliveryZone | null => {
      const address = order.delivery_address.toLowerCase();
      for (const zone of zones) {
        // Match by ZIP code in the delivery address
        for (const zip of zone.zip_codes) {
          if (address.includes(zip)) {
            return zone;
          }
        }
      }
      return null;
    },
    [zones]
  );

  const buildZoneGroups = useCallback((): ZoneGroup[] => {
    const selected = confirmedOrders.filter((o) => selectedOrderIds.has(o.id));
    const groupMap = new Map<string, ZoneGroup>();

    for (const order of selected) {
      const zone = matchOrderToZone(order);
      const key = zone?.id ?? '__unzoned__';

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          zone,
          zoneName: zone?.name ?? 'Unassigned Zone',
          orders: [],
          selectedRunnerId: null,
        });
      }
      groupMap.get(key)!.orders.push(order);
    }

    // Sort: zoned groups first, unzoned last
    return Array.from(groupMap.values()).sort((a, b) => {
      if (a.zone && !b.zone) return -1;
      if (!a.zone && b.zone) return 1;
      return a.zoneName.localeCompare(b.zoneName);
    });
  }, [confirmedOrders, selectedOrderIds, matchOrderToZone]);

  // ─── Selection handlers ───────────────────────────────────────────────────

  const toggleOrder = useCallback((orderId: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedOrderIds.size === confirmedOrders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(confirmedOrders.map((o) => o.id)));
    }
  }, [confirmedOrders, selectedOrderIds.size]);

  const toggleZone = useCallback((zoneKey: string) => {
    setExpandedZones((prev) => {
      const next = new Set(prev);
      if (next.has(zoneKey)) {
        next.delete(zoneKey);
      } else {
        next.add(zoneKey);
      }
      return next;
    });
  }, []);

  const setRunnerForGroup = useCallback((groupIndex: number, runnerId: string) => {
    setZoneGroups((prev) =>
      prev.map((g, i) => (i === groupIndex ? { ...g, selectedRunnerId: runnerId } : g))
    );
  }, []);

  // ─── Step transitions ─────────────────────────────────────────────────────

  const proceedToReview = useCallback(() => {
    const groups = buildZoneGroups();
    setZoneGroups(groups);
    // Expand all groups by default
    setExpandedZones(new Set(groups.map((g) => g.zone?.id ?? '__unzoned__')));
    setStep('review');
  }, [buildZoneGroups]);

  const backToSelect = useCallback(() => {
    setStep('select');
    setZoneGroups([]);
    setBatchResults([]);
    setBatchProgress(0);
  }, []);

  const resetAll = useCallback(() => {
    setSelectedOrderIds(new Set());
    setStep('select');
    setZoneGroups([]);
    setBatchResults([]);
    setBatchProgress(0);
  }, []);

  // ─── Batch creation ──────────────────────────────────────────────────────

  const allGroupsHaveRunners = useMemo(
    () => zoneGroups.every((g) => g.selectedRunnerId),
    [zoneGroups]
  );

  const totalSelectedOrders = useMemo(
    () => zoneGroups.reduce((sum, g) => sum + g.orders.length, 0),
    [zoneGroups]
  );

  const batchCreateMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('No tenant context');

      const results: BatchResult[] = [];
      let processed = 0;

      for (const group of zoneGroups) {
        if (!group.selectedRunnerId) continue;

        for (const order of group.orders) {
          try {
            // Create delivery record
            const { error: deliveryError } = await supabase
              .from('wholesale_deliveries')
              .insert({
                order_id: order.id,
                runner_id: group.selectedRunnerId,
                tenant_id: tenantId,
                client_id: order.client_id,
                status: 'assigned',
                total_value: order.total_amount,
                notes: order.delivery_notes,
              });

            if (deliveryError) throw deliveryError;

            // Update the order's runner_id and status
            const { error: orderError } = await supabase
              .from('wholesale_orders')
              .update({
                runner_id: group.selectedRunnerId,
                status: 'assigned',
                assigned_at: new Date().toISOString(),
              })
              .eq('id', order.id)
              .eq('tenant_id', tenantId);

            if (orderError) throw orderError;

            results.push({
              orderId: order.id,
              orderNumber: order.order_number,
              success: true,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            logger.error('Failed to create delivery for order', err, {
              component: 'BatchCreate',
              orderId: order.id,
            });
            results.push({
              orderId: order.id,
              orderNumber: order.order_number,
              success: false,
              error: message,
            });
          }

          processed++;
          setBatchProgress(Math.round((processed / totalSelectedOrders) * 100));
          setBatchResults([...results]);
        }
      }

      return results;
    },
    onMutate: () => {
      setStep('processing');
      setBatchProgress(0);
      setBatchResults([]);
    },
    onSuccess: (results) => {
      const successes = results.filter((r) => r.success).length;
      const failures = results.filter((r) => !r.success).length;

      queryClient.invalidateQueries({ queryKey: queryKeys.wholesaleOrders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.runners.available() });

      if (failures === 0) {
        toast.success(`Created ${successes} deliveries successfully`);
      } else {
        toast.warning(`Created ${successes} deliveries, ${failures} failed`);
      }

      setStep('complete');
    },
    onError: (error) => {
      logger.error('Batch delivery creation failed', error, { component: 'BatchCreate' });
      toast.error('Batch delivery creation failed');
      setStep('complete');
    },
  });

  const handleStartBatch = useCallback(() => {
    setConfirmDialogOpen(false);
    batchCreateMutation.mutate();
  }, [batchCreateMutation]);

  // ─── Render helpers ───────────────────────────────────────────────────────

  const successCount = useMemo(() => batchResults.filter((r) => r.success).length, [batchResults]);
  const failureCount = useMemo(() => batchResults.filter((r) => !r.success).length, [batchResults]);

  // ─── Loading / error states ────────────────────────────────────────────────

  if (!isReady) {
    return (
      <div className={cn('space-y-6', className)}>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!canManageDeliveries) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">You do not have permission to manage deliveries.</p>
        </CardContent>
      </Card>
    );
  }

  if (ordersError) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <XCircle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-destructive font-medium">Failed to load confirmed orders</p>
          <p className="text-sm text-muted-foreground mt-1">
            {ordersError instanceof Error ? ordersError.message : 'An unexpected error occurred'}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => refetchOrders()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ─── Step: Select orders ──────────────────────────────────────────────────

  if (step === 'select') {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Package className="h-6 w-6" />
              Batch Create Deliveries
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Select confirmed orders to create deliveries in bulk
            </p>
          </div>
          <Button
            onClick={proceedToReview}
            disabled={selectedOrderIds.size === 0}
          >
            <Truck className="h-4 w-4 mr-2" />
            Review ({selectedOrderIds.size})
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Confirmed Orders</CardTitle>
                <CardDescription>
                  {confirmedOrders.length} orders ready for delivery assignment
                </CardDescription>
              </div>
              {confirmedOrders.length > 0 && (
                <Button variant="outline" size="sm" onClick={toggleAll}>
                  {selectedOrderIds.size === confirmedOrders.length ? 'Deselect All' : 'Select All'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isOrdersLoading || isZonesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : confirmedOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No confirmed orders awaiting delivery</p>
                <p className="text-sm mt-1">
                  Orders must be confirmed and unassigned to appear here
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedOrderIds.size === confirmedOrders.length && confirmedOrders.length > 0}
                          onCheckedChange={toggleAll}
                          aria-label="Select all orders"
                        />
                      </TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Delivery Address</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Zone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {confirmedOrders.map((order) => {
                      const zone = matchOrderToZone(order);
                      return (
                        <TableRow
                          key={order.id}
                          className={cn(
                            'cursor-pointer',
                            selectedOrderIds.has(order.id) && 'bg-primary/5'
                          )}
                          onClick={() => toggleOrder(order.id)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedOrderIds.has(order.id)}
                              onCheckedChange={() => toggleOrder(order.id)}
                              aria-label={`Select order ${order.order_number}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            #{order.order_number}
                          </TableCell>
                          <TableCell>{order.client_name}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                            {order.delivery_address}
                          </TableCell>
                          <TableCell className="text-right">
                            ${order.total_amount.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {zone ? (
                              <Badge
                                variant="outline"
                                style={{ borderColor: zone.color, color: zone.color }}
                              >
                                <MapPin className="h-3 w-3 mr-1" />
                                {zone.name}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                No zone
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Step: Review zone groups & assign runners ─────────────────────────────

  if (step === 'review') {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              Assign Runners
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {totalSelectedOrders} orders grouped into {zoneGroups.length} zone{zoneGroups.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={backToSelect}>
              Back
            </Button>
            <Button
              onClick={() => setConfirmDialogOpen(true)}
              disabled={!allGroupsHaveRunners}
            >
              <Truck className="h-4 w-4 mr-2" />
              Create {totalSelectedOrders} Deliveries
            </Button>
          </div>
        </div>

        {!allGroupsHaveRunners && (
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
            <CardContent className="flex items-center gap-3 py-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Assign a runner to every zone group before creating deliveries.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {zoneGroups.map((group, groupIndex) => {
            const zoneKey = group.zone?.id ?? '__unzoned__';
            const isExpanded = expandedZones.has(zoneKey);

            return (
              <Card key={zoneKey}>
                <CardHeader
                  className="cursor-pointer py-3 px-4"
                  onClick={() => toggleZone(zoneKey)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div className="flex items-center gap-2">
                        {group.zone ? (
                          <Badge
                            variant="outline"
                            style={{ borderColor: group.zone.color, color: group.zone.color }}
                          >
                            <MapPin className="h-3 w-3 mr-1" />
                            {group.zoneName}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {group.zoneName}
                          </Badge>
                        )}
                        <span className="text-sm text-muted-foreground">
                          {group.orders.length} order{group.orders.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={group.selectedRunnerId ?? ''}
                        onValueChange={(value) => setRunnerForGroup(groupIndex, value)}
                      >
                        <SelectTrigger className="w-[220px]">
                          <SelectValue placeholder="Assign runner..." />
                        </SelectTrigger>
                        <SelectContent>
                          {isRunnersLoading ? (
                            <SelectItem value="__loading__" disabled>
                              Loading runners...
                            </SelectItem>
                          ) : availableRunners.length === 0 ? (
                            <SelectItem value="__none__" disabled>
                              No available runners
                            </SelectItem>
                          ) : (
                            availableRunners.map((runner) => (
                              <SelectItem key={runner.id} value={runner.id}>
                                <div className="flex items-center gap-2">
                                  <span>{runner.full_name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    ({runner.vehicle_type})
                                  </span>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {group.selectedRunnerId && (
                        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                      )}
                    </div>
                  </div>
                </CardHeader>
                {isExpanded && (
                  <CardContent className="pt-0 px-4 pb-4">
                    <Separator className="mb-3" />
                    <div className="space-y-2">
                      {group.orders.map((order) => (
                        <div
                          key={order.id}
                          className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50 text-sm"
                        >
                          <div className="flex items-center gap-4">
                            <span className="font-medium">#{order.order_number}</span>
                            <span className="text-muted-foreground">{order.client_name}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-muted-foreground max-w-[180px] truncate">
                              {order.delivery_address}
                            </span>
                            <span className="font-medium">${order.total_amount.toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        {/* Confirmation Dialog */}
        <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Create Batch Deliveries</AlertDialogTitle>
              <AlertDialogDescription>
                This will create {totalSelectedOrders} delivery records and assign runners
                to the selected orders. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleStartBatch}>
                Create Deliveries
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ─── Step: Processing ──────────────────────────────────────────────────────

  if (step === 'processing') {
    return (
      <div className={cn('space-y-6', className)}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Creating Deliveries...
            </CardTitle>
            <CardDescription>
              Processing {totalSelectedOrders} orders across {zoneGroups.length} zone{zoneGroups.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{batchProgress}%</span>
              </div>
              <Progress value={batchProgress} className="h-3" />
            </div>

            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>{successCount} created</span>
              </div>
              {failureCount > 0 && (
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span>{failureCount} failed</span>
                </div>
              )}
              <div className="text-muted-foreground">
                {batchResults.length} / {totalSelectedOrders} processed
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Step: Complete ────────────────────────────────────────────────────────

  return (
    <div className={cn('space-y-6', className)}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {failureCount === 0 ? (
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            )}
            Batch Complete
          </CardTitle>
          <CardDescription>
            {failureCount === 0
              ? `All ${successCount} deliveries created successfully`
              : `${successCount} deliveries created, ${failureCount} failed`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                {successCount}
              </div>
              <div className="text-sm text-green-600 dark:text-green-500">Created</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                {failureCount}
              </div>
              <div className="text-sm text-red-600 dark:text-red-500">Failed</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted border">
              <div className="text-2xl font-bold">
                {zoneGroups.length}
              </div>
              <div className="text-sm text-muted-foreground">Zones</div>
            </div>
          </div>

          {/* Failures detail */}
          {failureCount > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-destructive">Failed Orders</h3>
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-2">
                  {batchResults
                    .filter((r) => !r.success)
                    .map((result) => (
                      <div
                        key={result.orderId}
                        className="flex items-center justify-between py-2 px-3 rounded-md bg-destructive/5 border border-destructive/20 text-sm"
                      >
                        <span className="font-medium">#{result.orderNumber}</span>
                        <span className="text-destructive text-xs">{result.error}</span>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Success detail */}
          {successCount > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-green-700 dark:text-green-400">
                Successfully Created
              </h3>
              <ScrollArea className="max-h-[200px]">
                <div className="flex flex-wrap gap-2">
                  {batchResults
                    .filter((r) => r.success)
                    .map((result) => (
                      <Badge key={result.orderId} variant="outline" className="text-green-700 border-green-300">
                        #{result.orderNumber}
                      </Badge>
                    ))}
                </div>
              </ScrollArea>
            </div>
          )}

          <Separator />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={resetAll}>
              Create More Deliveries
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default BatchCreate;
