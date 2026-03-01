/**
 * Featured Products Manager
 * Select and manage which products appear as featured on the storefront
 * Supports drag-and-drop reordering using @dnd-kit
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/queryKeys';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import {
  Search,
  Star,
  GripVertical,
  X,
  Package,
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  category: string | null;
  in_stock: boolean;
}

interface FeaturedProductsManagerProps {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  maxFeatured?: number;
}

/**
 * Sortable Featured Product Item
 * Wraps individual featured product for drag-and-drop functionality
 */
interface SortableFeaturedProductProps {
  product: Product;
  index: number;
  onRemove: (productId: string) => void;
}

function SortableFeaturedProduct({ product, index, onRemove }: SortableFeaturedProductProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 p-2 bg-primary/5 border border-primary/20 rounded-lg',
        isDragging && 'opacity-50 shadow-lg z-50'
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="touch-none cursor-grab active:cursor-grabbing p-0.5 hover:bg-primary/10 rounded"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>
      <span className="text-xs font-mono text-muted-foreground w-4">
        {index + 1}
      </span>
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.name || 'Product image'}
          className="w-8 h-8 rounded object-cover shrink-0"
          loading="lazy"
        />
      ) : (
        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
          <Package className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{product.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatCurrency(product.price)}
          {product.category && ` · ${product.category}`}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={() => onRemove(product.id)}
        aria-label="Remove"
      >
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
}

/**
 * Featured Product Drag Overlay
 * Shows the dragged product during drag operation
 */
function DragOverlayContent({ product, index }: { product: Product; index: number }) {
  return (
    <div className="flex items-center gap-3 p-2 bg-primary/5 border border-primary/20 rounded-lg shadow-xl transform scale-105">
      <GripVertical className="w-4 h-4 text-muted-foreground shrink-0 cursor-grabbing" />
      <span className="text-xs font-mono text-muted-foreground w-4">
        {index + 1}
      </span>
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.name || 'Product image'}
          className="w-8 h-8 rounded object-cover shrink-0"
          loading="lazy"
        />
      ) : (
        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
          <Package className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{product.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatCurrency(product.price)}
          {product.category && ` · ${product.category}`}
        </p>
      </div>
    </div>
  );
}

export function FeaturedProductsManager({
  selectedIds,
  onSelectionChange,
  maxFeatured = 8,
}: FeaturedProductsManagerProps) {
  const { tenant } = useTenantAdminAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

  // Configure dnd-kit sensors for pointer, touch, and keyboard
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimum drag distance before activation
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch all products for this tenant
  const { data: products, isLoading } = useQuery({
    queryKey: queryKeys.featuredProducts.list(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, image_url, category, in_stock')
        .eq('tenant_id', tenant.id)
        .eq('in_stock', true)
        .order('name');

      if (error) {
        logger.error('Failed to fetch products for featured selection', error, {
          component: 'FeaturedProductsManager',
        });
        throw error;
      }
      return (data ?? []) as Product[];
    },
    enabled: !!tenant?.id,
  });

  // Filter products by search
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q))
    );
  }, [products, searchQuery]);

  // Get selected products in order
  const selectedProducts = useMemo(() => {
    if (!products) return [];
    return selectedIds
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is Product => !!p);
  }, [products, selectedIds]);

  const toggleProduct = (productId: string) => {
    if (selectedIds.includes(productId)) {
      onSelectionChange(selectedIds.filter((id) => id !== productId));
    } else if (selectedIds.length < maxFeatured) {
      onSelectionChange([...selectedIds, productId]);
    }
  };

  const removeProduct = useCallback((productId: string) => {
    onSelectionChange(selectedIds.filter((id) => id !== productId));
  }, [selectedIds, onSelectionChange]);

  // Handle drag start - track active item for overlay
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  // Handle drag end - reorder the selected products
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = selectedIds.indexOf(active.id as string);
      const newIndex = selectedIds.indexOf(over.id as string);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newIds = arrayMove(selectedIds, oldIndex, newIndex);
        onSelectionChange(newIds);
      }
    }
  }, [selectedIds, onSelectionChange]);

  // Get the active product for drag overlay
  const activeProduct = useMemo(() => {
    if (!activeId || !products) return null;
    return products.find((p) => p.id === activeId) || null;
  }, [activeId, products]);

  const activeIndex = useMemo(() => {
    if (!activeId) return -1;
    return selectedIds.indexOf(activeId);
  }, [activeId, selectedIds]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selected Products with Drag-Drop Reordering */}
      {selectedProducts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" />
              Featured ({selectedProducts.length}/{maxFeatured})
            </h4>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Drag to reorder</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => onSelectionChange([])}
              >
                Clear All
              </Button>
            </div>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={selectedIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {selectedProducts.map((product, index) => (
                  <SortableFeaturedProduct
                    key={product.id}
                    product={product}
                    index={index}
                    onRemove={removeProduct}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeProduct && activeIndex !== -1 ? (
                <DragOverlayContent product={activeProduct} index={activeIndex} />
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      {/* Search & Product List */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            aria-label="Search products"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-[300px] overflow-y-auto space-y-1 border rounded-lg p-2">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No products found</p>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const isSelected = selectedIds.includes(product.id);
              const isDisabled = !isSelected && selectedIds.length >= maxFeatured;

              return (
                <div
                  key={product.id}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-primary/5'
                      : isDisabled
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-muted/50'
                  }`}
                  onClick={() => !isDisabled && toggleProduct(product.id)}
                >
                  <Checkbox
                    checked={isSelected}
                    disabled={isDisabled}
                    className="shrink-0"
                  />
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name || 'Product image'}
                      className="w-8 h-8 rounded object-cover shrink-0"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(product.price)}
                      </span>
                      {product.category && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1">
                          {product.category}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 shrink-0" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {selectedIds.length >= maxFeatured && (
          <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
            Maximum of {maxFeatured} featured products reached. Remove a product to add a new one.
          </p>
        )}
      </div>
    </div>
  );
}
