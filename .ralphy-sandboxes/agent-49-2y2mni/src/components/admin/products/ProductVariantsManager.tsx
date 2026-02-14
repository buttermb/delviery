/**
 * ProductVariantsManager Component
 *
 * Manages product variants for size, weight, and strain options.
 * Provides:
 * - Add/edit/delete variants
 * - Quick presets for common weight options
 * - Drag-to-reorder functionality
 * - Variant-specific pricing and inventory
 */

import { useState } from 'react';
import Plus from "lucide-react/dist/esm/icons/plus";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import GripVertical from "lucide-react/dist/esm/icons/grip-vertical";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Scale from "lucide-react/dist/esm/icons/scale";
import Ruler from "lucide-react/dist/esm/icons/ruler";
import Leaf from "lucide-react/dist/esm/icons/leaf";
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
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

interface ProductVariantsManagerProps {
  productId: string;
  readOnly?: boolean;
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

const VARIANT_TYPE_CONFIG = {
  weight: { icon: Scale, label: 'Weight', color: 'bg-blue-100 text-blue-800' },
  size: { icon: Ruler, label: 'Size', color: 'bg-green-100 text-green-800' },
  strain: { icon: Leaf, label: 'Strain', color: 'bg-purple-100 text-purple-800' },
};

export function ProductVariantsManager({
  productId,
  readOnly = false,
}: ProductVariantsManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [formData, setFormData] = useState<VariantFormData>(DEFAULT_FORM_DATA);

  const { data: variants, isLoading, error } = useProductVariants(productId);
  const createVariant = useCreateVariant();
  const updateVariant = useUpdateVariant();
  const deleteVariant = useDeleteVariant();
  const bulkCreateVariants = useBulkCreateVariants();

  const isMutating =
    createVariant.isPending ||
    updateVariant.isPending ||
    deleteVariant.isPending ||
    bulkCreateVariants.isPending;

  const openCreateDialog = (type: VariantType) => {
    setEditingVariant(null);
    setFormData({ ...DEFAULT_FORM_DATA, variant_type: type });
    setIsDialogOpen(true);
  };

  const openEditDialog = (variant: ProductVariant) => {
    setEditingVariant(variant);
    setFormData({
      name: variant.name,
      variant_type: variant.variant_type,
      sku: variant.sku || '',
      price: variant.price?.toString() || '',
      cost_per_unit: variant.cost_per_unit?.toString() || '',
      wholesale_price: variant.wholesale_price?.toString() || '',
      retail_price: variant.retail_price?.toString() || '',
      available_quantity: variant.available_quantity?.toString() || '0',
      low_stock_alert: variant.low_stock_alert?.toString() || '10',
      thc_percent: variant.thc_percent?.toString() || '',
      cbd_percent: variant.cbd_percent?.toString() || '',
      strain_type: variant.strain_type || '',
      weight_grams: variant.weight_grams?.toString() || '',
      is_active: variant.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
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
      } else {
        await createVariant.mutateAsync(variantData);
      }
      setIsDialogOpen(false);
      setEditingVariant(null);
      setFormData(DEFAULT_FORM_DATA);
    } catch {
      // Error handling done in hook
    }
  };

  const handleDelete = async (variant: ProductVariant) => {
    if (!confirm(`Delete variant "${variant.name}"?`)) return;

    try {
      await deleteVariant.mutateAsync({ id: variant.id, productId });
    } catch {
      // Error handling done in hook
    }
  };

  const handleAddPresetWeights = async () => {
    const existingNames = new Set(variants?.map((v) => v.name) || []);
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
    } catch {
      // Error handling done in hook
    }
  };

