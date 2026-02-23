/**
 * ProductBundle Component
 *
 * Product bundle/kit management component for creating bundles with multiple products.
 * Features:
 * - Define bundles with multiple products and quantities
 * - Set bundle price (usually discounted vs individual items)
 * - Track which products are in each bundle
 * - Calculate savings vs buying individually
 * - Inventory decrement for component products when bundle is ordered
 * - Track bundle sales separately
 *
 * Task 102: Create product bundle/kit support
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import Save from 'lucide-react/dist/esm/icons/save';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import Package from 'lucide-react/dist/esm/icons/package';
import DollarSign from 'lucide-react/dist/esm/icons/dollar-sign';
import Percent from 'lucide-react/dist/esm/icons/percent';
import Gift from 'lucide-react/dist/esm/icons/gift';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up';
import Eye from 'lucide-react/dist/esm/icons/eye';
import Edit from 'lucide-react/dist/esm/icons/edit';
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3';
import ShoppingCart from 'lucide-react/dist/esm/icons/shopping-cart';
import X from 'lucide-react/dist/esm/icons/x';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';

// ============================================================================
// Types
// ============================================================================

interface BundleProduct {
  product_id: string;
  product_name: string;
  product_sku: string | null;
  product_price: number;
  product_image_url: string | null;
  quantity: number;
  available_stock: number;
}

interface ProductBundle {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  sku: string | null;
  bundle_price: number;
  discount_type: 'percentage' | 'fixed' | 'custom';
  discount_value: number;
  is_active: boolean;
  items: BundleProduct[];
  sales_count: number;
  revenue: number;
  created_at: string;
  updated_at: string;
}

interface AvailableProduct {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  retail_price: number | null;
  image_url: string | null;
  available_quantity: number | null;
  stock_quantity: number | null;
}

interface BundleSalesData {
  total_sales: number;
  total_revenue: number;
  average_order_value: number;
  top_selling_period: string | null;
}

interface ProductBundleManagerProps {
  /** If provided, only manage bundles for this specific product */
  productId?: string;
  /** Callback when a bundle is created or updated */
  onBundleChange?: () => void;
}

interface BundleFormData {
  name: string;
  description: string;
  sku: string;
  bundle_price: string;
  discount_type: 'percentage' | 'fixed' | 'custom';
  discount_value: string;
  is_active: boolean;
  items: Array<{ product_id: string; quantity: number }>;
}

// ============================================================================
// Query Keys
// ============================================================================

const bundleKeys = {
  all: ['product-bundles'] as const,
  list: (tenantId: string) => [...bundleKeys.all, 'list', tenantId] as const,
  detail: (bundleId: string) => [...bundleKeys.all, 'detail', bundleId] as const,
  sales: (bundleId: string) => [...bundleKeys.all, 'sales', bundleId] as const,
  products: (tenantId: string) => [...bundleKeys.all, 'products', tenantId] as const,
};

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_FORM_DATA: BundleFormData = {
  name: '',
  description: '',
  sku: '',
  bundle_price: '',
  discount_type: 'percentage',
  discount_value: '10',
  is_active: true,
  items: [],
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch available products for bundle creation
 */
function useAvailableProducts() {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: bundleKeys.products(tenant?.id ?? ''),
    queryFn: async (): Promise<AvailableProduct[]> => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, price, retail_price, image_url, available_quantity, stock_quantity')
        .eq('tenant_id', tenant.id)
        .eq('menu_visibility', true)
        .order('name');

      if (error) {
        logger.error('Failed to fetch available products for bundles', error, {
          component: 'ProductBundle',
          tenantId: tenant.id,
        });
        throw error;
      }

      return (data ?? []) as AvailableProduct[];
    },
    enabled: !!tenant?.id,
    staleTime: 30_000,
  });
}

/**
 * Hook to fetch existing bundles
 */
