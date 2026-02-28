/**
 * ProductVariants Component
 *
 * Comprehensive product variant management system.
 * Each variant has its own SKU, price, and stock level.
 * Variants share parent product's vendor, category, and compliance data.
 *
 * Features:
 * - Manage variants (size, strain, weight)
 * - Variant-specific SKU, pricing, and inventory
 * - Bulk preset creation
 * - Integration with order creation and storefront
 */

import { useState, useCallback, useMemo } from 'react';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import Edit2 from 'lucide-react/dist/esm/icons/edit-2';
import GripVertical from 'lucide-react/dist/esm/icons/grip-vertical';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import Scale from 'lucide-react/dist/esm/icons/scale';
import Ruler from 'lucide-react/dist/esm/icons/ruler';
import Leaf from 'lucide-react/dist/esm/icons/leaf';
import Package from 'lucide-react/dist/esm/icons/package';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import Copy from 'lucide-react/dist/esm/icons/copy';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';

import {
  useProductVariants,
  useCreateVariant,
  useUpdateVariant,
  useDeleteVariant,
  useBulkCreateVariants,
  PRESET_WEIGHTS,
  PRESET_SIZES,
  type ProductVariant,
  type VariantType,
  type CreateVariantInput,
} from '@/hooks/useProductVariants';
import { logger } from '@/lib/logger';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cn } from '@/lib/utils';

// ============================================================================
// Types & Interfaces
// ============================================================================

interface ProductVariantsProps {
  productId: string;
  productName?: string;
  readOnly?: boolean;
  compact?: boolean;
  onVariantSelect?: (variant: ProductVariant) => void;
}

interface VariantFormData {
  name: string;
  variant_type: VariantType;
  sku: string;
  price: string;
  cost_per_unit: string;
  wholesale_price: string;
  retail_price: string;
  available_quantity: string;
  low_stock_alert: string;
  thc_percent: string;
  cbd_percent: string;
  strain_type: 'indica' | 'sativa' | 'hybrid' | 'cbd' | '';
  weight_grams: string;
  is_active: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_FORM_DATA: VariantFormData = {
  name: '',
  variant_type: 'weight',
  sku: '',
  price: '',
  cost_per_unit: '',
  wholesale_price: '',
  retail_price: '',
  available_quantity: '0',
  low_stock_alert: '10',
  thc_percent: '',
  cbd_percent: '',
  strain_type: '',
  weight_grams: '',
  is_active: true,
};

const VARIANT_TYPE_CONFIG: Record<VariantType, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  description: string;
}> = {
  weight: {
    icon: Scale,
    label: 'Weight',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    description: 'Weight-based options (1g, 1/8 oz, etc.)',
  },
  size: {
    icon: Ruler,
    label: 'Size',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    description: 'Size options (Small, Medium, Large)',
  },
  strain: {
    icon: Leaf,
    label: 'Strain',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    description: 'Strain variants with THC/CBD info',
  },
};

// ============================================================================
// Main Component
// ============================================================================

