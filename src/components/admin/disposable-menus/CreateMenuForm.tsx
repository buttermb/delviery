import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Search from "lucide-react/dist/esm/icons/search";
import Package from "lucide-react/dist/esm/icons/package";
import X from "lucide-react/dist/esm/icons/x";
import { sanitizeFormInput, sanitizeTextareaInput } from '@/lib/utils/sanitize';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { useWholesaleInventory } from '@/hooks/useWholesaleData';
import { useCreateDisposableMenu } from '@/hooks/useDisposableMenus';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantLimits } from '@/hooks/useTenantLimits';
import { useFreeTierLimits } from '@/hooks/useFreeTierLimits';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { logger } from '@/lib/logger';

const menuSchema = z.object({
  name: z.string().min(1, 'Menu name is required').max(200),
  description: z.string().max(500).optional().or(z.literal('')),
  selectedProducts: z.array(z.string()).min(1, 'Please select at least one product'),
});

type MenuFormValues = z.infer<typeof menuSchema>;

export interface CreateMenuFormData {
  name: string;
  description: string;
  selectedProducts: string[];
}

interface CreateMenuFormProps {
  onSuccess?: (menuData: { id: string; access_code: string; shareable_url: string }) => void;
  onCancel?: () => void;
  initialData?: Partial<CreateMenuFormData>;
  submitLabel?: string;
  showCancelButton?: boolean;
}

interface InventoryProduct {
  id: string;
  product_name: string;
  category?: string | null;
  price_per_lb?: number;
  quantity_lbs?: number;
  quantity_units?: number;
  image_url?: string | null;
  images?: string[] | null;
}