function useBundles(productId?: string) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: [...bundleKeys.list(tenant?.id ?? ''), productId],
    queryFn: async (): Promise<ProductBundle[]> => {
      if (!tenant?.id) return [];

      // Fetch bundles from tenant's settings or a dedicated table
      // For now, we'll use the products table with category='bundle'
      let query = supabase
        .from('products')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('category', 'bundle')
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to fetch product bundles', error, {
          component: 'ProductBundle',
          tenantId: tenant.id,
        });
        throw error;
      }

      // Transform product data to bundle format
      const bundles: ProductBundle[] = (data ?? []).map((product) => {
        const bundleData = (product.prices as Record<string, unknown>) ?? {};
        const items: BundleProduct[] = Array.isArray(bundleData.bundle_items)
          ? bundleData.bundle_items as BundleProduct[]
          : [];

        return {
          id: product.id,
          name: product.name,
          description: product.description,
          image_url: product.image_url,
          sku: product.sku,
          bundle_price: product.price,
          discount_type: (bundleData.discount_type as 'percentage' | 'fixed' | 'custom') ?? 'custom',
          discount_value: (bundleData.discount_value as number) ?? 0,
          is_active: product.in_stock ?? true,
          items,
          sales_count: (bundleData.sales_count as number) ?? 0,
          revenue: (bundleData.revenue as number) ?? 0,
          created_at: product.created_at ?? new Date().toISOString(),
          updated_at: product.created_at ?? new Date().toISOString(),
        };
      });

      // If productId is provided, filter bundles containing that product
      if (productId) {
        return bundles.filter(bundle =>
          bundle.items.some(item => item.product_id === productId)
        );
      }

      return bundles;
    },
    enabled: !!tenant?.id,
    staleTime: 30_000,
  });
}

/**
 * Hook to fetch bundle sales analytics
 */
function useBundleSales(bundleId?: string) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: bundleKeys.sales(bundleId ?? ''),
    queryFn: async (): Promise<BundleSalesData | null> => {
      if (!tenant?.id || !bundleId) return null;

      // Fetch order items where product_id = bundleId
      const { data: orderItems, error } = await (supabase as any)
        .from('order_items')
        .select(`
          quantity,
          total,
          orders!inner(
            created_at,
            tenant_id
          )
        `)
        .eq('product_id', bundleId)
        .eq('orders.tenant_id', tenant.id);

      if (error) {
        logger.error('Failed to fetch bundle sales data', error, {
          component: 'ProductBundle',
          bundleId,
        });
        return null;
      }

      if (!orderItems || orderItems.length === 0) {
        return {
          total_sales: 0,
          total_revenue: 0,
          average_order_value: 0,
          top_selling_period: null,
        };
      }

      const totalSales = orderItems.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
      const totalRevenue = orderItems.reduce((sum, item) => sum + (item.total ?? 0), 0);

      return {
        total_sales: totalSales,
        total_revenue: totalRevenue,
        average_order_value: totalSales > 0 ? totalRevenue / totalSales : 0,
        top_selling_period: null, // Would need date aggregation
      };
    },
    enabled: !!tenant?.id && !!bundleId,
    staleTime: 60_000,
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate total value of bundle items if purchased individually
 */
function calculateIndividualTotal(
  items: Array<{ product_id: string; quantity: number }>,
  products: AvailableProduct[]
): number {
  return items.reduce((total, item) => {
    const product = products.find(p => p.id === item.product_id);
    const price = product?.retail_price ?? product?.price ?? 0;
    return total + (price * item.quantity);
  }, 0);
}

/**
 * Calculate bundle price based on discount settings
 */
function calculateBundlePrice(
  individualTotal: number,
  discountType: 'percentage' | 'fixed' | 'custom',
  discountValue: number,
  customPrice?: number
): number {
  switch (discountType) {
    case 'percentage':
      return individualTotal * (1 - discountValue / 100);
    case 'fixed':
      return Math.max(0, individualTotal - discountValue);
    case 'custom':
      return customPrice ?? individualTotal;
    default:
      return individualTotal;
  }
}

/**
 * Generate a bundle SKU
 */
function generateBundleSku(bundleName: string): string {
  const prefix = 'BDL';
  const cleaned = bundleName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 6);
  const timestamp = Date.now().toString(36).toUpperCase().substring(-4);
  return `${prefix}-${cleaned}-${timestamp}`;
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Bundle Item Row Component
 */
interface BundleItemRowProps {
  item: { product_id: string; quantity: number };
  products: AvailableProduct[];
  onQuantityChange: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
}

