/**
 * VariantSelector Component
 *
 * A reusable variant selector for order creation and storefront.
 * Displays available variants for a product with pricing and stock info.
 * Used in:
 * - Order creation flow (admin)
 * - Storefront product pages
 * - Quick order modals
 */

import { useState, useMemo, useCallback } from 'react';
import Check from 'lucide-react/dist/esm/icons/check';
import ChevronsUpDown from 'lucide-react/dist/esm/icons/chevrons-up-down';
import Scale from 'lucide-react/dist/esm/icons/scale';
import Ruler from 'lucide-react/dist/esm/icons/ruler';
import Leaf from 'lucide-react/dist/esm/icons/leaf';
import Package from 'lucide-react/dist/esm/icons/package';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import {
  useProductVariants,
  type ProductVariant,
  type VariantType,
} from '@/hooks/useProductVariants';
import { logger } from '@/lib/logger';
import { formatCurrency } from '@/utils/formatters';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface VariantSelectorProps {
  productId: string;
  value?: string; // Selected variant ID
  onSelect: (variant: ProductVariant | null) => void;
  disabled?: boolean;
  showPrice?: boolean;
  showStock?: boolean;
  variant?: 'dropdown' | 'radio' | 'buttons';
  size?: 'sm' | 'default' | 'lg';
  placeholder?: string;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const VARIANT_ICONS: Record<VariantType, React.ComponentType<{ className?: string }>> = {
  weight: Scale,
  size: Ruler,
  strain: Leaf,
};

// ============================================================================
// Component
// ============================================================================

export function VariantSelector({
  productId,
  value,
  onSelect,
  disabled = false,
  showPrice = true,
  showStock = true,
  variant = 'dropdown',
  size = 'default',
  placeholder = 'Select variant...',
  className,
}: VariantSelectorProps) {
  const [open, setOpen] = useState(false);

  const { data: variants, isLoading, error } = useProductVariants(productId);

  // Filter to only active variants with stock (for ordering)
  const availableVariants = useMemo(() =>
    variants?.filter((v) => v.is_active) || [],
  [variants]);

  // Get selected variant
  const selectedVariant = useMemo(() =>
    availableVariants.find((v) => v.id === value),
  [availableVariants, value]);

  // Group variants by type
  const groupedVariants = useMemo(() => {
    const groups: Record<VariantType, ProductVariant[]> = {
      weight: [],
      size: [],
      strain: [],
    };

    availableVariants.forEach((v) => {
      groups[v.variant_type].push(v);
    });

    return groups;
  }, [availableVariants]);

  const handleSelect = useCallback((variantId: string) => {
    const selected = availableVariants.find((v) => v.id === variantId);
    if (selected) {
      onSelect(selected);
      logger.debug('Variant selected', { variantId, productId });
    }
    setOpen(false);
  }, [availableVariants, onSelect, productId]);

  const handleClear = useCallback(() => {
    onSelect(null);
    logger.debug('Variant cleared', { productId });
  }, [onSelect, productId]);

  // ============================================================================
  // Loading State
  // ============================================================================

  if (isLoading) {
    return (
      <Skeleton className={cn(
        'w-full',
        size === 'sm' && 'h-8',
        size === 'default' && 'h-10',
        size === 'lg' && 'h-12'
      )} />
    );
  }

  // ============================================================================
  // Error State
  // ============================================================================

  if (error) {
    return (
      <div className="flex items-center gap-2 text-destructive text-sm">
        <AlertTriangle className="h-4 w-4" />
        <span>Failed to load variants</span>
      </div>
    );
  }

  // ============================================================================
  // No Variants
  // ============================================================================

  if (availableVariants.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No variants available
      </div>
    );
  }

  // ============================================================================
  // Radio Variant
  // ============================================================================

  if (variant === 'radio') {
    return (
      <RadioGroup
        value={value}
        onValueChange={handleSelect}
        disabled={disabled}
        className={cn('space-y-2', className)}
      >
        {Object.entries(groupedVariants).map(([type, typeVariants]) => {
          if (typeVariants.length === 0) return null;

          const Icon = VARIANT_ICONS[type as VariantType];

          return (
            <div key={type} className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
                <Icon className="h-3 w-3" />
                {type}
              </div>
              {typeVariants.map((v) => {
                const isOutOfStock = v.available_quantity <= 0;

                return (
                  <div key={v.id} className="flex items-center space-x-3">
                    <RadioGroupItem
                      value={v.id}
                      id={v.id}
                      disabled={disabled || isOutOfStock}
                    />
                    <Label
                      htmlFor={v.id}
                      className={cn(
                        'flex items-center justify-between flex-1 cursor-pointer',
                        isOutOfStock && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span>{v.name}</span>
                        {v.sku && (
                          <span className="text-xs text-muted-foreground">
                            ({v.sku})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {showPrice && v.wholesale_price && (
                          <span className="font-medium">
                            {formatCurrency(v.wholesale_price)}
                          </span>
                        )}
                        {showStock && (
                          <Badge
                            variant={isOutOfStock ? 'destructive' : 'secondary'}
                            className="text-xs"
                          >
                            {isOutOfStock ? 'Out of stock' : `${v.available_quantity} left`}
                          </Badge>
                        )}
                      </div>
                    </Label>
                  </div>
                );
              })}
            </div>
          );
        })}
      </RadioGroup>
    );
  }

  // ============================================================================
  // Buttons Variant
  // ============================================================================

  if (variant === 'buttons') {
    return (
      <div className={cn('space-y-3', className)}>
        {Object.entries(groupedVariants).map(([type, typeVariants]) => {
          if (typeVariants.length === 0) return null;

          const Icon = VARIANT_ICONS[type as VariantType];

          return (
            <div key={type} className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
                <Icon className="h-3 w-3" />
                {type}
              </div>
              <div className="flex flex-wrap gap-2">
                {typeVariants.map((v) => {
                  const isOutOfStock = v.available_quantity <= 0;
                  const isSelected = value === v.id;

                  return (
                    <TooltipProvider key={v.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant={isSelected ? 'default' : 'outline'}
                            size={size}
                            disabled={disabled || isOutOfStock}
                            onClick={() => handleSelect(v.id)}
                            className={cn(
                              'relative',
                              isOutOfStock && 'opacity-50',
                              isSelected && 'ring-2 ring-ring ring-offset-2'
                            )}
                          >
                            {v.name}
                            {showPrice && v.wholesale_price && (
                              <span className="ml-1 text-xs opacity-75">
                                {formatCurrency(v.wholesale_price)}
                              </span>
                            )}
                            {isSelected && (
                              <Check className="h-3 w-3 ml-1" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="space-y-1">
                            <p className="font-medium">{v.name}</p>
                            {v.sku && <p className="text-xs">SKU: {v.sku}</p>}
                            {showStock && (
                              <p className={cn(
                                'text-xs',
                                isOutOfStock && 'text-destructive'
                              )}>
                                {isOutOfStock
                                  ? 'Out of stock'
                                  : `${v.available_quantity} available`}
                              </p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ============================================================================
  // Dropdown Variant (default)
  // ============================================================================

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between',
            size === 'sm' && 'h-8 text-sm',
            size === 'lg' && 'h-12',
            !value && 'text-muted-foreground',
            className
          )}
        >
          {selectedVariant ? (
            <span className="flex items-center gap-2 truncate">
              {(() => {
                const Icon = VARIANT_ICONS[selectedVariant.variant_type];
                return <Icon className="h-4 w-4 shrink-0" />;
              })()}
              <span className="truncate">{selectedVariant.name}</span>
              {showPrice && selectedVariant.wholesale_price && (
                <span className="text-muted-foreground ml-1">
                  ({formatCurrency(selectedVariant.wholesale_price)})
                </span>
              )}
              {showStock && selectedVariant.available_quantity <= 0 && (
                <Badge variant="destructive" className="text-xs ml-1">
                  Out of stock
                </Badge>
              )}
            </span>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search variants..." />
          <CommandList>
            <CommandEmpty>No variants found.</CommandEmpty>
            {Object.entries(groupedVariants).map(([type, typeVariants]) => {
              if (typeVariants.length === 0) return null;

              const Icon = VARIANT_ICONS[type as VariantType];

              return (
                <CommandGroup
                  key={type}
                  heading={
                    <span className="flex items-center gap-1.5">
                      <Icon className="h-3 w-3" />
                      {type.charAt(0).toUpperCase() + type.slice(1)} Options
                    </span>
                  }
                >
                  {typeVariants.map((v) => {
                    const isOutOfStock = v.available_quantity <= 0;
                    const isLowStock = v.available_quantity <= v.low_stock_alert && v.available_quantity > 0;

                    return (
                      <CommandItem
                        key={v.id}
                        value={`${v.name} ${v.sku || ''}`}
                        disabled={isOutOfStock}
                        onSelect={() => handleSelect(v.id)}
                        className={cn(
                          isOutOfStock && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4 shrink-0',
                            value === v.id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <div className="flex flex-col flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">{v.name}</span>
                            {isOutOfStock && (
                              <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4 shrink-0">
                                Out of Stock
                              </Badge>
                            )}
                            {isLowStock && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 text-amber-600 shrink-0">
                                Low Stock
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {v.sku && <span className="font-mono">SKU: {v.sku}</span>}
                            {showPrice && v.wholesale_price && (
                              <span>{formatCurrency(v.wholesale_price)}</span>
                            )}
                            {showStock && !isOutOfStock && (
                              <span className="flex items-center gap-0.5">
                                <Package className="h-3 w-3" />
                                {v.available_quantity}
                              </span>
                            )}
                          </div>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// Storefront Variant Selector
// ============================================================================

interface StorefrontVariantSelectorProps {
  productId: string;
  value?: string;
  onSelect: (variant: ProductVariant | null) => void;
  showRetailPrice?: boolean;
}

/**
 * Simplified variant selector for customer-facing storefront.
 * Shows retail prices and simplified stock status.
 */
export function StorefrontVariantSelector({
  productId,
  value,
  onSelect,
  showRetailPrice = true,
}: StorefrontVariantSelectorProps) {
  const { data: variants, isLoading, error } = useProductVariants(productId);

  const availableVariants = useMemo(() =>
    variants?.filter((v) => v.is_active && v.available_quantity > 0) || [],
  [variants]);

  const selectedVariant = useMemo(() =>
    availableVariants.find((v) => v.id === value),
  [availableVariants, value]);

  const handleSelect = useCallback((variantId: string) => {
    const selected = availableVariants.find((v) => v.id === variantId);
    onSelect(selected || null);
  }, [availableVariants, onSelect]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (error || availableVariants.length === 0) {
    return null;
  }

  // Simple button group for storefront
  return (
    <div className="flex flex-wrap gap-2">
      {availableVariants.map((v) => {
        const isSelected = value === v.id;
        const price = showRetailPrice ? v.retail_price : v.wholesale_price;

        return (
          <button
            key={v.id}
            onClick={() => handleSelect(v.id)}
            className={cn(
              'px-4 py-2 rounded-lg border-2 transition-all',
              'hover:border-primary focus:outline-none focus:ring-2 focus:ring-ring',
              isSelected
                ? 'border-primary bg-primary/5'
                : 'border-muted hover:bg-muted/50'
            )}
          >
            <div className="flex flex-col items-center gap-1">
              <span className={cn(
                'font-medium',
                isSelected && 'text-primary'
              )}>
                {v.name}
              </span>
              {price && (
                <span className="text-sm text-muted-foreground">
                  {formatCurrency(price)}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default VariantSelector;