export function CreateMenuForm({
  onSuccess,
  onCancel,
  initialData,
  submitLabel = 'Create Menu',
  showCancelButton = true,
}: CreateMenuFormProps) {
  const { tenant } = useTenantAdminAuth();
  const { canCreate, getCurrent, getLimit } = useTenantLimits();
  const { checkLimit, recordAction, limitsApply } = useFreeTierLimits();
  const [searchQuery, setSearchQuery] = useState('');

  const form = useForm<MenuFormValues>({
    resolver: zodResolver(menuSchema),
    defaultValues: {
      name: initialData?.name ?? '',
      description: initialData?.description ?? '',
      selectedProducts: initialData?.selectedProducts ?? [],
    },
  });

  const selectedProducts = form.watch('selectedProducts');

  const { data: inventory, isLoading: isLoadingInventory } = useWholesaleInventory(tenant?.id);
  const createMenu = useCreateDisposableMenu();

  const filteredProducts = (inventory as InventoryProduct[] | undefined)?.filter((product) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      product.product_name?.toLowerCase().includes(query) ||
      product.category?.toLowerCase().includes(query)
    );
  }) ?? [];

  const toggleProduct = (productId: string) => {
    const current = form.getValues('selectedProducts');
    if (current.includes(productId)) {
      form.setValue('selectedProducts', current.filter((id) => id !== productId), { shouldValidate: true });
    } else {
      form.setValue('selectedProducts', [...current, productId], { shouldValidate: true });
    }
  };

  const selectAllVisible = () => {
    const visibleIds = filteredProducts.map((p) => p.id);
    const current = form.getValues('selectedProducts');
    const newSet = new Set([...current, ...visibleIds]);
    form.setValue('selectedProducts', Array.from(newSet), { shouldValidate: true });
  };

  const deselectAllVisible = () => {
    const visibleIds = new Set(filteredProducts.map((p) => p.id));
    const current = form.getValues('selectedProducts');
    form.setValue('selectedProducts', current.filter((id) => !visibleIds.has(id)), { shouldValidate: true });
  };

  const clearSelection = () => {
    form.setValue('selectedProducts', [], { shouldValidate: true });
  };

  const generateAccessCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  };

  const onSubmit = async (values: MenuFormValues) => {
    // Check menu limit (subscription limits)
    if (!canCreate('menus')) {
      const current = getCurrent('menus');
      const limit = getLimit('menus');
      toast.error('Menu Limit Reached', {
        description:
          limit === Infinity
            ? 'Unable to create menu. Please contact support.'
            : `You've reached your menu limit (${current}/${limit === Infinity ? '∞' : limit}). Upgrade to Professional for unlimited menus.`,
      });
      return;
    }

    // Check free tier daily limit
    if (limitsApply) {
      const limitCheck = checkLimit('menus_per_day');
      if (!limitCheck.allowed) {
        toast.error('Daily Menu Limit Reached', {
          description: limitCheck.message,
        });
        return;
      }
    }

    try {
      const result = await createMenu.mutateAsync({
        tenant_id: tenant?.id ?? '',
        name: sanitizeFormInput(values.name, 200),
        description: sanitizeTextareaInput(values.description || '', 500),
        product_ids: values.selectedProducts,
        access_code: generateAccessCode(),
        security_settings: {
          access_type: 'invite_only',
          require_access_code: true,
        },
      });

      // Record action for free tier limit tracking
      if (limitsApply) {
        await recordAction('menu');
      }

      toast.success('Menu created successfully!');

      // Reset form
      form.reset({ name: '', description: '', selectedProducts: [] });
      setSearchQuery('');

      // Call success callback
      if (onSuccess && result) {
        onSuccess({
          id: result.id,
          access_code: result.access_code,
          shareable_url: result.shareable_url,
        });
      }
    } catch (error) {
      logger.error('Error creating menu', error, { component: 'CreateMenuForm' });
      toast.error('Failed to create menu', { description: humanizeError(error) });
    }
  };

  const selectedProductsData = (inventory as InventoryProduct[] | undefined)?.filter((p) =>
    selectedProducts.includes(p.id)
  ) ?? [];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Basic Information</h3>

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Menu Name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="VIP Wholesale Menu"
                    maxLength={200}
                  />
                </FormControl>
                <FormDescription>
                  This name is only visible to you, not to customers
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Premium clients, bulk orders only"
                    rows={3}
                    maxLength={500}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Products Selection Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Select Products</h3>
            <Badge variant="secondary">
              {selectedProducts.length} selected
            </Badge>
          </div>

          {/* Search and Bulk Actions */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                aria-label="Search products"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={selectAllVisible}
                disabled={filteredProducts.length === 0}
              >
                Select All
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={deselectAllVisible}
                disabled={selectedProducts.length === 0}
              >
                Deselect All
              </Button>
            </div>
          </div>

          {/* Selected Products Summary */}
          {selectedProducts.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
              {selectedProductsData.slice(0, 5).map((product) => (
                <Badge
                  key={product.id}
                  variant="secondary"
                  className="flex items-center gap-1"
                >
                  {product.product_name}
                  <button
                    type="button"
                    onClick={() => toggleProduct(product.id)}
                    className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {selectedProducts.length > 5 && (
                <Badge variant="outline">
                  +{selectedProducts.length - 5} more
                </Badge>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="h-6 px-2 text-xs text-muted-foreground"
              >
                Clear all
              </Button>
            </div>
          )}

          {/* Inline error for product selection */}
          <FormField
            control={form.control}
            name="selectedProducts"
            render={() => (
              <FormItem>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Products List */}
          {isLoadingInventory ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <Package className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="font-medium">
                  {searchQuery ? 'No products found' : 'No products available'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {searchQuery
                    ? 'Try adjusting your search terms'
                    : 'Add products to your inventory first'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
              {filteredProducts.map((product) => {
                const isSelected = selectedProducts.includes(product.id);
                const imageUrl = product.image_url || product.images?.[0];

                return (
                  <div
                    key={product.id}
                    className={`flex items-center gap-3 p-4 cursor-pointer transition-colors ${
                      isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => toggleProduct(product.id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleProduct(product.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    {imageUrl && (
                      <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                        <img
                          src={imageUrl}
                          alt={product.product_name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{product.product_name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        {product.category && (
                          <Badge variant="outline" className="text-xs">
                            {product.category}
                          </Badge>
                        )}
                        {product.price_per_lb !== undefined && (
                          <span>{formatCurrency(product.price_per_lb)}/lb</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground flex-shrink-0">
                      {product.quantity_lbs !== undefined && (
                        <div>{Number(product.quantity_lbs).toFixed(1)} lbs</div>
                      )}
                      {product.quantity_units !== undefined && (
                        <div>{product.quantity_units} units</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Form Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          {showCancelButton && onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={createMenu.isPending}
            >
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={createMenu.isPending}>
            {createMenu.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
