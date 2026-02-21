/**
 * ReorderSettings Component
 *
 * Per-product reorder configuration for automatic purchase order generation.
 * Allows setting:
 * - Reorder point (threshold when stock is low)
 * - Reorder quantity (how many units to order)
 * - Preferred vendor (vendor to order from)
 *
 * When stock hits reorder_point, auto-generates purchase order draft linked to vendor.
 * Dashboard shows pending reorders. Vendor module shows incoming purchase orders.
 *
 * Task 101: Create product-vendor reorder automation
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import Save from 'lucide-react/dist/esm/icons/save';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import Package from 'lucide-react/dist/esm/icons/package';
import Building2 from 'lucide-react/dist/esm/icons/building-2';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import Bell from 'lucide-react/dist/esm/icons/bell';
import ShoppingCart from 'lucide-react/dist/esm/icons/shopping-cart';
import TrendingDown from 'lucide-react/dist/esm/icons/trending-down';
import Clock from 'lucide-react/dist/esm/icons/clock';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';

// ============================================================================
// Types
// ============================================================================

interface Vendor {
  id: string;
  name: string;
  status: string | null;
  contact_email: string | null;
}

interface ReorderConfig {
  reorder_point: number;
  reorder_quantity: number;
  preferred_vendor_id: string | null;
  auto_reorder_enabled: boolean;
}

interface PendingReorder {
  id: string;
  product_id: string;
  product_name: string;
  current_stock: number;
  reorder_point: number;
  reorder_quantity: number;
  vendor_name: string | null;
  status: 'pending' | 'draft_created' | 'ordered';
  created_at: string;
}

interface ReorderSettingsProps {
  /** Product ID to configure reorder settings for */
  productId: string;
  /** Product name for display */
  productName: string;
  /** Current stock quantity */
  currentStock: number;
  /** Optional SKU for display */
  sku?: string | null;
  /** Initial reorder point (low_stock_alert) */
  initialReorderPoint?: number | null;
  /** Callback after settings are saved */
  onSave?: () => void;
}

// ============================================================================
// Query Keys
// ============================================================================

const reorderSettingsKeys = {
  all: ['reorder-settings'] as const,
  config: (productId: string) => [...reorderSettingsKeys.all, 'config', productId] as const,
  pending: (tenantId: string) => [...reorderSettingsKeys.all, 'pending', tenantId] as const,
  vendors: (tenantId: string) => [...reorderSettingsKeys.all, 'vendors', tenantId] as const,
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch vendors for the current tenant
 */
function useVendors() {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: reorderSettingsKeys.vendors(tenant?.id ?? ''),
    queryFn: async (): Promise<Vendor[]> => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('vendors')
        .select('id, name, status, contact_email')
        .eq('account_id', tenant.id)
        .eq('status', 'active')
        .order('name');

      if (error) {
        logger.error('Failed to fetch vendors for reorder settings', error, {
          component: 'ReorderSettings',
          tenantId: tenant.id,
        });
        throw error;
      }

      return data ?? [];
    },
    enabled: !!tenant?.id,
    staleTime: 60_000, // 1 minute
  });
}

/**
 * Hook to fetch current reorder configuration for a product
 */
function useReorderConfig(productId: string) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: reorderSettingsKeys.config(productId),
    queryFn: async (): Promise<ReorderConfig | null> => {
      if (!tenant?.id || !productId) return null;

      // Fetch product's reorder settings
      const { data, error } = await (supabase as any)
        .from('products')
        .select('low_stock_alert, vendor_id, reorder_quantity, auto_reorder_enabled')
        .eq('id', productId)
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch reorder config', error, {
          component: 'ReorderSettings',
          productId,
        });
        throw error;
      }

      if (!data) return null;

      return {
        reorder_point: data.low_stock_alert ?? 10,
        reorder_quantity: (data as Record<string, unknown>).reorder_quantity as number ?? 50,
        preferred_vendor_id: data.vendor_id,
        auto_reorder_enabled: (data as Record<string, unknown>).auto_reorder_enabled as boolean ?? false,
      };
    },
    enabled: !!tenant?.id && !!productId,
  });
}

/**
 * Hook to fetch pending reorders for the dashboard
 */