function BundleItemRow({ item, products, onQuantityChange, onRemove }: BundleItemRowProps) {
  const product = products.find(p => p.id === item.product_id);

  if (!product) return null;

  const stock = product.available_quantity ?? product.stock_quantity ?? 0;
  const lineTotal = (product.retail_price ?? product.price) * item.quantity;
  const isLowStock = stock < item.quantity;

  return (
    <TableRow>
      <TableCell className="w-12">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-10 h-10 object-cover rounded"
          />
        ) : (
          <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
            <Package className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </TableCell>
      <TableCell>
        <div>
          <p className="font-medium">{product.name}</p>
          {product.sku && (
            <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">
        {formatCurrency(product.retail_price ?? product.price)}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min="1"
            max={stock}
            value={item.quantity}
            onChange={(e) => onQuantityChange(item.product_id, parseInt(e.target.value) || 1)}
            className="w-20"
          />
          {isLowStock && (
            <Badge variant="destructive" className="text-xs">
              Low stock: {stock}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right font-medium">
        {formatCurrency(lineTotal)}
      </TableCell>
      <TableCell className="w-12">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(item.product_id)}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

/**
 * Bundle Sales Card Component
 */
interface BundleSalesCardProps {
  bundleId: string;
}

function BundleSalesCard({ bundleId }: BundleSalesCardProps) {
  const { data: sales, isLoading } = useBundleSales(bundleId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Bundle Sales
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold">{sales?.total_sales ?? 0}</p>
            <p className="text-xs text-muted-foreground">Units Sold</p>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold">{formatCurrency(sales?.total_revenue ?? 0)}</p>
            <p className="text-xs text-muted-foreground">Revenue</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ProductBundleManager({ productId, onBundleChange }: ProductBundleManagerProps) {
  const { tenant } = useTenantAdminAuth();
  const { navigateToAdmin } = useTenantNavigation();
  const queryClient = useQueryClient();

  // State
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingBundle, setEditingBundle] = useState<ProductBundle | null>(null);
  const [formData, setFormData] = useState<BundleFormData>(DEFAULT_FORM_DATA);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bundleToDelete, setBundleToDelete] = useState<ProductBundle | null>(null);

  // Queries
  const { data: products = [], isLoading: productsLoading } = useAvailableProducts();
  const { data: bundles = [], isLoading: bundlesLoading, error: bundlesError } = useBundles(productId);

  // Computed values
  const availableProducts = useMemo(() =>
    products.filter(p => !formData.items.some(item => item.product_id === p.id)),
    [products, formData.items]
  );

  const individualTotal = useMemo(() =>
    calculateIndividualTotal(formData.items, products),
    [formData.items, products]
  );

  const calculatedBundlePrice = useMemo(() => {
    const customPrice = parseFloat(formData.bundle_price) || 0;
    const discountValue = parseFloat(formData.discount_value) || 0;
    return calculateBundlePrice(individualTotal, formData.discount_type, discountValue, customPrice);
  }, [individualTotal, formData.discount_type, formData.discount_value, formData.bundle_price]);

  const savings = useMemo(() => individualTotal - calculatedBundlePrice, [individualTotal, calculatedBundlePrice]);
  const savingsPercent = useMemo(() =>
    individualTotal > 0 ? (savings / individualTotal) * 100 : 0,
    [savings, individualTotal]
  );

  // Reset form when dialog closes
  const resetForm = useCallback(() => {
    setFormData(DEFAULT_FORM_DATA);
    setSelectedProductId('');
    setEditingBundle(null);
  }, []);

  // Open edit dialog with existing bundle data
  const openEditDialog = useCallback((bundle: ProductBundle) => {
    setEditingBundle(bundle);
    setFormData({
      name: bundle.name,
      description: bundle.description ?? '',
      sku: bundle.sku ?? '',
      bundle_price: bundle.bundle_price.toString(),
      discount_type: bundle.discount_type,
      discount_value: bundle.discount_value.toString(),
      is_active: bundle.is_active,
      items: bundle.items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
      })),
    });
    setShowCreateDialog(true);
  }, []);

  // Add product to bundle
  const addProductToBundle = useCallback(() => {
    if (!selectedProductId) return;

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { product_id: selectedProductId, quantity: 1 }],
    }));
    setSelectedProductId('');
  }, [selectedProductId]);

  // Update item quantity
  const updateItemQuantity = useCallback((productId: string, quantity: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.product_id === productId ? { ...item, quantity: Math.max(1, quantity) } : item
      ),
    }));
  }, []);

  // Remove item from bundle
  const removeItem = useCallback((productId: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.product_id !== productId),
    }));
  }, []);

  // Create/Update bundle mutation
  const saveBundleMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id) {
        throw new Error('No tenant context');
      }

      if (formData.items.length < 2) {
        throw new Error('A bundle must contain at least 2 products');
      }

      const bundleItems: BundleProduct[] = formData.items.map(item => {
        const product = products.find(p => p.id === item.product_id);
        return {
          product_id: item.product_id,
          product_name: product?.name ?? 'Unknown',
          product_sku: product?.sku ?? null,
          product_price: product?.retail_price ?? product?.price ?? 0,
          product_image_url: product?.image_url ?? null,
          quantity: item.quantity,
          available_stock: product?.available_quantity ?? product?.stock_quantity ?? 0,
        };
      });

      const bundleData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        sku: formData.sku.trim() || generateBundleSku(formData.name),
        category: 'bundle',
        price: calculatedBundlePrice,
        retail_price: calculatedBundlePrice,
        in_stock: formData.is_active,
        menu_visibility: formData.is_active,
        tenant_id: tenant.id,
        prices: {
          bundle_items: bundleItems,
          discount_type: formData.discount_type,
          discount_value: parseFloat(formData.discount_value) || 0,
          individual_total: individualTotal,
          savings: savings,
          savings_percent: savingsPercent,
        },
        available_quantity: Math.min(...bundleItems.map(item =>
          Math.floor(item.available_stock / item.quantity)
        )),
      };

      if (editingBundle) {
        // Update existing bundle
        const { error } = await (supabase as any)
          .from('products')
          .update({
            ...bundleData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingBundle.id)
          .eq('tenant_id', tenant.id);

        if (error) {
          logger.error('Failed to update product bundle', error, {
            component: 'ProductBundle',
            bundleId: editingBundle.id,
          });
          throw error;
        }
      } else {
        // Create new bundle
        const { error } = await (supabase as any)
          .from('products')
          .insert(bundleData);

        if (error) {
          logger.error('Failed to create product bundle', error, {
            component: 'ProductBundle',
            tenantId: tenant.id,
          });
          throw error;
        }
      }
    },
    onSuccess: () => {
      const action = editingBundle ? 'updated' : 'created';
      showSuccessToast('Bundle Saved', `Product bundle ${action} successfully`);

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: bundleKeys.list(tenant?.id ?? '') });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });

      setShowCreateDialog(false);
      resetForm();
      onBundleChange?.();
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to save bundle';
      showErrorToast('Save Failed', message);
    },
  });

  // Delete bundle mutation
  const deleteBundleMutation = useMutation({
    mutationFn: async (bundleId: string) => {
      if (!tenant?.id) {
        throw new Error('No tenant context');
      }

      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', bundleId)
        .eq('tenant_id', tenant.id)
        .eq('category', 'bundle');

      if (error) {
        logger.error('Failed to delete product bundle', error, {
          component: 'ProductBundle',
          bundleId,
        });
        throw error;
      }
    },
    onSuccess: () => {
      showSuccessToast('Bundle Deleted', 'Product bundle deleted successfully');

      queryClient.invalidateQueries({ queryKey: bundleKeys.list(tenant?.id ?? '') });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      onBundleChange?.();
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to delete bundle';
      showErrorToast('Delete Failed', message);
    },
  });

  // Handlers
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    saveBundleMutation.mutate();
  }, [saveBundleMutation]);

  const handleDeleteClick = useCallback((bundle: ProductBundle) => {
    setBundleToDelete(bundle);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (bundleToDelete) {
      deleteBundleMutation.mutate(bundleToDelete.id);
      setDeleteDialogOpen(false);
      setBundleToDelete(null);
    }
  }, [bundleToDelete, deleteBundleMutation]);

  const handleViewBundle = useCallback((bundleId: string) => {
    navigateToAdmin(`products/${bundleId}`);
  }, [navigateToAdmin]);

  const isLoading = productsLoading || bundlesLoading;
  const isSaving = saveBundleMutation.isPending;
  const isFormValid = formData.name.trim().length > 0 && formData.items.length >= 2;

  // Error state
  if (bundlesError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Error Loading Bundles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>
              Failed to load product bundles. Please try again.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5" />
                Product Bundles
              </CardTitle>
              <CardDescription>
                Create and manage product bundles with discounted pricing
              </CardDescription>
            </div>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Bundle
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Bundle List */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="w-16 h-16 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : bundles.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Gift className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No Bundles Yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first product bundle to offer discounts on product combinations.
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Bundle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {bundles.map((bundle) => (
            <Card key={bundle.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{bundle.name}</CardTitle>
                    {bundle.sku && (
                      <CardDescription className="text-xs">
                        SKU: {bundle.sku}
                      </CardDescription>
                    )}
                  </div>
                  <Badge variant={bundle.is_active ? 'default' : 'secondary'}>
                    {bundle.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                {bundle.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {bundle.description}
                  </p>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Products:</span>
                    <span className="font-medium">{bundle.items.length} items</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Bundle Price:</span>
                    <span className="font-bold text-lg">{formatCurrency(bundle.bundle_price)}</span>
                  </div>
                  {bundle.discount_value > 0 && (
                    <Badge variant="outline" className="gap-1">
                      <Percent className="h-3 w-3" />
                      Save {bundle.discount_type === 'percentage'
                        ? `${bundle.discount_value}%`
                        : formatCurrency(bundle.discount_value)}
                    </Badge>
                  )}
                </div>

                {/* Component Products Preview */}
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Contains:</p>
                  <div className="flex flex-wrap gap-1">
                    {bundle.items.slice(0, 3).map((item) => (
                      <Badge key={item.product_id} variant="secondary" className="text-xs">
                        {item.product_name} x{item.quantity}
                      </Badge>
                    ))}
                    {bundle.items.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{bundle.items.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Sales Stats */}
                {bundle.sales_count > 0 && (
                  <div className="mt-3 pt-3 border-t flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <ShoppingCart className="h-3 w-3" />
                      {bundle.sales_count} sold
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      {formatCurrency(bundle.revenue)} revenue
                    </span>
                  </div>
                )}
              </CardContent>
              <CardFooter className="bg-muted/50 gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleViewBundle(bundle.id)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEditDialog(bundle)}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteClick(bundle)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setBundleToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        itemName={bundleToDelete?.name}
        itemType="bundle"
        isLoading={deleteBundleMutation.isPending}
      />

      {/* Create/Edit Bundle Dialog */}
      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5" />
              {editingBundle ? 'Edit Bundle' : 'Create Product Bundle'}
            </DialogTitle>
            <DialogDescription>
              Combine products together and offer a discounted bundle price.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
            <ScrollArea className="flex-1 px-1">
              <div className="space-y-6 pb-4">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bundle-name">Bundle Name *</Label>
                    <Input
                      id="bundle-name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Starter Kit"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bundle-sku">SKU (optional)</Label>
                    <Input
                      id="bundle-sku"
                      value={formData.sku}
                      onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                      placeholder="Auto-generated if empty"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bundle-description">Description</Label>
                  <Textarea
                    id="bundle-description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe what's included in this bundle..."
                    rows={2}
                  />
                </div>

                <Separator />

                {/* Add Products */}
                <div className="space-y-3">
                  <Label>Bundle Products *</Label>
                  <div className="flex gap-2">
                    <Select
                      value={selectedProductId}
                      onValueChange={setSelectedProductId}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select a product to add..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableProducts.length === 0 ? (
                          <SelectItem value="__placeholder__" disabled>
                            No more products available
                          </SelectItem>
                        ) : (
                          availableProducts.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              <span className="flex items-center gap-2">
                                {product.name}
                                <span className="text-muted-foreground">
                                  ({formatCurrency(product.retail_price ?? product.price)})
                                </span>
                              </span>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      onClick={addProductToBundle}
                      disabled={!selectedProductId}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>

                  {formData.items.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12"></TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead className="text-right">Price</TableHead>
                            <TableHead className="w-32">Qty</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {formData.items.map((item) => (
                            <BundleItemRow
                              key={item.product_id}
                              item={item}
                              products={products}
                              onQuantityChange={updateItemQuantity}
                              onRemove={removeItem}
                            />
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="border rounded-lg p-8 text-center text-muted-foreground">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Add at least 2 products to create a bundle</p>
                    </div>
                  )}

                  {formData.items.length > 0 && formData.items.length < 2 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Add at least one more product. A bundle must contain 2 or more products.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <Separator />

                {/* Pricing */}
                <div className="space-y-4">
                  <Label>Bundle Pricing</Label>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="discount-type" className="text-sm">Discount Type</Label>
                      <Select
                        value={formData.discount_type}
                        onValueChange={(value: 'percentage' | 'fixed' | 'custom') =>
                          setFormData(prev => ({ ...prev, discount_type: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage Off</SelectItem>
                          <SelectItem value="fixed">Fixed Amount Off</SelectItem>
                          <SelectItem value="custom">Custom Price</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.discount_type !== 'custom' ? (
                      <div className="space-y-2">
                        <Label htmlFor="discount-value" className="text-sm">
                          {formData.discount_type === 'percentage' ? 'Discount %' : 'Amount Off'}
                        </Label>
                        <div className="relative">
                          <Input
                            id="discount-value"
                            type="number"
                            min="0"
                            max={formData.discount_type === 'percentage' ? 100 : undefined}
                            value={formData.discount_value}
                            onChange={(e) => setFormData(prev => ({ ...prev, discount_value: e.target.value }))}
                            className={formData.discount_type === 'percentage' ? 'pr-8' : 'pl-8'}
                          />
                          {formData.discount_type === 'percentage' ? (
                            <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          ) : (
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="bundle-price" className="text-sm">Bundle Price</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="bundle-price"
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.bundle_price}
                            onChange={(e) => setFormData(prev => ({ ...prev, bundle_price: e.target.value }))}
                            className="pl-8"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-sm">Individual Total</Label>
                      <div className="h-10 px-3 flex items-center bg-muted rounded-md text-muted-foreground">
                        {formatCurrency(individualTotal)}
                      </div>
                    </div>
                  </div>

                  {/* Price Summary */}
                  {formData.items.length >= 2 && (
                    <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Bundle Price:</span>
                        <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {formatCurrency(calculatedBundlePrice)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-green-600 dark:text-green-400">
                          Customers save {formatCurrency(savings)} ({savingsPercent.toFixed(0)}% off)
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Status */}
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="bundle-active" className="cursor-pointer">
                      Bundle Active
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Active bundles appear on menus and can be ordered
                    </p>
                  </div>
                  <Switch
                    id="bundle-active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                  />
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="mt-4 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!isFormValid || isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {editingBundle ? 'Update Bundle' : 'Create Bundle'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Export Components
// ============================================================================

/**
 * ProductBundleCard - Single bundle display card for product detail pages
 */
export function ProductBundleCard({ bundleId }: { bundleId: string }) {
  const { data: bundles = [] } = useBundles();
  const bundle = bundles.find(b => b.id === bundleId);

  if (!bundle) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Gift className="h-4 w-4" />
          {bundle.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {bundle.items.map((item) => (
            <div key={item.product_id} className="flex items-center justify-between text-sm">
              <span>{item.product_name}</span>
              <span className="text-muted-foreground">x{item.quantity}</span>
            </div>
          ))}
          <Separator />
          <div className="flex items-center justify-between font-medium">
            <span>Bundle Price</span>
            <span className="text-green-600">{formatCurrency(bundle.bundle_price)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * ProductBundleBadge - Small badge showing product is in bundles
 */
export function ProductBundleBadge({ productId }: { productId: string }) {
  const { data: bundles = [] } = useBundles(productId);

  if (bundles.length === 0) return null;

  return (
    <Badge variant="outline" className="gap-1">
      <Gift className="h-3 w-3" />
      In {bundles.length} bundle{bundles.length > 1 ? 's' : ''}
    </Badge>
  );
}

export { useBundles, useBundleSales };
export default ProductBundleManager;
