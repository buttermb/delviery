/**
 * MenuCategorySections Component
 * Task 281: Add menu category sections
 *
 * Organizes menu products into collapsible category sections for better navigation
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import ChevronUp from 'lucide-react/dist/esm/icons/chevron-up';
import Package from 'lucide-react/dist/esm/icons/package';

interface MenuProduct {
  id: string;
  name: string;
  price: number;
  category?: string | null;
  image_url?: string | null;
  description?: string | null;
  strain_type?: string | null;
}

interface CategorySection {
  category: string;
  products: MenuProduct[];
  displayOrder: number;
}

interface MenuCategorySectionsProps {
  products: MenuProduct[];
  onProductClick?: (product: MenuProduct) => void;
  defaultExpandedCategories?: string[];
  showProductCount?: boolean;
  className?: string;
}

export function MenuCategorySections({
  products,
  onProductClick,
  defaultExpandedCategories = [],
  showProductCount = true,
  className,
}: MenuCategorySectionsProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(defaultExpandedCategories)
  );

  // Group products by category
  const categorySections = useMemo((): CategorySection[] => {
    const categoryMap = new Map<string, MenuProduct[]>();

    for (const product of products) {
      const category = product.category || 'Uncategorized';
      const existing = categoryMap.get(category) ?? [];
      existing.push(product);
      categoryMap.set(category, existing);
    }

    // Convert to array and sort alphabetically
    return Array.from(categoryMap.entries())
      .map(([category, categoryProducts], index) => ({
        category,
        products: categoryProducts.sort((a, b) => a.name.localeCompare(b.name)),
        displayOrder: index,
      }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [products]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedCategories(new Set(categorySections.map((s) => s.category)));
  };

  const collapseAll = () => {
    setExpandedCategories(new Set());
  };

  if (categorySections.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center">
          <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No products available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Expand/Collapse All Controls */}
      {categorySections.length > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {categorySections.length} categories, {products.length} products total
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={expandAll}>
              Expand All
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>
              Collapse All
            </Button>
          </div>
        </div>
      )}

      {/* Category Sections */}
      <div className="space-y-3">
        {categorySections.map((section) => {
          const isExpanded = expandedCategories.has(section.category);

          return (
            <Collapsible
              key={section.category}
              open={isExpanded}
              onOpenChange={() => toggleCategory(section.category)}
            >
              <Card className="overflow-hidden">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-lg capitalize">
                          {section.category}
                        </CardTitle>
                        {showProductCount && (
                          <Badge variant="secondary" className="text-xs">
                            {section.products.length}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {section.products.map((product) => (
                        <button
                          key={product.id}
                          onClick={() => onProductClick?.(product)}
                          className={cn(
                            'w-full p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors text-left',
                            onProductClick && 'cursor-pointer'
                          )}
                        >
                          {/* Product Image */}
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-16 h-16 rounded object-cover shrink-0"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded bg-muted flex items-center justify-center shrink-0">
                              <Package className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}

                          {/* Product Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold truncate">{product.name}</h4>
                              {product.strain_type && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'text-xs capitalize shrink-0',
                                    product.strain_type === 'indica' &&
                                      'border-purple-500 text-purple-500',
                                    product.strain_type === 'sativa' &&
                                      'border-green-500 text-green-500',
                                    product.strain_type === 'hybrid' &&
                                      'border-orange-500 text-orange-500'
                                  )}
                                >
                                  {product.strain_type}
                                </Badge>
                              )}
                            </div>
                            {product.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {product.description}
                              </p>
                            )}
                          </div>

                          {/* Price */}
                          <div className="text-right shrink-0">
                            <p className="text-lg font-bold text-primary">
                              ${product.price.toFixed(2)}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