export function ProductVariants({
  productId,
  productName: _productName,
  readOnly = false,
  compact = false,
  onVariantSelect,
}: ProductVariantsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [formData, setFormData] = useState<VariantFormData>(DEFAULT_FORM_DATA);
  const [deleteVariant, setDeleteVariant] = useState<ProductVariant | null>(null);

  // Query hooks
  const { data: variants, isLoading, error } = useProductVariants(productId);
  const createVariant = useCreateVariant();
  const updateVariant = useUpdateVariant();
  const deleteVariantMutation = useDeleteVariant();
  const bulkCreateVariants = useBulkCreateVariants();

  const isMutating =
    createVariant.isPending ||
    updateVariant.isPending ||
    deleteVariantMutation.isPending ||
    bulkCreateVariants.isPending;

  // ============================================================================
  // Computed Values
  // ============================================================================

  const _groupedVariants = useMemo(() => ({
    weight: variants?.filter((v) => v.variant_type === 'weight') ?? [],
    size: variants?.filter((v) => v.variant_type === 'size') ?? [],
    strain: variants?.filter((v) => v.variant_type === 'strain') ?? [],
  }), [variants]);

  const totalStock = useMemo(() =>
    variants?.reduce((sum, v) => sum + (v.available_quantity ?? 0), 0) ?? 0,
  [variants]);

  const lowStockVariants = useMemo(() =>
    variants?.filter((v) => v.available_quantity <= v.low_stock_alert) ?? [],
  [variants]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const openCreateDialog = useCallback((type: VariantType) => {
    setEditingVariant(null);
    setFormData({ ...DEFAULT_FORM_DATA, variant_type: type });
    setIsDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((variant: ProductVariant) => {
    setEditingVariant(variant);
    setFormData({
      name: variant.name,
      variant_type: variant.variant_type,
      sku: variant.sku ?? '',
      price: variant.price?.toString() ?? '',
      cost_per_unit: variant.cost_per_unit?.toString() ?? '',
      wholesale_price: variant.wholesale_price?.toString() ?? '',
      retail_price: variant.retail_price?.toString() ?? '',
      available_quantity: variant.available_quantity?.toString() || '0',
      low_stock_alert: variant.low_stock_alert?.toString() || '10',
      thc_percent: variant.thc_percent?.toString() ?? '',
      cbd_percent: variant.cbd_percent?.toString() ?? '',
      strain_type: variant.strain_type ?? '',
      weight_grams: variant.weight_grams?.toString() ?? '',
      is_active: variant.is_active,
    });
    setIsDialogOpen(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!formData.name.trim()) {
      toast.error('Variant name is required');
      return;
    }

    const variantData: CreateVariantInput = {
      product_id: productId,
      name: formData.name.trim(),
      variant_type: formData.variant_type,
      sku: formData.sku.trim() || undefined,
      price: formData.price ? parseFloat(formData.price) : undefined,
      cost_per_unit: formData.cost_per_unit ? parseFloat(formData.cost_per_unit) : undefined,
      wholesale_price: formData.wholesale_price ? parseFloat(formData.wholesale_price) : undefined,
      retail_price: formData.retail_price ? parseFloat(formData.retail_price) : undefined,
      available_quantity: formData.available_quantity ? parseInt(formData.available_quantity) : 0,
      low_stock_alert: formData.low_stock_alert ? parseInt(formData.low_stock_alert) : 10,
      is_active: formData.is_active,
    };

    // Add type-specific fields
    if (formData.variant_type === 'weight' && formData.weight_grams) {
      variantData.weight_grams = parseFloat(formData.weight_grams);
    }

    if (formData.variant_type === 'strain') {
      if (formData.thc_percent) variantData.thc_percent = parseFloat(formData.thc_percent);
      if (formData.cbd_percent) variantData.cbd_percent = parseFloat(formData.cbd_percent);
      if (formData.strain_type) variantData.strain_type = formData.strain_type as 'indica' | 'sativa' | 'hybrid' | 'cbd';
    }

    try {
      if (editingVariant) {
        await updateVariant.mutateAsync({ id: editingVariant.id, ...variantData });
        logger.info('Variant updated', { variantId: editingVariant.id, productId });
      } else {
        await createVariant.mutateAsync(variantData);
        logger.info('Variant created', { productId, variantType: formData.variant_type });
      }
      setIsDialogOpen(false);
      setEditingVariant(null);
      setFormData(DEFAULT_FORM_DATA);
    } catch (err) {
      logger.error('Failed to save variant', { error: err, productId });
    }
  }, [formData, productId, editingVariant, createVariant, updateVariant]);

  const handleDelete = useCallback(async () => {
    if (!deleteVariant) return;

    try {
      await deleteVariantMutation.mutateAsync({ id: deleteVariant.id, productId });
      logger.info('Variant deleted', { variantId: deleteVariant.id, productId });
      setDeleteVariant(null);
    } catch (err) {
      logger.error('Failed to delete variant', { error: err, variantId: deleteVariant.id });
    }
  }, [deleteVariant, deleteVariantMutation, productId]);

  const handleAddPresetWeights = useCallback(async () => {
    const existingNames = new Set(variants?.map((v) => v.name) ?? []);
    const newWeights = PRESET_WEIGHTS.filter((w) => !existingNames.has(w.name));

    if (newWeights.length === 0) {
      toast.info('All preset weights already exist');
      return;
    }

    try {
      await bulkCreateVariants.mutateAsync({
        productId,
        variants: newWeights.map((w) => ({
          name: w.name,
          variant_type: 'weight' as VariantType,
          weight_grams: w.weight_grams,
          display_order: w.display_order,
        })),
      });
      logger.info('Preset weights added', { productId, count: newWeights.length });
    } catch (err) {
      logger.error('Failed to add preset weights', { error: err, productId });
    }
  }, [variants, productId, bulkCreateVariants]);

  const handleAddPresetSizes = useCallback(async () => {
    const existingNames = new Set(variants?.map((v) => v.name) ?? []);
    const newSizes = PRESET_SIZES.filter((s) => !existingNames.has(s.name));

    if (newSizes.length === 0) {
      toast.info('All preset sizes already exist');
      return;
    }

    try {
      await bulkCreateVariants.mutateAsync({
        productId,
        variants: newSizes.map((s) => ({
          name: s.name,
          variant_type: 'size' as VariantType,
          display_order: s.display_order,
        })),
      });
      logger.info('Preset sizes added', { productId, count: newSizes.length });
    } catch (err) {
      logger.error('Failed to add preset sizes', { error: err, productId });
    }
  }, [variants, productId, bulkCreateVariants]);

  const handleDuplicateVariant = useCallback(async (variant: ProductVariant) => {
    const variantData: CreateVariantInput = {
      product_id: productId,
      name: `${variant.name} (Copy)`,
      variant_type: variant.variant_type,
      sku: variant.sku ? `${variant.sku}-COPY` : undefined,
      price: variant.price ?? undefined,
      cost_per_unit: variant.cost_per_unit ?? undefined,
      wholesale_price: variant.wholesale_price ?? undefined,
      retail_price: variant.retail_price ?? undefined,
      available_quantity: 0, // Don't copy inventory
      low_stock_alert: variant.low_stock_alert,
      is_active: true,
      weight_grams: variant.weight_grams ?? undefined,
      thc_percent: variant.thc_percent ?? undefined,
      cbd_percent: variant.cbd_percent ?? undefined,
      strain_type: variant.strain_type ?? undefined,
    };

    try {
      await createVariant.mutateAsync(variantData);
      logger.info('Variant duplicated', { sourceVariantId: variant.id, productId });
      toast.success('Variant duplicated');
    } catch (err) {
      logger.error('Failed to duplicate variant', { error: err, variantId: variant.id });
    }
  }, [productId, createVariant]);

  // ============================================================================
  // Loading State
  // ============================================================================

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Product Variants</CardTitle>
          <CardDescription>Loading variant options...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  // ============================================================================
  // Error State
  // ============================================================================

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <p>Failed to load variants</p>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Please try refreshing the page.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ============================================================================
  // Compact View (for selectors)
  // ============================================================================

  if (compact) {
    return (
      <div className="space-y-2">
        {variants && variants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No variants available</p>
        ) : (
          variants?.map((variant) => (
            <button
              key={variant.id}
              onClick={() => onVariantSelect?.(variant)}
              disabled={!variant.is_active || variant.available_quantity <= 0}
              className={cn(
                'w-full p-3 rounded-lg border text-left transition-colors',
                'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                !variant.is_active && 'opacity-50 cursor-not-allowed',
                variant.available_quantity <= 0 && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{variant.name}</span>
                  {variant.sku && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      SKU: {variant.sku}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {variant.wholesale_price && (
                    <span className="font-medium">
                      {formatCurrency(variant.wholesale_price)}
                    </span>
                  )}
                  <Badge
                    variant={variant.available_quantity > 0 ? 'secondary' : 'destructive'}
                    className="text-xs"
                  >
                    {variant.available_quantity} in stock
                  </Badge>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    );
  }

  // ============================================================================
  // Full View
  // ============================================================================

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Product Variants</CardTitle>
            <CardDescription>
              {variants?.length ?? 0} variants · {totalStock} total units
              {lowStockVariants.length > 0 && (
                <span className="text-amber-600 ml-2">
                  · {lowStockVariants.length} low stock
                </span>
              )}
            </CardDescription>
          </div>
          {!readOnly && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" disabled={isMutating}>
                  {isMutating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Plus className="h-4 w-4 mr-1" />
                  )}
                  Add Variant
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => openCreateDialog('weight')}>
                  <Scale className="h-4 w-4 mr-2" />
                  Weight Option
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openCreateDialog('size')}>
                  <Ruler className="h-4 w-4 mr-2" />
                  Size Option
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openCreateDialog('strain')}>
                  <Leaf className="h-4 w-4 mr-2" />
                  Strain Option
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleAddPresetWeights} disabled={isMutating}>
                  <Scale className="h-4 w-4 mr-2" />
                  Add All Preset Weights
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleAddPresetSizes} disabled={isMutating}>
                  <Ruler className="h-4 w-4 mr-2" />
                  Add All Preset Sizes
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {variants && variants.length === 0 ? (
          <div className="text-center py-8 border border-dashed rounded-lg">
            <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              No variants yet. Add size, weight, or strain options.
            </p>
            {!readOnly && (
              <div className="flex justify-center gap-2">
                <Button variant="outline" size="sm" onClick={() => openCreateDialog('weight')}>
                  <Scale className="h-4 w-4 mr-1" />
                  Add Weight
                </Button>
                <Button variant="outline" size="sm" onClick={() => openCreateDialog('size')}>
                  <Ruler className="h-4 w-4 mr-1" />
                  Add Size
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {!readOnly && <TableHead className="w-10"></TableHead>}
                  <TableHead>Variant</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Status</TableHead>
                  {!readOnly && <TableHead className="w-20"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {variants?.map((variant) => {
                  const typeConfig = VARIANT_TYPE_CONFIG[variant.variant_type];
                  const TypeIcon = typeConfig.icon;
                  const isLowStock = variant.available_quantity <= variant.low_stock_alert;

                  return (
                    <TableRow
                      key={variant.id}
                      className={cn(!variant.is_active && 'opacity-50')}
                    >
                      {!readOnly && (
                        <TableCell>
                          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{variant.name}</span>
                          {variant.variant_type === 'weight' && variant.weight_grams && (
                            <span className="text-xs text-muted-foreground">
                              {variant.weight_grams}g
                            </span>
                          )}
                          {variant.variant_type === 'strain' && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {variant.strain_type && (
                                <Badge variant="outline" className="text-xs capitalize">
                                  {variant.strain_type}
                                </Badge>
                              )}
                              {variant.thc_percent && <span>THC: {variant.thc_percent}%</span>}
                              {variant.cbd_percent && <span>CBD: {variant.cbd_percent}%</span>}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('text-xs', typeConfig.color)}>
                          <TypeIcon className="h-3 w-3 mr-1" />
                          {typeConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground font-mono">
                          {variant.sku || '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          {variant.wholesale_price && (
                            <span className="font-medium">
                              {formatCurrency(variant.wholesale_price)}
                            </span>
                          )}
                          {variant.retail_price && variant.retail_price !== variant.wholesale_price && (
                            <span className="text-xs text-muted-foreground">
                              Retail: {formatCurrency(variant.retail_price)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={cn(
                                'flex items-center justify-end gap-1',
                                isLowStock && 'text-amber-600',
                                variant.available_quantity === 0 && 'text-destructive'
                              )}>
                                <Package className="h-3.5 w-3.5" />
                                <span className="font-medium">{variant.available_quantity}</span>
                                {isLowStock && variant.available_quantity > 0 && (
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {variant.available_quantity === 0
                                  ? 'Out of stock'
                                  : isLowStock
                                  ? `Low stock (alert at ${variant.low_stock_alert})`
                                  : `${variant.available_quantity} units available`}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <Badge variant={variant.is_active ? 'default' : 'secondary'}>
                          {variant.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      {!readOnly && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" disabled={isMutating} aria-label="Edit variant">
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(variant)}>
                                <Edit2 className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDuplicateVariant(variant)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteVariant(variant)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Add/Edit Variant Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingVariant ? 'Edit Variant' : 'Add Variant'}
            </DialogTitle>
            <DialogDescription>
              {VARIANT_TYPE_CONFIG[formData.variant_type].description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {/* Variant Type */}
            <div className="space-y-2">
              <Label>Variant Type</Label>
              <Select
                value={formData.variant_type}
                onValueChange={(value) =>
                  setFormData({ ...formData, variant_type: value as VariantType })
                }
                disabled={!!editingVariant}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select variant type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(VARIANT_TYPE_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <config.icon className="h-4 w-4" />
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={
                  formData.variant_type === 'weight'
                    ? 'e.g., 1/8 oz'
                    : formData.variant_type === 'size'
                    ? 'e.g., Large'
                    : 'e.g., Blue Dream'
                }
              />
            </div>

            {/* Weight-specific fields */}
            {formData.variant_type === 'weight' && (
              <div className="space-y-2">
                <Label>Weight (grams)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.weight_grams}
                  onChange={(e) => setFormData({ ...formData, weight_grams: e.target.value })}
                  placeholder="e.g., 3.5"
                />
              </div>
            )}

            {/* Strain-specific fields */}
            {formData.variant_type === 'strain' && (
              <>
                <div className="space-y-2">
                  <Label>Strain Type</Label>
                  <Select
                    value={formData.strain_type}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        strain_type: value as 'indica' | 'sativa' | 'hybrid' | 'cbd' | '',
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="indica">Indica</SelectItem>
                      <SelectItem value="sativa">Sativa</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                      <SelectItem value="cbd">CBD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>THC %</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.thc_percent}
                      onChange={(e) => setFormData({ ...formData, thc_percent: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CBD %</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.cbd_percent}
                      onChange={(e) => setFormData({ ...formData, cbd_percent: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}

            {/* SKU */}
            <div className="space-y-2">
              <Label>SKU (optional)</Label>
              <Input
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="Variant-specific SKU"
                className="font-mono"
              />
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Wholesale Price</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    className="pl-7"
                    value={formData.wholesale_price}
                    onChange={(e) => setFormData({ ...formData, wholesale_price: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Retail Price</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    className="pl-7"
                    value={formData.retail_price}
                    onChange={(e) => setFormData({ ...formData, retail_price: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cost Per Unit</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    className="pl-7"
                    value={formData.cost_per_unit}
                    onChange={(e) => setFormData({ ...formData, cost_per_unit: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Inventory */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Stock Quantity</Label>
                <Input
                  type="number"
                  value={formData.available_quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, available_quantity: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Low Stock Alert</Label>
                <Input
                  type="number"
                  value={formData.low_stock_alert}
                  onChange={(e) => setFormData({ ...formData, low_stock_alert: e.target.value })}
                />
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between py-2">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive variants won't appear in orders or storefront
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isMutating}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isMutating}>
              {isMutating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : editingVariant ? (
                'Update Variant'
              ) : (
                'Create Variant'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={!!deleteVariant}
        onOpenChange={() => setDeleteVariant(null)}
        onConfirm={handleDelete}
        title="Delete Variant"
        description={`Are you sure you want to delete "${deleteVariant?.name}"? This action cannot be undone.${deleteVariant && deleteVariant.available_quantity > 0 ? ` Warning: This variant has ${deleteVariant.available_quantity} units in stock.` : ''}`}
        itemName={deleteVariant?.name}
        itemType="variant"
        isLoading={deleteVariantMutation.isPending}
      />
    </Card>
  );
}

export default ProductVariants;
