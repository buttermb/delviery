import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right';
import ArrowLeftRight from 'lucide-react/dist/esm/icons/arrow-left-right';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import Package from 'lucide-react/dist/esm/icons/package';
import MapPin from 'lucide-react/dist/esm/icons/map-pin';
import Clock from 'lucide-react/dist/esm/icons/clock';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';
import XCircle from 'lucide-react/dist/esm/icons/x-circle';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import { Skeleton } from '@/components/ui/skeleton';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { toast } from 'sonner';

import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { logActivity, EntityType, ActivityAction } from '@/lib/activityLog';
import { cn } from '@/lib/utils';

interface TransferItem {
  product_id: string;
  product_name: string;
  sku: string | null;
  quantity: number;
  available_quantity: number;
}

interface Transfer {
  id: string;
  tenant_id: string;
  source_location_id: string;
  destination_location_id: string;
  status: 'pending' | 'in_transit' | 'completed' | 'cancelled';
  notes: string | null;
  items: TransferItem[];
  created_at: string;
  updated_at: string;
  created_by: string | null;
  source_location?: { id: string; name: string };
  destination_location?: { id: string; name: string };
}

interface Location {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  status: string;
}

interface Product {
  id: string;
  name: string;
  sku: string | null;
  stock_quantity: number;
}

interface StockTransferProps {
  className?: string;
}

const STATUS_CONFIG = {
  pending: { label: 'Pending', variant: 'secondary' as const, icon: Clock },
  in_transit: { label: 'In Transit', variant: 'default' as const, icon: ArrowRight },
  completed: { label: 'Completed', variant: 'outline' as const, icon: CheckCircle },
  cancelled: { label: 'Cancelled', variant: 'destructive' as const, icon: XCircle },
};

