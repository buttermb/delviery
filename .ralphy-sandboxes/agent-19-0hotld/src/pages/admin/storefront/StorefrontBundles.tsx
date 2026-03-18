/**
 * Storefront Bundles Page
 * Create and manage product bundles with discounts
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SaveButton } from '@/components/ui/SaveButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { toast } from 'sonner';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import {
  Plus,
  Package,
  Percent,
  DollarSign,
  Trash2,
  Edit,
  Gift,
  X
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { queryKeys } from '@/lib/queryKeys';

interface Bundle {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  products: { product_id: string; quantity: number }[];
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
}

export default function StorefrontBundles() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingBundle, setEditingBundle] = useState<Bundle | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bundleToDelete, setBundleToDelete] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: 10,
    products: [] as { product_id: string; quantity: number }[],
    is_active: true,
  });

  // Fetch store
  const { data: store } = useQuery({
    queryKey: queryKeys.marketplaceStore.byTenant(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return null;
      const { data, error } = await supabase
        .from('marketplace_stores')
        .select('id, tenant_id, store_name, slug, is_active, is_public, created_at, updated_at')
        .eq('tenant_id', tenant.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });

  // Fetch bundles
  const { data: bundles = [], isLoading: bundlesLoading } = useQuery({
    queryKey: queryKeys.marketplaceBundles.byStore(store?.id),
    queryFn: async () => {
      if (!store?.id) return [];
      const { data, error } = await supabase
        .from('marketplace_bundles' as 'tenants')
        .select('id, name, description, image_url, discount_type, discount_value, products, is_active, start_date, end_date, created_at')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Bundle[];
    },
    enabled: !!store?.id,
  });

  // Fetch products for selection
  const { data: products = [] } = useQuery({
    queryKey: queryKeys.storePages.storeProducts(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, image_url')
        .eq('tenant_id', tenant.id)
        .order('name');
      if (error) throw error;
      return (data ?? []) as Product[];
    },
    enabled: !!tenant?.id,
  });

  // Create bundle mutation
  const createBundleMutation = useMutation({
    mutationFn: async () => {
      if (!store?.id || !tenant?.id) throw new Error('No store');

      const { error } = await supabase
        .from('marketplace_bundles' as 'tenants')
        .insert({
          store_id: store.id,
          tenant_id: tenant.id,
          name: formData.name,
          description: formData.description || null,
          discount_type: formData.discount_type,
          discount_value: formData.discount_value,
          products: formData.products,
          is_active: formData.is_active,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceBundles.all });
      setShowCreateDialog(false);
      resetForm();
      toast.success("Bundle created!");
    },
    onError: (error) => {
      logger.error('Failed to create bundle', error, { component: 'StorefrontBundles' });
      toast.error("Failed to create bundle", { description: humanizeError(error) });
    },
  });

  // Update bundle mutation
  const updateBundleMutation = useMutation({
    mutationFn: async (bundle: Bundle) => {
      if (!store?.id) throw new Error('No store');
      const { error } = await supabase
        .from('marketplace_bundles' as 'tenants')
        .update({
          name: formData.name,
          description: formData.description || null,
          discount_type: formData.discount_type,
          discount_value: formData.discount_value,
          products: formData.products,
          is_active: formData.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bundle.id)
        .eq('store_id', store.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceBundles.all });
      setEditingBundle(null);
      resetForm();
      toast.success("Bundle updated!");
    },
    onError: (error) => {
      logger.error('Failed to update bundle', error, { component: 'StorefrontBundles' });
      toast.error("Failed to update bundle", { description: humanizeError(error) });
    },
  });

  // Toggle bundle status
  const toggleBundleMutation = useMutation({
    mutationFn: async ({ bundleId, isActive }: { bundleId: string; isActive: boolean }) => {
      if (!store?.id) throw new Error('No store');
      const { error } = await supabase
        .from('marketplace_bundles' as 'tenants')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', bundleId)
        .eq('store_id', store.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceBundles.all });
    },
    onError: (error: Error) => {
      logger.error('Failed to toggle bundle status', { error });
      toast.error("Failed to update bundle", { description: humanizeError(error) });
    },
  });

  // Delete bundle
  const deleteBundleMutation = useMutation({
    mutationFn: async (bundleId: string) => {
      if (!store?.id) throw new Error('No store');
      const { error } = await supabase
        .from('marketplace_bundles' as 'tenants')
        .delete()
        .eq('id', bundleId)
        .eq('store_id', store.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceBundles.all });
      toast.success("Bundle deleted");
    },
    onError: (error: Error) => {
      logger.error('Failed to delete bundle', { error });
      toast.error("Failed to delete bundle", { description: humanizeError(error) });
    },
  });

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      discount_type: 'percentage',
      discount_value: 10,
      products: [],
      is_active: true,
    });
  };

  // Open edit dialog
  const openEditDialog = (bundle: Bundle) => {
    setFormData({
      name: bundle.name,
      description: bundle.description ?? '',
      discount_type: bundle.discount_type,
      discount_value: bundle.discount_value,
      products: bundle.products,
      is_active: bundle.is_active,
    });
    setEditingBundle(bundle);
  };

  // Add product to bundle
  const addProduct = (productId: string) => {
    if (formData.products.some((p) => p.product_id === productId)) return;
    setFormData((prev) => ({
      ...prev,
      products: [...prev.products, { product_id: productId, quantity: 1 }],
    }));
  };

  // Update product quantity
  const updateProductQuantity = (productId: string, quantity: number) => {
    setFormData((prev) => ({
      ...prev,
      products: prev.products.map((p) =>
        p.product_id === productId ? { ...p, quantity: Math.max(1, quantity) } : p
      ),
    }));
  };

  // Remove product from bundle
  const removeProduct = (productId: string) => {
    setFormData((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.product_id !== productId),
    }));
  };

  // Calculate bundle price
  const calculateBundlePrice = () => {
    const regularPrice = formData.products.reduce((sum, bp) => {
      const product = products.find((p) => p.id === bp.product_id);
      return sum + (product?.price ?? 0) * bp.quantity;
    }, 0);

    if (formData.discount_type === 'percentage') {
      return regularPrice * (1 - formData.discount_value / 100);
    }
    return Math.max(0, regularPrice - formData.discount_value);
  };

  const regularPrice = formData.products.reduce((sum, bp) => {
    const product = products.find((p) => p.id === bp.product_id);
    return sum + (product?.price ?? 0) * bp.quantity;
  }, 0);

  const bundlePrice = calculateBundlePrice();
  const savings = regularPrice - bundlePrice;

  if (bundlesLoading) {
    return (
      <div className="container mx-auto p-4">
        <Skeleton className="h-10 w-64 mb-6" />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  const BundleForm = () => (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="bundle-name">Bundle Name *</Label>
          <Input
            id="bundle-name"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Starter Kit, Best Sellers Bundle"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bundle-description">Description</Label>
          <Textarea
            id="bundle-description"
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Describe what's included and why customers should buy this bundle"
            rows={3}
          />
        </div>
      </div>

      {/* Discount Settings */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Discount Type</Label>
          <Select
            value={formData.discount_type}
            onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, discount_type: value as 'percentage' | 'fixed' }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select discount type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">
                <span className="flex items-center gap-2">
                  <Percent className="w-4 h-4" />
                  Percentage Off
                </span>
              </SelectItem>
              <SelectItem value="fixed">
                <span className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Fixed Amount Off
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="discount-value">
            Discount {formData.discount_type === 'percentage' ? '(%)' : '($)'}
          </Label>
          <Input
            id="discount-value"
            type="number"
            min="0"
            max={formData.discount_type === 'percentage' ? 100 : undefined}
            value={formData.discount_value}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, discount_value: Number(e.target.value) }))
            }
          />
        </div>
      </div>

      {/* Products Selection */}
      <div className="space-y-2">
        <Label>Products in Bundle *</Label>
        <Select onValueChange={addProduct}>
          <SelectTrigger>
            <SelectValue placeholder="Add a product..." />
          </SelectTrigger>
          <SelectContent>
            {products
              .filter((p) => !formData.products.some((bp) => bp.product_id === p.id))
              .map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name} - {formatCurrency(product.price)}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        {/* Selected Products */}
        {formData.products.length > 0 && (
          <div className="space-y-2 mt-4">
            {formData.products.map((bp) => {
              const product = products.find((p) => p.id === bp.product_id);
              if (!product) return null;
              return (
                <div
                  key={bp.product_id}
                  className="flex items-center gap-3 p-3 border rounded-lg"
                >
                  <div className="w-12 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(product.price)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Qty:</Label>
                    <Input
                      type="number"
                      min="1"
                      value={bp.quantity}
                      onChange={(e) =>
                        updateProductQuantity(bp.product_id, Number(e.target.value))
                      }
                      className="w-16 h-8"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeProduct(bp.product_id)}
                    aria-label="Remove product from bundle"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Price Preview */}
      {formData.products.length > 0 && (
        <Card className="bg-muted/50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground">Regular Price:</span>
              <span className="line-through">{formatCurrency(regularPrice)}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground">Bundle Price:</span>
              <span className="text-xl font-bold text-green-600">{formatCurrency(bundlePrice)}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="font-medium">Customers Save:</span>
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                {formatCurrency(savings)} ({Math.round((savings / regularPrice) * 100)}% off)
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Active</Label>
          <p className="text-sm text-muted-foreground">Bundle will be visible in store</p>
        </div>
        <Switch
          checked={formData.is_active}
          onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_active: checked }))}
        />
      </div>
    </div>
  );

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Product Bundles</h1>
          <p className="text-muted-foreground">
            Create bundles to offer discounts on multiple products
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Bundle
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Bundle</DialogTitle>
              <DialogDescription>
                Combine products with a discount to increase sales
              </DialogDescription>
            </DialogHeader>
            <BundleForm />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createBundleMutation.mutate()}
                disabled={
                  createBundleMutation.isPending ||
                  !formData.name ||
                  formData.products.length < 2
                }
              >
                {createBundleMutation.isPending ? 'Creating...' : 'Create Bundle'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Bundles List */}
      {bundles.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Gift className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">No Bundles Yet</h2>
            <p className="text-muted-foreground mb-6">
              Create product bundles to offer discounts and increase average order value
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Bundle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bundle</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bundles.map((bundle) => (
                <TableRow key={bundle.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{bundle.name}</p>
                      {bundle.description && (
                        <p className="text-sm text-muted-foreground truncate max-w-xs">
                          {bundle.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{bundle.products.length} products</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge>
                      {bundle.discount_type === 'percentage'
                        ? `${bundle.discount_value}% off`
                        : `$${bundle.discount_value} off`}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={bundle.is_active}
                      onCheckedChange={(checked) =>
                        toggleBundleMutation.mutate({ bundleId: bundle.id, isActive: checked })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatSmartDate(bundle.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(bundle)}
                        aria-label="Edit bundle"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => {
                          setBundleToDelete(bundle.id);
                          setDeleteDialogOpen(true);
                        }}
                        aria-label="Delete bundle"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingBundle} onOpenChange={(open) => !open && setEditingBundle(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Bundle</DialogTitle>
            <DialogDescription>Update bundle settings and products</DialogDescription>
          </DialogHeader>
          <BundleForm />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingBundle(null)}>
              Cancel
            </Button>
            <SaveButton
              onClick={() => editingBundle && updateBundleMutation.mutate(editingBundle)}
              isPending={updateBundleMutation.isPending}
              isSuccess={updateBundleMutation.isSuccess}
              disabled={!formData.name || formData.products.length < 2}
            >
              Save Changes
            </SaveButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (bundleToDelete) {
            deleteBundleMutation.mutate(bundleToDelete);
            setDeleteDialogOpen(false);
            setBundleToDelete(null);
          }
        }}
        itemType="bundle"
        isLoading={deleteBundleMutation.isPending}
      />
    </div>
  );
}


