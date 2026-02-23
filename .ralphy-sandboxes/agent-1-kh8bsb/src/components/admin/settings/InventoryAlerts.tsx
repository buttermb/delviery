/**
 * InventoryAlerts Component
 *
 * Configure inventory alert thresholds globally and per-product.
 * - Global defaults for low_stock_threshold and critical_stock_threshold
 * - Override per product
 * - Configure notification channels — in-app, email
 * - Set recheck frequency
 * - Save to tenant_settings or product columns
 *
 * Task 109: Create inventory alerts settings page
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import Save from 'lucide-react/dist/esm/icons/save';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import Bell from 'lucide-react/dist/esm/icons/bell';
import Mail from 'lucide-react/dist/esm/icons/mail';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import Package from 'lucide-react/dist/esm/icons/package';
import Search from 'lucide-react/dist/esm/icons/search';
import X from 'lucide-react/dist/esm/icons/x';
import Settings2 from 'lucide-react/dist/esm/icons/settings-2';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
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

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';

// ============================================================================
// Types
// ============================================================================

interface ProductOverride {
  product_id: string;
  product_name: string;
  sku: string | null;
  low_stock_threshold: number;
  critical_stock_threshold: number;
  current_stock: number;
}

interface TenantSettings {
  id: string;
  tenant_id: string;
  inventory_alerts_enabled?: boolean;
  inventory_low_stock_threshold?: number;
  inventory_critical_stock_threshold?: number;
  inventory_notification_inapp?: boolean;
  inventory_notification_email?: boolean;
  inventory_recheck_frequency?: string;
  [key: string]: unknown;
}

// Recheck frequency options
const RECHECK_FREQUENCIES = [
  { value: '15m', label: 'Every 15 minutes' },
  { value: '30m', label: 'Every 30 minutes' },
  { value: '1h', label: 'Every hour' },
  { value: '2h', label: 'Every 2 hours' },
  { value: '4h', label: 'Every 4 hours' },
  { value: '8h', label: 'Every 8 hours' },
  { value: '24h', label: 'Daily' },
] as const;

// Form schema
const formSchema = z.object({
  enabled: z.boolean().default(true),
  low_stock_threshold: z.number().min(0, 'Must be 0 or greater').default(10),
  critical_stock_threshold: z.number().min(0, 'Must be 0 or greater').default(5),
  notification_inapp: z.boolean().default(true),
  notification_email: z.boolean().default(false),
  recheck_frequency: z.string().default('1h'),
});

type FormValues = z.infer<typeof formSchema>;

// Query keys for this component
const inventoryAlertsKeys = {
  all: ['inventory-alerts-settings'] as const,
  settings: (tenantId: string) => [...inventoryAlertsKeys.all, 'settings', tenantId] as const,
  productOverrides: (tenantId: string) => [...inventoryAlertsKeys.all, 'product-overrides', tenantId] as const,
};

// ============================================================================
// Main Component
// ============================================================================

export function InventoryAlerts() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [productOverrides, setProductOverrides] = useState<Map<string, { low: number; critical: number }>>(new Map());

  // Fetch current settings
  const { data: settings, isLoading: isLoadingSettings, error: settingsError } = useQuery({
    queryKey: inventoryAlertsKeys.settings(tenant?.id ?? ''),
    queryFn: async (): Promise<TenantSettings | null> => {
      if (!tenant?.id) return null;

      const { data, error } = await (supabase as any)
        .from('tenant_settings')
        .select('*')
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch tenant settings for inventory alerts', error, {
          component: 'InventoryAlerts',
          tenantId: tenant.id,
        });
        throw error;
      }

      return data as TenantSettings | null;
    },
    enabled: !!tenant?.id,
  });

  // Fetch products with custom thresholds
  const { data: products, isLoading: isLoadingProducts } = useQuery({
    queryKey: inventoryAlertsKeys.productOverrides(tenant?.id ?? ''),
    queryFn: async (): Promise<ProductOverride[]> => {
      if (!tenant?.id) return [];

      const { data, error } = await (supabase as any)
        .from('products')
        .select('id, name, sku, low_stock_alert, critical_stock_alert, stock_quantity, available_quantity')
        .eq('tenant_id', tenant.id)
        .order('name');

      if (error) {
        logger.error('Failed to fetch products for inventory alerts', error, {
          component: 'InventoryAlerts',
          tenantId: tenant.id,
        });
        throw error;
      }

      return (data ?? []).map(product => ({
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        low_stock_threshold: (product as Record<string, unknown>).low_stock_alert as number ?? 10,
        critical_stock_threshold: (product as Record<string, unknown>).critical_stock_alert as number ?? 5,
        current_stock: product.available_quantity ?? product.stock_quantity ?? 0,
      }));
    },
    enabled: !!tenant?.id,
    staleTime: 30_000,
  });

  // Form setup
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      enabled: true,
      low_stock_threshold: 10,
      critical_stock_threshold: 5,
      notification_inapp: true,
      notification_email: false,
      recheck_frequency: '1h',
    },
  });

  // Update form when settings are loaded
  useEffect(() => {
    if (settings) {
      form.reset({
        enabled: settings.inventory_alerts_enabled ?? true,
        low_stock_threshold: settings.inventory_low_stock_threshold ?? 10,
        critical_stock_threshold: settings.inventory_critical_stock_threshold ?? 5,
        notification_inapp: settings.inventory_notification_inapp ?? true,
        notification_email: settings.inventory_notification_email ?? false,
        recheck_frequency: settings.inventory_recheck_frequency ?? '1h',
      });
    }
  }, [settings, form]);

  // Filter products based on search
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!searchQuery.trim()) return products;

    const query = searchQuery.toLowerCase();
    return products.filter(
      p => p.product_name.toLowerCase().includes(query) ||
           (p.sku && p.sku.toLowerCase().includes(query))
    );
  }, [products, searchQuery]);

  // Products with custom thresholds
  const productsWithOverrides = useMemo(() => {
    if (!products || !settings) return [];

    const defaultLow = settings.inventory_low_stock_threshold ?? 10;
    const defaultCritical = settings.inventory_critical_stock_threshold ?? 5;

    return filteredProducts.filter(p =>
      p.low_stock_threshold !== defaultLow ||
      p.critical_stock_threshold !== defaultCritical
    );
  }, [filteredProducts, settings]);

  // Save global settings mutation
  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!tenant?.id) throw new Error('No tenant ID');

      const updateData = {
        tenant_id: tenant.id,
        inventory_alerts_enabled: values.enabled,
        inventory_low_stock_threshold: values.low_stock_threshold,
        inventory_critical_stock_threshold: values.critical_stock_threshold,
        inventory_notification_inapp: values.notification_inapp,
        inventory_notification_email: values.notification_email,
        inventory_recheck_frequency: values.recheck_frequency,
        updated_at: new Date().toISOString(),
      };

      const { error } = await (supabase as any)
        .from('tenant_settings')
        .upsert(updateData, {
          onConflict: 'tenant_id',
        });

      if (error) {
        logger.error('Failed to save inventory alerts settings', error, {
          component: 'InventoryAlerts',
        });
        throw error;
      }

      logger.info('Saved inventory alerts settings', {
        component: 'InventoryAlerts',
        tenantId: tenant.id,
      });

      return values;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryAlertsKeys.settings(tenant?.id ?? '') });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.alerts() });
      showSuccessToast('Settings Saved', 'Inventory alert thresholds updated successfully');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to save settings';
      logger.error('Save inventory alerts settings failed', error, { component: 'InventoryAlerts' });
      showErrorToast('Save Failed', message);
    },
  });

  // Save product override mutation
  const saveProductOverrideMutation = useMutation({
    mutationFn: async ({ productId, lowThreshold, criticalThreshold }: {
      productId: string;
      lowThreshold: number;
      criticalThreshold: number;
    }) => {
      if (!tenant?.id) throw new Error('No tenant ID');

      const { error } = await supabase
        .from('products')
        .update({
          low_stock_alert: lowThreshold,
          critical_stock_alert: criticalThreshold,
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId)
        .eq('tenant_id', tenant.id);

      if (error) {
        logger.error('Failed to save product alert override', error, {
          component: 'InventoryAlerts',
          productId,
        });
        throw error;
      }

      logger.info('Saved product alert override', {
        component: 'InventoryAlerts',
        productId,
        lowThreshold,
        criticalThreshold,
      });

      return { productId, lowThreshold, criticalThreshold };
    },
    onSuccess: ({ productId }) => {
      queryClient.invalidateQueries({ queryKey: inventoryAlertsKeys.productOverrides(tenant?.id ?? '') });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      showSuccessToast('Product Updated', 'Custom thresholds saved');
      setEditingProduct(null);
      productOverrides.delete(productId);
      setProductOverrides(new Map(productOverrides));
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to save';
      showErrorToast('Save Failed', message);
    },
  });

  // Reset product to global defaults
  const resetProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      if (!tenant?.id) throw new Error('No tenant ID');

      const defaultLow = form.getValues('low_stock_threshold');
      const defaultCritical = form.getValues('critical_stock_threshold');

      const { error } = await supabase
        .from('products')
        .update({
          low_stock_alert: defaultLow,
          critical_stock_alert: defaultCritical,
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId)
        .eq('tenant_id', tenant.id);

      if (error) {
        logger.error('Failed to reset product alert thresholds', error, {
          component: 'InventoryAlerts',
          productId,
        });
        throw error;
      }

      return productId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryAlertsKeys.productOverrides(tenant?.id ?? '') });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      showSuccessToast('Product Reset', 'Now using global default thresholds');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to reset';
      showErrorToast('Reset Failed', message);
    },
  });

  // Handle form submission
  const onSubmit = useCallback(async (values: FormValues) => {
    // Validate critical is less than low
    if (values.critical_stock_threshold >= values.low_stock_threshold) {
      form.setError('critical_stock_threshold', {
        type: 'manual',
        message: 'Critical threshold must be less than low stock threshold',
      });
      return;
    }

    setIsSaving(true);
    try {
      await saveMutation.mutateAsync(values);
    } finally {
      setIsSaving(false);
    }
  }, [saveMutation, form]);

  // Handle product override save
  const handleSaveProductOverride = useCallback((product: ProductOverride) => {
    const override = productOverrides.get(product.product_id);
    if (!override) return;

    if (override.critical >= override.low) {
      showErrorToast('Invalid Thresholds', 'Critical threshold must be less than low stock threshold');
      return;
    }

    saveProductOverrideMutation.mutate({
      productId: product.product_id,
      lowThreshold: override.low,
      criticalThreshold: override.critical,
    });
  }, [productOverrides, saveProductOverrideMutation]);

  // Start editing a product
  const startEditing = useCallback((product: ProductOverride) => {
    setEditingProduct(product.product_id);
    productOverrides.set(product.product_id, {
      low: product.low_stock_threshold,
      critical: product.critical_stock_threshold,
    });
    setProductOverrides(new Map(productOverrides));
  }, [productOverrides]);

  // Cancel editing
  const cancelEditing = useCallback(() => {
    if (editingProduct) {
      productOverrides.delete(editingProduct);
      setProductOverrides(new Map(productOverrides));
    }
    setEditingProduct(null);
  }, [editingProduct, productOverrides]);

  // Update product override values
  const updateProductOverride = useCallback((productId: string, field: 'low' | 'critical', value: number) => {
    const current = productOverrides.get(productId) ?? { low: 10, critical: 5 };
    current[field] = value;
    productOverrides.set(productId, current);
    setProductOverrides(new Map(productOverrides));
  }, [productOverrides]);

  // Get stock status badge
  const getStockStatusBadge = useCallback((product: ProductOverride) => {
    const stock = product.current_stock;
    if (stock <= product.critical_stock_threshold) {
      return <Badge variant="destructive">Critical</Badge>;
    }
    if (stock <= product.low_stock_threshold) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Low</Badge>;
    }
    return <Badge variant="outline">OK</Badge>;
  }, []);

  // Loading state
  if (isLoadingSettings || isLoadingProducts) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (settingsError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Inventory Alerts Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load settings. Please refresh the page or try again later.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Inventory Alert Settings
          </CardTitle>
          <CardDescription>
            Configure global thresholds for inventory alerts. These defaults apply to all products
            unless overridden at the product level.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Global Enable Toggle */}
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable Inventory Alerts</FormLabel>
                      <FormDescription>
                        When enabled, you'll receive notifications when products fall below
                        threshold levels.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <Separator />

              {/* Threshold Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Low Stock Threshold */}
                <FormField
                  control={form.control}
                  name="low_stock_threshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        Low Stock Threshold
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Alert when stock falls to or below this level
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Critical Stock Threshold */}
                <FormField
                  control={form.control}
                  name="critical_stock_threshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-500" />
                        Critical Stock Threshold
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Urgent alert when stock falls to or below this level
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Notification Channels */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Notification Channels</Label>

                <FormField
                  control={form.control}
                  name="notification_inapp"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="flex items-center gap-3">
                        <Bell className="h-5 w-5 text-muted-foreground" />
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">In-App Notifications</FormLabel>
                          <FormDescription>
                            Show alerts in the dashboard and notification center
                          </FormDescription>
                        </div>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notification_email"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Email Notifications</FormLabel>
                          <FormDescription>
                            Send email alerts to team members
                          </FormDescription>
                        </div>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Recheck Frequency */}
              <FormField
                control={form.control}
                name="recheck_frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Recheck Frequency
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full md:w-[280px]">
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {RECHECK_FREQUENCIES.map((freq) => (
                          <SelectItem key={freq.value} value={freq.value}>
                            {freq.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      How often to check inventory levels against thresholds
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Save Button */}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => form.reset()}
                  disabled={isSaving}
                >
                  Reset
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
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
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Per-Product Overrides Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Product-Specific Thresholds
          </CardTitle>
          <CardDescription>
            Override the global thresholds for individual products. Products not listed here
            use the global defaults.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Products with overrides */}
          {productsWithOverrides.length > 0 && (
            <div className="mb-4">
              <Label className="text-sm font-medium mb-2 block">Products with Custom Thresholds</Label>
              <div className="flex flex-wrap gap-2">
                {productsWithOverrides.map((product) => (
                  <Badge key={product.product_id} variant="secondary" className="gap-2">
                    <Package className="h-3 w-3" />
                    {product.product_name}
                    <span className="text-muted-foreground">
                      (Low: {product.low_stock_threshold}, Critical: {product.critical_stock_threshold})
                    </span>
                    <button
                      type="button"
                      onClick={() => resetProductMutation.mutate(product.product_id)}
                      className="ml-1 hover:bg-muted rounded-full p-0.5"
                      title="Reset to global defaults"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products by name or SKU..."
              aria-label="Search products by name or SKU"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Products Table */}
          {filteredProducts.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No products match your search.' : 'No products found.'}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-center">Current Stock</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Low Threshold</TableHead>
                    <TableHead className="text-center">Critical Threshold</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => {
                    const isEditing = editingProduct === product.product_id;
                    const override = productOverrides.get(product.product_id);

                    return (
                      <TableRow key={product.product_id}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{product.product_name}</span>
                            {product.sku && (
                              <span className="text-xs text-muted-foreground block">
                                {product.sku}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono">
                          {product.current_stock}
                        </TableCell>
                        <TableCell className="text-center">
                          {getStockStatusBadge(product)}
                        </TableCell>
                        <TableCell className="text-center">
                          {isEditing ? (
                            <Input
                              type="number"
                              min="0"
                              className="w-20 text-center mx-auto"
                              value={override?.low ?? product.low_stock_threshold}
                              onChange={(e) => updateProductOverride(
                                product.product_id,
                                'low',
                                parseInt(e.target.value, 10) || 0
                              )}
                            />
                          ) : (
                            <span className="font-mono">{product.low_stock_threshold}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {isEditing ? (
                            <Input
                              type="number"
                              min="0"
                              className="w-20 text-center mx-auto"
                              value={override?.critical ?? product.critical_stock_threshold}
                              onChange={(e) => updateProductOverride(
                                product.product_id,
                                'critical',
                                parseInt(e.target.value, 10) || 0
                              )}
                            />
                          ) : (
                            <span className="font-mono">{product.critical_stock_threshold}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={cancelEditing}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleSaveProductOverride(product)}
                                disabled={saveProductOverrideMutation.isPending}
                              >
                                {saveProductOverrideMutation.isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  'Save'
                                )}
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEditing(product)}
                            >
                              Edit
                            </Button>
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

export default InventoryAlerts;