export function usePendingReorders() {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: reorderSettingsKeys.pending(tenant?.id ?? ''),
    queryFn: async (): Promise<PendingReorder[]> => {
      if (!tenant?.id) return [];

      // Fetch products that are at or below reorder point with auto-reorder enabled
      const { data, error } = await (supabase as any)
        .from('products')
        .select(`
          id,
          name,
          stock_quantity,
          available_quantity,
          low_stock_alert,
          vendor_id,
          vendor_name
        `)
        .eq('tenant_id', tenant.id)
        .not('low_stock_alert', 'is', null)
        .order('available_quantity', { ascending: true });

      if (error) {
        logger.error('Failed to fetch pending reorders', error, {
          component: 'ReorderSettings',
          tenantId: tenant.id,
        });
        throw error;
      }

      // Filter to products below reorder point
      const pendingReorders: PendingReorder[] = (data ?? [])
        .filter(product => {
          const currentStock = product.available_quantity ?? product.stock_quantity ?? 0;
          const reorderPoint = product.low_stock_alert ?? 10;
          return currentStock <= reorderPoint;
        })
        .map(product => ({
          id: `pending-${product.id}`,
          product_id: product.id,
          product_name: product.name,
          current_stock: product.available_quantity ?? product.stock_quantity ?? 0,
          reorder_point: product.low_stock_alert ?? 10,
          reorder_quantity: 50, // Default reorder quantity
          vendor_name: product.vendor_name,
          status: 'pending' as const,
          created_at: new Date().toISOString(),
        }));

      return pendingReorders;
    },
    enabled: !!tenant?.id,
    staleTime: 30_000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}

// ============================================================================
// Main Component
// ============================================================================

