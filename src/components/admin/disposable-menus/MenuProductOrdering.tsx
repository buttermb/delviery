/**
 * Menu Product Ordering Component
 *
 * Drag-and-drop interface for reordering products and categories in disposable menus.
 * Features:
 * - Drag-drop product reordering within categories
 * - Drag-drop category reordering
 * - Real-time preview
 * - Persists sort_order to menu_products junction table
 * - Product arrangement is independent per menu
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
  UniqueIdentifier,
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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import GripVertical from 'lucide-react/dist/esm/icons/grip-vertical';
import Package from 'lucide-react/dist/esm/icons/package';
import FolderOpen from 'lucide-react/dist/esm/icons/folder-open';
import Save from 'lucide-react/dist/esm/icons/save';
import Undo from 'lucide-react/dist/esm/icons/undo-2';
import Eye from 'lucide-react/dist/esm/icons/eye';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import { queryKeys } from '@/lib/queryKeys';

// Types
interface MenuProduct {
  id: string;
  product_id: string;
  custom_price?: number;
  display_order: number;
  product?: {
    id: string;
    name: string;
    price: number;
    image_url?: string;
    category?: string;
  };
}

interface OrderedProduct {
  id: string;
  productId: string;
  name: string;
  price: number;
  customPrice?: number;
  imageUrl?: string;
  category: string;
  displayOrder: number;
}

interface CategoryGroup {
  category: string;
  products: OrderedProduct[];
  displayOrder: number;
}

interface MenuProductOrderingProps {
  menuId: string;
  menuProducts: MenuProduct[];
  onOrderChange?: (products: OrderedProduct[]) => void;
  showPreview?: boolean;
  isLoading?: boolean;
}

// Sortable Product Item
function SortableProductItem({
  product,
  index,
}: {
  product: OrderedProduct;
  index: number;
}) {
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
        'flex items-center gap-3 p-3 bg-background border rounded-lg transition-all',
        isDragging && 'opacity-50 shadow-lg z-50 ring-2 ring-primary'
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="touch-none cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </button>

      <span className="text-xs font-mono text-muted-foreground w-6 text-center">
        {index + 1}
      </span>

      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-10 h-10 rounded object-cover shrink-0"
          loading="lazy"
        />
      ) : (
        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
          <Package className="w-5 h-5 text-muted-foreground" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{product.name}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={product.customPrice ? 'text-primary font-medium' : ''}>
            ${(product.customPrice ?? product.price).toFixed(2)}
          </span>
          {product.customPrice && product.customPrice !== product.price && (
            <span className="line-through">${product.price.toFixed(2)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Sortable Category Item
function SortableCategoryItem({
  category,
  index,
  products,
  onProductReorder,
  expandedCategories,
  onToggleExpand,
}: {
  category: string;
  index: number;
  products: OrderedProduct[];
  onProductReorder: (category: string, products: OrderedProduct[]) => void;
  expandedCategories: string[];
  onToggleExpand: (category: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `category-${category}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isExpanded = expandedCategories.includes(category);
  const productIds = products.map(p => p.id);

  // Product drag sensors
  const productSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleProductDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = products.findIndex(p => p.id === active.id);
        const newIndex = products.findIndex(p => p.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          const reordered = arrayMove(products, oldIndex, newIndex).map((p, i) => ({
            ...p,
            displayOrder: i,
          }));
          onProductReorder(category, reordered);
        }
      }
    },
    [products, category, onProductReorder]
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'border rounded-lg overflow-hidden transition-all',
        isDragging && 'opacity-50 shadow-lg z-50 ring-2 ring-primary'
      )}
    >
      <div
        className="flex items-center gap-3 p-3 bg-muted/50 cursor-pointer"
        onClick={() => onToggleExpand(category)}
      >
        <button
          {...attributes}
          {...listeners}
          className="touch-none cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
          aria-label="Drag to reorder category"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </button>

        <span className="text-xs font-mono text-muted-foreground w-6 text-center">
          {index + 1}
        </span>

        <FolderOpen className="w-5 h-5 text-muted-foreground shrink-0" />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{category || 'Uncategorized'}</p>
          <p className="text-xs text-muted-foreground">
            {products.length} product{products.length !== 1 ? 's' : ''}
          </p>
        </div>

        <Badge variant="secondary" className="shrink-0">
          {isExpanded ? 'Collapse' : 'Expand'}
        </Badge>
      </div>

      {isExpanded && (
        <div className="p-3 bg-background space-y-2">
          <DndContext
            sensors={productSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleProductDragEnd}
          >
            <SortableContext items={productIds} strategy={verticalListSortingStrategy}>
              {products.map((product, idx) => (
                <SortableProductItem key={product.id} product={product} index={idx} />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}

// Product Overlay for dragging
function _ProductOverlay({ product, index }: { product: OrderedProduct; index: number }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-background border rounded-lg shadow-xl">
      <GripVertical className="w-4 h-4 text-muted-foreground cursor-grabbing" />
      <span className="text-xs font-mono text-muted-foreground w-6 text-center">
        {index + 1}
      </span>
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-10 h-10 rounded object-cover shrink-0"
          loading="lazy"
        />
      ) : (
        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
          <Package className="w-5 h-5 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{product.name}</p>
      </div>
    </div>
  );
}

// Category Overlay for dragging
function CategoryOverlay({ category, productCount }: { category: string; productCount: number }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-muted/50 border rounded-lg shadow-xl">
      <GripVertical className="w-4 h-4 text-muted-foreground cursor-grabbing" />
      <FolderOpen className="w-5 h-5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{category || 'Uncategorized'}</p>
        <p className="text-xs text-muted-foreground">{productCount} products</p>
      </div>
    </div>
  );
}

// Preview Component
function MenuPreviewPanel({ categories }: { categories: CategoryGroup[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Eye className="w-4 h-4" />
          Live Preview
        </CardTitle>
        <CardDescription className="text-xs">
          How products will appear on the menu
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {categories.map((group) => (
              <div key={group.category} className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground border-b pb-1">
                  {group.category || 'Uncategorized'}
                </h4>
                <div className="space-y-1.5">
                  {group.products.map((product, idx) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-2 text-xs p-2 rounded bg-muted/30"
                    >
                      <span className="text-muted-foreground w-4">{idx + 1}.</span>
                      <span className="flex-1 truncate">{product.name}</span>
                      <span className="font-medium">
                        ${(product.customPrice ?? product.price).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Main Component
export function MenuProductOrdering({
  menuId,
  menuProducts,
  onOrderChange,
  showPreview = true,
  isLoading = false,
}: MenuProductOrderingProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  // Transform menu products into ordered products grouped by category
  const initialProducts = useMemo((): OrderedProduct[] => {
    return menuProducts
      .map((mp) => ({
        id: mp.id,
        productId: mp.product_id,
        name: mp.product?.name || 'Unknown Product',
        price: mp.product?.price ?? 0,
        customPrice: mp.custom_price,
        imageUrl: mp.product?.image_url,
        category: mp.product?.category || 'Uncategorized',
        displayOrder: mp.display_order,
      }))
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }, [menuProducts]);

  const [orderedProducts, setOrderedProducts] = useState<OrderedProduct[]>(initialProducts);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [activeType, setActiveType] = useState<'product' | 'category' | null>(null);

  // Initialize category order from products
  useEffect(() => {
    const categories = Array.from(new Set(initialProducts.map(p => p.category)));
    setCategoryOrder(categories);
    setOrderedProducts(initialProducts);
    setExpandedCategories(categories.slice(0, 2)); // Expand first 2 categories by default
  }, [initialProducts]);

  // Group products by category
  const categoryGroups = useMemo((): CategoryGroup[] => {
    const groups: Map<string, OrderedProduct[]> = new Map();

    for (const product of orderedProducts) {
      const existing = groups.get(product.category) ?? [];
      existing.push(product);
      groups.set(product.category, existing);
    }

    // Sort by category order
    return categoryOrder
      .filter(cat => groups.has(cat))
      .map((category, index) => ({
        category,
        products: (groups.get(category) ?? []).sort((a, b) => a.displayOrder - b.displayOrder),
        displayOrder: index,
      }));
  }, [orderedProducts, categoryOrder]);

  // Category drag sensors
  const categorySensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle category drag
  const handleCategoryDragStart = useCallback((event: DragStartEvent) => {
    const id = event.active.id as string;
    if (id.startsWith('category-')) {
      setActiveId(id);
      setActiveType('category');
    }
  }, []);

  // Update product display orders when category order changes
  const updateProductOrders = useCallback((newCategoryOrder: string[]) => {
    let globalOrder = 0;
    const updatedProducts = [...orderedProducts];

    for (const category of newCategoryOrder) {
      const categoryProducts = updatedProducts
        .filter(p => p.category === category)
        .sort((a, b) => a.displayOrder - b.displayOrder);

      for (const product of categoryProducts) {
        const idx = updatedProducts.findIndex(p => p.id === product.id);
        if (idx !== -1) {
          updatedProducts[idx] = { ...updatedProducts[idx], displayOrder: globalOrder++ };
        }
      }
    }

    setOrderedProducts(updatedProducts);
    onOrderChange?.(updatedProducts);
  }, [orderedProducts, onOrderChange]);

  const handleCategoryDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      setActiveType(null);

      if (over && active.id !== over.id) {
        const activeCategory = (active.id as string).replace('category-', '');
        const overCategory = (over.id as string).replace('category-', '');

        const oldIndex = categoryOrder.indexOf(activeCategory);
        const newIndex = categoryOrder.indexOf(overCategory);

        if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = arrayMove(categoryOrder, oldIndex, newIndex);
          setCategoryOrder(newOrder);
          setHasChanges(true);
          updateProductOrders(newOrder);
        }
      }
    },
    [categoryOrder, updateProductOrders]
  );

  // Handle product reorder within category
  const handleProductReorder = useCallback(
    (category: string, reorderedProducts: OrderedProduct[]) => {
      setOrderedProducts(prev => {
        const other = prev.filter(p => p.category !== category);
        const updated = [...other, ...reorderedProducts];
        return updated;
      });
      setHasChanges(true);
      onOrderChange?.(orderedProducts);
    },
    [orderedProducts, onOrderChange]
  );

  // Toggle category expansion
  const toggleCategoryExpand = useCallback((category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  }, []);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id) throw new Error('No tenant ID');

      // Calculate global display order
      let globalOrder = 0;
      const updates: { id: string; display_order: number }[] = [];

      for (const category of categoryOrder) {
        const categoryProducts = orderedProducts
          .filter(p => p.category === category)
          .sort((a, b) => a.displayOrder - b.displayOrder);

        for (const product of categoryProducts) {
          updates.push({
            id: product.id,
            display_order: globalOrder++,
          });
        }
      }

      // Batch update display orders
      for (const update of updates) {
        const { error } = await supabase
          .from('disposable_menu_products')
          .update({ display_order: update.display_order })
          .eq('id', update.id)
          .eq('menu_id', menuId);

        if (error) {
          logger.error('Failed to update product order', error, {
            component: 'MenuProductOrdering',
            productId: update.id,
          });
          throw error;
        }
      }

      return updates;
    },
    onSuccess: () => {
      setHasChanges(false);
      toast.success('Product order saved');
      queryClient.invalidateQueries({ queryKey: queryKeys.disposableMenus.all });
    },
    onError: (error) => {
      logger.error('Failed to save product order', error, {
        component: 'MenuProductOrdering',
      });
      toast.error('Failed to save product order', { description: humanizeError(error) });
    },
  });

  // Reset to original order
  const handleReset = useCallback(() => {
    setOrderedProducts(initialProducts);
    const categories = Array.from(new Set(initialProducts.map(p => p.category)));
    setCategoryOrder(categories);
    setHasChanges(false);
  }, [initialProducts]);

  // Get active item for overlay
  const getActiveItem = useMemo(() => {
    if (!activeId || !activeType) return null;

    if (activeType === 'category') {
      const category = (activeId as string).replace('category-', '');
      const group = categoryGroups.find(g => g.category === category);
      return group ? { type: 'category' as const, category, productCount: group.products.length } : null;
    }

    return null;
  }, [activeId, activeType, categoryGroups]);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (orderedProducts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No products in this menu</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add products to start organizing them
          </p>
        </CardContent>
      </Card>
    );
  }

  const categoryIds = categoryOrder.map(cat => `category-${cat}`);

  return (
    <div className={cn('grid gap-6', showPreview && 'lg:grid-cols-2')}>
      {/* Ordering Panel */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Product Order</CardTitle>
              <CardDescription className="text-xs">
                Drag categories or products to reorder
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {hasChanges && (
                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Unsaved
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={!hasChanges || saveMutation.isPending}
              >
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Undo className="w-4 h-4 mr-1" />
                Reset
              </Button>
              <Button
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={!hasChanges || saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-1" />
                )}
                Save
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            <DndContext
              sensors={categorySensors}
              collisionDetection={closestCenter}
              onDragStart={handleCategoryDragStart}
              onDragEnd={handleCategoryDragEnd}
            >
              <SortableContext items={categoryIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {categoryGroups.map((group, index) => (
                    <SortableCategoryItem
                      key={group.category}
                      category={group.category}
                      index={index}
                      products={group.products}
                      onProductReorder={handleProductReorder}
                      expandedCategories={expandedCategories}
                      onToggleExpand={toggleCategoryExpand}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {getActiveItem?.type === 'category' && (
                  <CategoryOverlay
                    category={getActiveItem.category}
                    productCount={getActiveItem.productCount}
                  />
                )}
              </DragOverlay>
            </DndContext>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Preview Panel */}
      {showPreview && <MenuPreviewPanel categories={categoryGroups} />}
    </div>
  );
}

export default MenuProductOrdering;
