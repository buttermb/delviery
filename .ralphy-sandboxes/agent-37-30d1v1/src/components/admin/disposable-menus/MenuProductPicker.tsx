/**
 * Menu Product Picker
 * Select and order products for disposable menus with drag-and-drop reordering
 * Supports search filtering and category filtering
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import Search from "lucide-react/dist/esm/icons/search";
import GripVertical from "lucide-react/dist/esm/icons/grip-vertical";
import X from "lucide-react/dist/esm/icons/x";
import Package from "lucide-react/dist/esm/icons/package";
import Check from "lucide-react/dist/esm/icons/check";

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  category: string | null;
  in_stock: boolean;
  stock_quantity?: number;
}

interface MenuProductPickerProps {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  maxProducts?: number;
}

/**
 * Sortable Product Item
 * Wraps individual selected product for drag-and-drop functionality
 */
interface SortableProductProps {
  product: Product;
  index: number;
  onRemove: (productId: string) => void;
}

function SortableProduct({ product, index, onRemove }: SortableProductProps) {
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
      <span className="text-xs font-mono text-muted-foreground w-5">
        {index + 1}
      </span>
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.name}
          className="w-10 h-10 rounded object-cover shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
          <Package className="w-5 h-5 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{product.name}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>${product.price.toFixed(2)}</span>
          {product.category && (
            <>
              <span>·</span>
              <span className="truncate">{product.category}</span>
            </>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={() => onRemove(product.id)}
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}

/**
 * Drag Overlay Content
 * Shows the dragged product during drag operation
 */
function DragOverlayContent({ product, index }: { product: Product; index: number }) {
  return (
    <div className="flex items-center gap-3 p-2 bg-primary/5 border border-primary/20 rounded-lg shadow-xl transform scale-105">
      <GripVertical className="w-4 h-4 text-muted-foreground shrink-0 cursor-grabbing" />
      <span className="text-xs font-mono text-muted-foreground w-5">
        {index + 1}
      </span>
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.name}
          className="w-10 h-10 rounded object-cover shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
          <Package className="w-5 h-5 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{product.name}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>${product.price.toFixed(2)}</span>
          {product.category && (
            <>
              <span>·</span>
              <span className="truncate">{product.category}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function MenuProductPicker({
  selectedIds,
  onSelectionChange,
  maxProducts,
}: MenuProductPickerProps) {
  const { tenant } = useTenantAdminAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
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
    queryKey: ['menu-products-list', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, image_url, category, in_stock, stock_quantity')
        .eq('tenant_id', tenant.id)
        .order('name');

      if (error) {
        logger.error('Failed to fetch products for menu selection', error, {
          component: 'MenuProductPicker',
        });
        throw error;
      }
      return (data || []) as Product[];
    },
    enabled: !!tenant?.id,
  });

  // Get unique categories for filtering
  const categories = useMemo(() => {
    if (!products) return ['all'];
    const uniqueCategories = Array.from(
      new Set(products.map((p) => p.category).filter(Boolean))
    ) as string[];
    return ['all', ...uniqueCategories.sort()];
  }, [products]);

  // Filter products by search and category
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter((p) => {
      const matchesSearch =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory =
        selectedCategory === 'all' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Get selected products in their ordered positions
  const selectedProducts = useMemo(() => {
    if (!products) return [];
    return selectedIds
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is Product => !!p);
  }, [products, selectedIds]);

  const toggleProduct = useCallback(
    (productId: string) => {
      if (selectedIds.includes(productId)) {
        onSelectionChange(selectedIds.filter((id) => id !== productId));
      } else if (!maxProducts || selectedIds.length < maxProducts) {
        onSelectionChange([...selectedIds, productId]);
      }
    },
    [selectedIds, onSelectionChange, maxProducts]
  );

  const removeProduct = useCallback(
    (productId: string) => {
      onSelectionChange(selectedIds.filter((id) => id !== productId));
    },
    [selectedIds, onSelectionChange]
  );

  // Handle drag start - track active item for overlay
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  // Handle drag end - reorder the selected products
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
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
    },
    [selectedIds, onSelectionChange]
  );

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
              <Check className="w-4 h-4 text-green-500" />
              Selected ({selectedProducts.length}
              {maxProducts ? `/${maxProducts}` : ''})
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
                  <SortableProduct
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

      {/* Search & Category Filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Category Tabs */}
        {categories.length > 1 && (
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto gap-1 p-1">
              {categories.map((cat) => (
                <TabsTrigger
                  key={cat}
                  value={cat}
                  className="capitalize text-xs"
                >
                  {cat === 'all' ? 'All' : cat}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {/* Product List */}
        <div className="max-h-[300px] overflow-y-auto space-y-1 border rounded-lg p-2">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No products found</p>
              {searchQuery && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setSearchQuery('')}
                  className="mt-1"
                >
                  Clear search
                </Button>
              )}
            </div>
          ) : (
            filteredProducts.map((product) => {
              const isSelected = selectedIds.includes(product.id);
              const isDisabled =
                !isSelected && maxProducts !== undefined && selectedIds.length >= maxProducts;
              const isOutOfStock = !product.in_stock;

              return (
                <div
                  key={product.id}
                  className={cn(
                    'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors',
                    isSelected
                      ? 'bg-primary/5 border border-primary/20'
                      : isDisabled || isOutOfStock
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-muted/50'
                  )}
                  onClick={() =>
                    !isDisabled && !isOutOfStock && toggleProduct(product.id)
                  }
                >
                  <Checkbox
                    checked={isSelected}
                    disabled={isDisabled || isOutOfStock}
                    className="shrink-0"
                  />
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-10 h-10 rounded object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        ${product.price.toFixed(2)}
                      </span>
                      {product.category && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1">
                          {product.category}
                        </Badge>
                      )}
                      {isOutOfStock && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1">
                          Out of stock
                        </Badge>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 text-primary shrink-0" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {maxProducts && selectedIds.length >= maxProducts && (
          <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
            Maximum of {maxProducts} products reached. Remove a product to add a
            new one.
          </p>
        )}
      </div>
    </div>
  );
}