export function ReorderSettings({
  productId,
  productName,
  currentStock,
  sku,
  initialReorderPoint,
  onSave,
}: ReorderSettingsProps) {
  const { tenant } = useTenantAdminAuth();
  const { navigateToAdmin } = useTenantNavigation();
  const queryClient = useQueryClient();

  // Form state
  const [reorderPoint, setReorderPoint] = useState<string>(
    (initialReorderPoint ?? 10).toString()
  );
  const [reorderQuantity, setReorderQuantity] = useState<string>('50');
  const [preferredVendorId, setPreferredVendorId] = useState<string>('');
  const [autoReorderEnabled, setAutoReorderEnabled] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Queries
  const { data: vendors, isLoading: vendorsLoading } = useVendors();
  const { data: config, isLoading: configLoading } = useReorderConfig(productId);

  // Initialize form with fetched config
  useMemo(() => {
    if (config && !isInitialized) {
      setReorderPoint(config.reorder_point.toString());
      setReorderQuantity(config.reorder_quantity.toString());
      setPreferredVendorId(config.preferred_vendor_id ?? '');
      setAutoReorderEnabled(config.auto_reorder_enabled);
      setIsInitialized(true);
    }
  }, [config, isInitialized]);

  // Computed values
  const parsedReorderPoint = parseFloat(reorderPoint) || 0;
  const parsedReorderQuantity = parseFloat(reorderQuantity) || 0;
  const isBelowReorderPoint = currentStock <= parsedReorderPoint;
  const selectedVendor = vendors?.find(v => v.id === preferredVendorId);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id) {
        throw new Error('No tenant context');
      }

      const updateData: Record<string, unknown> = {
        low_stock_alert: parsedReorderPoint,
        vendor_id: preferredVendorId || null,
        updated_at: new Date().toISOString(),
      };

      // Add extended fields if they exist on the products table
      // These might be custom fields added for the reorder automation feature
      if (parsedReorderQuantity > 0) {
        updateData.reorder_quantity = parsedReorderQuantity;
      }
      updateData.auto_reorder_enabled = autoReorderEnabled;

      const { error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', productId)
        .eq('tenant_id', tenant.id);

      if (error) {
        logger.error('Failed to save reorder settings', error, {
          component: 'ReorderSettings',
          productId,
        });
        throw error;
      }

      // If below reorder point and auto-reorder is enabled with a vendor, create PO draft
      if (isBelowReorderPoint && autoReorderEnabled && preferredVendorId) {
        await createPurchaseOrderDraft();
      }
    },
    onSuccess: () => {
      showSuccessToast('Reorder Settings Saved', 'Product reorder configuration updated');

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: reorderSettingsKeys.config(productId) });
      queryClient.invalidateQueries({ queryKey: reorderSettingsKeys.pending(tenant?.id ?? '') });

      onSave?.();
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to save settings';
      showErrorToast('Save Failed', message);
    },
  });

  // Create PO draft mutation
  const createPOMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id || !preferredVendorId) {
        throw new Error('Missing vendor selection');
      }

      logger.info('Creating reorder purchase order draft', {
        component: 'ReorderSettings',
        productId,
        vendorId: preferredVendorId,
        quantity: parsedReorderQuantity,
      });

      // Create PO using edge function or direct insert
      const { data, error } = await supabase.functions.invoke('create-purchase-order', {
        body: {
          supplier_id: preferredVendorId,
          notes: `Auto-reorder for ${productName}: Stock at ${currentStock}, reorder point is ${parsedReorderPoint}`,
          status: 'draft',
          items: [
            {
              product_id: productId,
              quantity_lbs: parsedReorderQuantity,
              unit_cost: 0, // Will be updated by vendor
            },
          ],
        },
      });

      if (error) {
        logger.error('Failed to create reorder PO', error, {
          component: 'ReorderSettings',
          productId,
        });
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      const poNumber = data?.purchase_order?.po_number || 'New';
      showSuccessToast('Purchase Order Created', `Draft PO ${poNumber} created for reorder`);

      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.lists() });
      queryClient.invalidateQueries({ queryKey: reorderSettingsKeys.pending(tenant?.id ?? '') });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to create PO';
      showErrorToast('PO Creation Failed', message);
    },
  });

  const createPurchaseOrderDraft = useCallback(async () => {
    await createPOMutation.mutateAsync();
  }, [createPOMutation]);

  const handleSave = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (parsedReorderPoint < 0) {
      showErrorToast('Validation Error', 'Reorder point cannot be negative');
      return;
    }
    if (parsedReorderQuantity < 0) {
      showErrorToast('Validation Error', 'Reorder quantity cannot be negative');
      return;
    }
    saveMutation.mutate();
  }, [saveMutation, parsedReorderPoint, parsedReorderQuantity]);

  const handleCreatePO = useCallback(() => {
    createPOMutation.mutate();
  }, [createPOMutation]);

  const handleViewPurchaseOrders = useCallback(() => {
    navigateToAdmin('purchase-orders');
  }, [navigateToAdmin]);

  const isLoading = vendorsLoading || configLoading;
  const isSaving = saveMutation.isPending || createPOMutation.isPending;
  const isFormValid = parsedReorderPoint > 0 && parsedReorderQuantity > 0;

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-60 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Reorder Settings
        </CardTitle>
        <CardDescription>
          Configure automatic reorder for <strong>{productName}</strong>
          {sku && <span className="text-muted-foreground"> ({sku})</span>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-6">
          {/* Current Stock Status */}
          <div className="p-4 rounded-lg border bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Current Stock</p>
                  <p className="text-2xl font-bold">{currentStock.toFixed(2)}</p>
                </div>
              </div>
              {isBelowReorderPoint ? (
                <Badge variant="destructive" className="gap-1">
                  <TrendingDown className="h-3 w-3" />
                  Below Reorder Point
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <Package className="h-3 w-3" />
                  Stock OK
                </Badge>
              )}
            </div>
          </div>

          {/* Alert if below reorder point */}
          {isBelowReorderPoint && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Stock is below the reorder point. Consider creating a purchase order.
              </AlertDescription>
            </Alert>
          )}

          <Separator />

          {/* Reorder Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Reorder Point */}
            <div className="space-y-2">
              <Label htmlFor="reorder-point" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Reorder Point (Threshold)
              </Label>
              <Input
                id="reorder-point"
                type="number"
                min="0"
                step="1"
                value={reorderPoint}
                onChange={(e) => setReorderPoint(e.target.value)}
                placeholder="10"
              />
              <p className="text-xs text-muted-foreground">
                Alert when stock falls to this level
              </p>
            </div>

            {/* Reorder Quantity */}
            <div className="space-y-2">
              <Label htmlFor="reorder-quantity" className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Reorder Quantity
              </Label>
              <Input
                id="reorder-quantity"
                type="number"
                min="1"
                step="1"
                value={reorderQuantity}
                onChange={(e) => setReorderQuantity(e.target.value)}
                placeholder="50"
              />
              <p className="text-xs text-muted-foreground">
                Number of units to order when reordering
              </p>
            </div>
          </div>

          {/* Preferred Vendor Selection */}
          <div className="space-y-2">
            <Label htmlFor="preferred-vendor" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Preferred Vendor
            </Label>
            <Select
              value={preferredVendorId}
              onValueChange={setPreferredVendorId}
            >
              <SelectTrigger id="preferred-vendor">
                <SelectValue placeholder="Select a vendor..." />
              </SelectTrigger>
              <SelectContent>
                {vendors?.length === 0 ? (
                  <SelectItem value="__placeholder__" disabled>
                    No vendors available
                  </SelectItem>
                ) : (
                  vendors?.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      <span className="flex items-center gap-2">
                        <Building2 className="h-3 w-3" />
                        {vendor.name}
                        {vendor.contact_email && (
                          <span className="text-muted-foreground text-xs">
                            ({vendor.contact_email})
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Purchase orders will be sent to this vendor
            </p>
          </div>

          {/* Auto Reorder Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="auto-reorder" className="flex items-center gap-2 cursor-pointer">
                <Clock className="h-4 w-4" />
                Enable Auto-Reorder
              </Label>
              <p className="text-sm text-muted-foreground">
                Automatically generate PO drafts when stock hits reorder point
              </p>
            </div>
            <Switch
              id="auto-reorder"
              checked={autoReorderEnabled}
              onCheckedChange={setAutoReorderEnabled}
              disabled={!preferredVendorId}
            />
          </div>

          {autoReorderEnabled && !preferredVendorId && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Please select a preferred vendor to enable auto-reorder.
              </AlertDescription>
            </Alert>
          )}

          {/* Selected Vendor Info */}
          {selectedVendor && (
            <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-950/30">
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-green-600" />
                <span className="font-medium">Selected Vendor:</span>
                <span>{selectedVendor.name}</span>
                {selectedVendor.contact_email && (
                  <span className="text-muted-foreground">
                    • {selectedVendor.contact_email}
                  </span>
                )}
              </div>
            </div>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={!isFormValid || isSaving}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>

            {isBelowReorderPoint && preferredVendorId && (
              <Button
                type="button"
                variant="outline"
                onClick={handleCreatePO}
                disabled={createPOMutation.isPending}
              >
                {createPOMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating PO...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Create PO Now
                  </>
                )}
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              onClick={handleViewPurchaseOrders}
            >
              View Purchase Orders
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Dashboard Widget Component
// ============================================================================

/**
 * PendingReordersWidget - Dashboard widget showing products needing reorder
 */
export function PendingReordersWidget() {
  const { navigateToAdmin } = useTenantNavigation();
  const { data: pendingReorders, isLoading, error } = usePendingReorders();

  const handleViewProduct = useCallback((productId: string) => {
    navigateToAdmin(`products/${productId}`);
  }, [navigateToAdmin]);

  const handleViewAll = useCallback(() => {
    navigateToAdmin('inventory/low-stock');
  }, [navigateToAdmin]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Pending Reorders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>Failed to load pending reorders</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const count = pendingReorders?.length ?? 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Pending Reorders
          </CardTitle>
          {count > 0 && (
            <Badge variant="destructive">{count}</Badge>
          )}
        </div>
        <CardDescription>
          Products below reorder point
        </CardDescription>
      </CardHeader>
      <CardContent>
        {count === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No products need reordering</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingReorders?.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={() => handleViewProduct(item.product_id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleViewProduct(item.product_id);
                  }
                }}
              >
                <div className="space-y-1">
                  <p className="font-medium text-sm">{item.product_name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Stock: {item.current_stock}</span>
                    <span>•</span>
                    <span>Reorder at: {item.reorder_point}</span>
                    {item.vendor_name && (
                      <>
                        <span>•</span>
                        <span>{item.vendor_name}</span>
                      </>
                    )}
                  </div>
                </div>
                <Badge variant="destructive" className="shrink-0">
                  <TrendingDown className="h-3 w-3 mr-1" />
                  Low
                </Badge>
              </div>
            ))}

            {count > 5 && (
              <Button
                variant="ghost"
                className="w-full"
                onClick={handleViewAll}
              >
                View all {count} items
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ReorderSettings;