export function StockTransfer({ className }: StockTransferProps) {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  // Form state
  const [sourceLocationId, setSourceLocationId] = useState<string>('');
  const [destinationLocationId, setDestinationLocationId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [items, setItems] = useState<TransferItem[]>([]);
  const [showForm, setShowForm] = useState(false);

  // Fetch locations
  const { data: locations = [], isLoading: isLoadingLocations } = useQuery({
    queryKey: queryKeys.locations.list(tenant?.id, { status: 'active' }),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await (supabase as any)
        .from('locations')
        .select('id, name, city, state, status')
        .eq('tenant_id', tenant.id)
        .eq('status', 'active')
        .order('name');

      if (error) {
        logger.error('Failed to fetch locations', { error, tenantId: tenant.id });
        throw error;
      }
      return (data || []) as Location[];
    },
    enabled: !!tenant?.id,
  });

  // Fetch products for the source location
  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products-for-transfer', tenant?.id, sourceLocationId],
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, stock_quantity')
        .eq('tenant_id', tenant.id)
        .gt('stock_quantity', 0)
        .order('name');

      if (error) {
        logger.error('Failed to fetch products for transfer', { error, tenantId: tenant.id });
        throw error;
      }
      return (data || []) as Product[];
    },
    enabled: !!tenant?.id && !!sourceLocationId,
  });

  // Fetch existing transfers
  const { data: transfers = [], isLoading: isLoadingTransfers, error: transfersError } = useQuery({
    queryKey: queryKeys.inventory.transfers(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];

      // Try to fetch from stock_transfers table
      try {
        const { data, error } = await (supabase as any)
          .from('stock_transfers')
          .select(`
            *,
            source_location:locations!stock_transfers_source_location_id_fkey(id, name),
            destination_location:locations!stock_transfers_destination_location_id_fkey(id, name)
          `)
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        return (data || []) as Transfer[];
      } catch {
        // Table might not exist yet
        logger.warn('stock_transfers table may not exist', { tenantId: tenant.id });
        return [];
      }
    },
    enabled: !!tenant?.id,
  });

  // Check if we have multiple locations
  const hasMultipleLocations = locations.length >= 2;

  // Available products (excluding already added items)
  const availableProducts = useMemo(() => {
    const addedProductIds = new Set(items.map(item => item.product_id));
    return products.filter(p => !addedProductIds.has(p.id));
  }, [products, items]);

  // Selected product details
  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId);
  }, [products, selectedProductId]);

  // Add item to transfer
  const addItem = () => {
    if (!selectedProduct || !quantity || parseFloat(quantity) <= 0) {
      toast.error('Please select a product and enter a valid quantity');
      return;
    }

    const qty = parseFloat(quantity);
    if (qty > selectedProduct.stock_quantity) {
      toast.error(`Quantity exceeds available stock (${selectedProduct.stock_quantity})`);
      return;
    }

    setItems(prev => [
      ...prev,
      {
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        sku: selectedProduct.sku,
        quantity: qty,
        available_quantity: selectedProduct.stock_quantity,
      },
    ]);

    setSelectedProductId('');
    setQuantity('');
  };

  // Remove item from transfer
  const removeItem = (productId: string) => {
    setItems(prev => prev.filter(item => item.product_id !== productId));
  };

  // Create transfer mutation
  const createTransferMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id || !admin?.userId) {
        throw new Error('Authentication required');
      }

      if (!sourceLocationId || !destinationLocationId) {
        throw new Error('Source and destination locations are required');
      }

      if (sourceLocationId === destinationLocationId) {
        throw new Error('Source and destination must be different locations');
      }

      if (items.length === 0) {
        throw new Error('At least one item is required');
      }

      // Create the transfer record
      const transferData = {
        tenant_id: tenant.id,
        source_location_id: sourceLocationId,
        destination_location_id: destinationLocationId,
        status: 'pending',
        notes: notes || null,
        items: items.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
        })),
        created_by: admin.userId,
      };

      // Insert stock transfer
      const { data: transfer, error: transferError } = await (supabase as any)
        .from('stock_transfers')
        .insert(transferData)
        .select()
        .single();

      if (transferError) {
        logger.error('Failed to create stock transfer', { error: transferError, tenantId: tenant.id });
        throw transferError;
      }

      // Create paired inventory_history entries for each item
      for (const item of items) {
        // Get current stock at source
        const { data: sourceProduct, error: fetchError } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', item.product_id)
          .eq('tenant_id', tenant.id)
          .maybeSingle();

        if (fetchError) {
          logger.error('Failed to fetch product stock', { error: fetchError, productId: item.product_id });
          continue;
        }

        const previousQuantity = sourceProduct?.stock_quantity || 0;
        const newQuantity = previousQuantity - item.quantity;

        // Update product stock (decrease at source)
        const { error: updateError } = await supabase
          .from('products')
          .update({
            stock_quantity: newQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.product_id)
          .eq('tenant_id', tenant.id);

        if (updateError) {
          logger.error('Failed to update product stock', { error: updateError, productId: item.product_id });
        }

        // Log decrease at source location
        try {
          await (supabase as any)
            .from('inventory_history')
            .insert({
              tenant_id: tenant.id,
              product_id: item.product_id,
              change_type: 'transfer_out',
              previous_quantity: previousQuantity,
              new_quantity: newQuantity,
              change_amount: -item.quantity,
              reference_type: 'stock_transfer',
              reference_id: (transfer as Transfer).id,
              location_id: sourceLocationId,
              reason: 'transfer',
              notes: `Transfer to ${locations.find(l => l.id === destinationLocationId)?.name || 'destination'}`,
              performed_by: admin.userId,
            });
        } catch (historyError) {
          logger.warn('Failed to log inventory history for source', { error: historyError });
        }

        // Log increase at destination location (pending receipt)
        try {
          await (supabase as any)
            .from('inventory_history')
            .insert({
              tenant_id: tenant.id,
              product_id: item.product_id,
              change_type: 'transfer_in',
              previous_quantity: 0, // Will be updated when received
              new_quantity: item.quantity,
              change_amount: item.quantity,
              reference_type: 'stock_transfer',
              reference_id: (transfer as Transfer).id,
              location_id: destinationLocationId,
              reason: 'transfer',
              notes: `Transfer from ${locations.find(l => l.id === sourceLocationId)?.name || 'source'} (pending)`,
              performed_by: admin.userId,
            });
        } catch (historyError) {
          logger.warn('Failed to log inventory history for destination', { error: historyError });
        }
      }

      // Log activity
      await logActivity(
        tenant.id,
        admin.userId,
        ActivityAction.CREATED,
        EntityType.INVENTORY,
        (transfer as Transfer).id,
        {
          action: 'stock_transfer',
          source_location_id: sourceLocationId,
          destination_location_id: destinationLocationId,
          item_count: items.length,
          total_quantity: items.reduce((sum, item) => sum + item.quantity, 0),
        }
      );

      // Create notification for destination location admin (if notifications table exists)
      try {
        const sourceName = locations.find(l => l.id === sourceLocationId)?.name || 'Source';
        await (supabase as any)
          .from('notifications')
          .insert({
            tenant_id: tenant.id,
            type: 'stock_transfer',
            title: 'Incoming Stock Transfer',
            message: `Stock transfer from ${sourceName} is pending. ${items.length} item(s) to receive.`,
            metadata: {
              transfer_id: (transfer as Transfer).id,
              source_location_id: sourceLocationId,
              destination_location_id: destinationLocationId,
            },
          });
      } catch {
        // Notifications table may not exist
        logger.debug('Could not create notification for stock transfer');
      }

      return transfer as Transfer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.transfers(tenant?.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
      toast.success('Stock transfer created successfully');

      // Reset form
      setSourceLocationId('');
      setDestinationLocationId('');
      setItems([]);
      setNotes('');
      setShowForm(false);
    },
    onError: (error: unknown) => {
      logger.error('Failed to create stock transfer', error, { component: 'StockTransfer' });
      toast.error(error instanceof Error ? error.message : 'Failed to create stock transfer');
    },
  });

  // Update transfer status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ transferId, newStatus }: { transferId: string; newStatus: string }) => {
      if (!tenant?.id || !admin?.userId) {
        throw new Error('Authentication required');
      }

      const { data, error } = await (supabase as any)
        .from('stock_transfers')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', transferId)
        .eq('tenant_id', tenant.id)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update transfer status', { error, transferId, newStatus });
        throw error;
      }

      // Log activity
      await logActivity(
        tenant.id,
        admin.userId,
        ActivityAction.UPDATED,
        EntityType.INVENTORY,
        transferId,
        {
          action: 'transfer_status_change',
          new_status: newStatus,
        }
      );

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.transfers(tenant?.id) });
      toast.success('Transfer status updated');
    },
    onError: (error: unknown) => {
      logger.error('Failed to update transfer status', error);
      toast.error('Failed to update transfer status');
    },
  });

  // If no multiple locations, show info message
  if (!isLoadingLocations && !hasMultipleLocations) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Stock Transfer Between Locations
          </CardTitle>
          <CardDescription>
            Transfer inventory between your warehouse locations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EnhancedEmptyState
            icon={MapPin}
            title="Multiple Locations Required"
            description="Stock transfers require at least two active locations. Add more locations to enable this feature."
          />
        </CardContent>
      </Card>
    );
  }

  if (transfersError) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Stock Transfer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p>Failed to load transfers. Please try again.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <ArrowLeftRight className="h-5 w-5" />
              Stock Transfer Between Locations
            </CardTitle>
            <CardDescription className="text-sm mt-1">
              Transfer inventory between your warehouse locations
            </CardDescription>
          </div>
          {!showForm && (
            <Button onClick={() => setShowForm(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New Transfer
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Transfer Form */}
        {showForm && (
          <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Create New Transfer</h4>
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>

            {/* Location Selection */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Source Location</Label>
                <Select value={sourceLocationId} onValueChange={setSourceLocationId} disabled={isLoadingLocations}>
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingLocations ? "Loading locations..." : "Select source location"} />
                  </SelectTrigger>
                  <SelectContent>
                    {locations
                      .filter(loc => loc.id !== destinationLocationId)
                      .map(location => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                          {location.city && ` - ${location.city}`}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Destination Location</Label>
                <Select value={destinationLocationId} onValueChange={setDestinationLocationId} disabled={isLoadingLocations}>
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingLocations ? "Loading locations..." : "Select destination location"} />
                  </SelectTrigger>
                  <SelectContent>
                    {locations
                      .filter(loc => loc.id !== sourceLocationId)
                      .map(location => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                          {location.city && ` - ${location.city}`}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Product Selection */}
            {sourceLocationId && destinationLocationId && (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Product</Label>
                    <Select
                      value={selectedProductId}
                      onValueChange={setSelectedProductId}
                      disabled={isLoadingProducts}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select product to transfer" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableProducts.map(product => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                            {product.sku && ` (${product.sku})`}
                            <span className="ml-2 text-muted-foreground">
                              — {product.stock_quantity} available
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>
                      Quantity
                      {selectedProduct && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          (max: {selectedProduct.stock_quantity})
                        </span>
                      )}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="0"
                        value={quantity}
                        onChange={e => setQuantity(e.target.value)}
                        min={0}
                        max={selectedProduct?.stock_quantity || 0}
                        onKeyDown={e => e.key === 'Enter' && addItem()}
                      />
                      <Button onClick={addItem} disabled={!selectedProductId || !quantity}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Items List */}
                {items.length > 0 && (
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map(item => (
                          <TableRow key={item.product_id}>
                            <TableCell className="font-medium">{item.product_name}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {item.sku || '-'}
                            </TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(item.product_id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Textarea
                    placeholder="Add any notes about this transfer..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                  />
                </div>

                {/* Submit Button */}
                <Button
                  onClick={() => createTransferMutation.mutate()}
                  disabled={items.length === 0 || createTransferMutation.isPending}
                  className="w-full"
                  size="lg"
                >
                  {createTransferMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating Transfer...
                    </>
                  ) : (
                    <>
                      <ArrowLeftRight className="h-4 w-4 mr-2" />
                      Create Transfer ({items.length} items)
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        )}

        {/* Transfers List */}
        <div>
          <h4 className="font-medium mb-3">Recent Transfers</h4>
          {isLoadingTransfers ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : transfers.length === 0 ? (
            <EnhancedEmptyState
              icon={Package}
              title="No Transfers Yet"
              description="Create your first stock transfer to move inventory between locations."
              primaryAction={
                !showForm
                  ? {
                      label: 'Create Transfer',
                      onClick: () => setShowForm(true),
                    }
                  : undefined
              }
            />
          ) : (
            <div className="space-y-3">
              {transfers.map(transfer => {
                const statusConfig = STATUS_CONFIG[transfer.status] || STATUS_CONFIG.pending;
                const StatusIcon = statusConfig.icon;

                return (
                  <div
                    key={transfer.id}
                    className="border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {transfer.source_location?.name || 'Unknown'}
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {transfer.destination_location?.name || 'Unknown'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          {transfer.items?.length || 0} item(s)
                        </span>
                        <span>
                          {new Date(transfer.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={statusConfig.variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig.label}
                      </Badge>

                      {transfer.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            updateStatusMutation.mutate({
                              transferId: transfer.id,
                              newStatus: 'in_transit',
                            })
                          }
                          disabled={updateStatusMutation.isPending}
                        >
                          Start Transit
                        </Button>
                      )}

                      {transfer.status === 'in_transit' && (
                        <Button
                          size="sm"
                          onClick={() =>
                            updateStatusMutation.mutate({
                              transferId: transfer.id,
                              newStatus: 'completed',
                            })
                          }
                          disabled={updateStatusMutation.isPending}
                        >
                          Complete
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