  const handleAddPresetSizes = async () => {
    const existingNames = new Set(variants?.map((v) => v.name) || []);
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
    } catch {
      // Error handling done in hook
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Product Variants</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-destructive">Failed to load variants</p>
        </CardContent>
      </Card>
    );
  }

  const groupedVariants = {
    weight: variants?.filter((v) => v.variant_type === 'weight') || [],
    size: variants?.filter((v) => v.variant_type === 'size') || [],
    strain: variants?.filter((v) => v.variant_type === 'strain') || [],
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Product Variants</CardTitle>
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
              <DropdownMenuContent align="end">
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
                <DropdownMenuItem onClick={handleAddPresetWeights} disabled={isMutating}>
                  <Scale className="h-4 w-4 mr-2" />
                  Add Preset Weights (1g, 1/8, 1/4...)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleAddPresetSizes} disabled={isMutating}>
                  <Ruler className="h-4 w-4 mr-2" />
                  Add Preset Sizes (S, M, L)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {variants && variants.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No variants yet. Add size, weight, or strain options.
          </p>
        ) : (
          <>
            {/* Weight Variants */}
            {groupedVariants.weight.length > 0 && (
              <VariantGroup
                title="Weight Options"
                variants={groupedVariants.weight}
                type="weight"
                onEdit={openEditDialog}
                onDelete={handleDelete}
                readOnly={readOnly}
                isMutating={isMutating}
              />
            )}

            {/* Size Variants */}
            {groupedVariants.size.length > 0 && (
              <VariantGroup
                title="Size Options"
                variants={groupedVariants.size}
                type="size"
                onEdit={openEditDialog}
                onDelete={handleDelete}
                readOnly={readOnly}
                isMutating={isMutating}
              />
            )}

            {/* Strain Variants */}
            {groupedVariants.strain.length > 0 && (
              <VariantGroup
                title="Strain Options"
                variants={groupedVariants.strain}
                type="strain"
                onEdit={openEditDialog}
                onDelete={handleDelete}
                readOnly={readOnly}
                isMutating={isMutating}
              />
            )}
          </>
        )}
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingVariant ? 'Edit Variant' : 'Add Variant'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
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
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weight">Weight</SelectItem>
                  <SelectItem value="size">Size</SelectItem>
                  <SelectItem value="strain">Strain</SelectItem>
                </SelectContent>
              </Select>
            </div>

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

            <div className="space-y-2">
              <Label>SKU (optional)</Label>
              <Input
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="Variant-specific SKU"
              />
            </div>

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

            <div className="flex items-center justify-between">
              <Label>Active</Label>
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
                'Update'
              ) : (
                'Create'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// Sub-component for grouped variants
interface VariantGroupProps {
  title: string;
  variants: ProductVariant[];
  type: VariantType;
  onEdit: (variant: ProductVariant) => void;
  onDelete: (variant: ProductVariant) => void;
  readOnly: boolean;
  isMutating: boolean;
}

function VariantGroup({
  title,
  variants,
  type,
  onEdit,
  onDelete,
  readOnly,
  isMutating,
}: VariantGroupProps) {
  const config = VARIANT_TYPE_CONFIG[type];
  const Icon = config.icon;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <div className="space-y-2">
        {variants.map((variant) => (
          <div
            key={variant.id}
            className={`flex items-center justify-between p-3 rounded-lg border ${
              !variant.is_active ? 'opacity-50' : ''
            } hover:bg-muted/50 transition-colors`}
          >
            <div className="flex items-center gap-3">
              {!readOnly && (
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{variant.name}</span>
                  {!variant.is_active && (
                    <Badge variant="secondary" className="text-xs">
                      Inactive
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {variant.wholesale_price && (
                    <span>${variant.wholesale_price}</span>
                  )}
                  {variant.weight_grams && <span>{variant.weight_grams}g</span>}
                  {variant.strain_type && (
                    <Badge variant="outline" className="text-xs capitalize">
                      {variant.strain_type}
                    </Badge>
                  )}
                  {variant.thc_percent && <span>THC: {variant.thc_percent}%</span>}
                  {variant.sku && <span className="text-xs">SKU: {variant.sku}</span>}
                </div>
              </div>
            </div>

            {!readOnly && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(variant)}
                  disabled={isMutating}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(variant)}
                  disabled={isMutating}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
