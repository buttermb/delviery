/**
 * FilterDrawer - Mobile-friendly filter panel
 * Uses shadcn Sheet for consistent drawer behavior
 * Theme-aware: adapts to storefront CSS variables
 * FilterDrawer - Mobile-friendly filter panel with draft-and-apply pattern
 * Uses shadcn Sheet for consistent drawer behavior.
 * Filters are edited in a draft state and only applied when the user taps "Apply".
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, SlidersHorizontal, ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { EnhancedPriceSlider } from './EnhancedPriceSlider';

export interface FilterState {
  categories: string[];
  strainTypes: string[];
  priceRange: [number, number];
  sortBy: string;
  inStockOnly?: boolean;
  thcRange?: [number, number];
  cbdRange?: [number, number];
}

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterState;
  onApply: (filters: FilterState) => void;
  availableCategories: string[];
  availableStrainTypes: string[];
  maxPrice: number;
  accentColor?: string;
  resultCount?: number;
}

const SORT_OPTIONS = [
  { value: 'name', label: 'Name A-Z' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest First' },
  { value: 'thc_desc', label: 'THC%: High to Low' },
  { value: 'thc_asc', label: 'THC%: Low to High' },
];

/** Count how many filters are active (non-default) */
export function getActiveFilterCount(filters: FilterState, maxPrice: number): number {
  return (
    filters.categories.length +
    filters.strainTypes.length +
    (filters.priceRange[0] > 0 || filters.priceRange[1] < maxPrice ? 1 : 0) +
    (filters.sortBy !== 'name' ? 1 : 0)
  );
}

export function FilterDrawer({
  isOpen,
  onClose,
  filters,
  onApply,
  availableCategories,
  availableStrainTypes,
  maxPrice,
  accentColor = '#10b981',
  resultCount,
}: FilterDrawerProps) {
  // Draft state — initialized from committed filters when drawer opens
  const [draft, setDraft] = useState<FilterState>(filters);
  const [expandedSections, setExpandedSections] = useState<string[]>(['categories', 'price', 'sort']);

  // Reset draft to committed filters whenever the drawer opens
  useEffect(() => {
    if (isOpen) {
      setDraft(filters);
    }
  }, [isOpen, filters]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  const toggleCategory = useCallback((category: string) => {
    setDraft(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category],
    }));
  }, []);

  const toggleStrainType = useCallback((strainType: string) => {
    setDraft(prev => ({
      ...prev,
      strainTypes: prev.strainTypes.includes(strainType)
        ? prev.strainTypes.filter(s => s !== strainType)
        : [...prev.strainTypes, strainType],
    }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setDraft({
      categories: [],
      strainTypes: [],
      priceRange: [0, maxPrice],
      sortBy: 'name',
      inStockOnly: false,
      thcRange: [0, 100],
      cbdRange: [0, 100],
    });
  }, [maxPrice]);

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  const activeFilterCount = getActiveFilterCount(filters, maxPrice);
  const draftActiveCount = getActiveFilterCount(draft, maxPrice);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="left"
        className="w-full max-w-xs sm:max-w-xs p-0 flex flex-col gap-0 overflow-hidden [&>button:last-child]:hidden"
        style={{
          backgroundColor: 'var(--storefront-card-bg, white)',
          borderColor: 'var(--storefront-border, #e5e7eb)',
          color: 'var(--storefront-text, #111)',
        }}
      >
        <SheetTitle className="sr-only">Filters</SheetTitle>
        <SheetDescription className="sr-only">
          Filter products by category, strain type, price, and sort order
        </SheetDescription>

        {/* Header */}
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{ borderColor: 'var(--storefront-border, #e5e7eb)' }}
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 opacity-60" />
            <h3 className="font-semibold tracking-wide">Filters</h3>
            {activeFilterCount > 0 && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: accentColor }}
              >
                {activeFilterCount}
            <SlidersHorizontal className="w-4 h-4 text-white/60" />
            <h3 className="text-white font-light tracking-wide">Filters</h3>
            {draftActiveCount > 0 && (
              <span className="px-2 py-0.5 bg-white/10 rounded-full text-white/60 text-xs">
                {draftActiveCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {draftActiveCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="text-xs opacity-50 hover:opacity-100 transition-opacity"
              >
                Clear all
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded hover:opacity-70 transition-opacity min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close filters"
            >
              <X className="w-5 h-5 opacity-60" />
            </button>
          </div>
        </div>

        {/* Filter Sections */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Sort By */}
          <FilterSection
            title="Sort By"
            isExpanded={expandedSections.includes('sort')}
            onToggle={() => toggleSection('sort')}
            accentColor={accentColor}
          >
            <div className="space-y-1">
              {SORT_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => setDraft(prev => ({ ...prev, sortBy: option.value }))}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors min-h-[44px] flex items-center',
                    filters.sortBy === option.value
                      ? 'font-medium'
                      : 'opacity-60 hover:opacity-80'
                    'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                    draft.sortBy === option.value
                      ? 'bg-white/10 text-white'
                      : 'text-white/50 hover:bg-white/5 hover:text-white/70'
                  )}
                  style={filters.sortBy === option.value ? {
                    backgroundColor: `${accentColor}15`,
                    color: accentColor,
                  } : undefined}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </FilterSection>

          {/* Categories */}
          {availableCategories.length > 0 && (
            <FilterSection
              title="Categories"
              isExpanded={expandedSections.includes('categories')}
              onToggle={() => toggleSection('categories')}
              count={filters.categories.length}
              accentColor={accentColor}
              count={draft.categories.length}
            >
              <div className="space-y-1">
                {availableCategories.map(category => (
                  <label
                    key={category}
                    className="flex items-center gap-3 px-2 py-2 rounded cursor-pointer hover:opacity-80 min-h-[44px]"
                  >
                    <Checkbox
                      checked={draft.categories.includes(category)}
                      onCheckedChange={() => toggleCategory(category)}
                    />
                    <span className="text-sm">{category}</span>
                  </label>
                ))}
              </div>
            </FilterSection>
          )}

          {/* Strain Types */}
          {availableStrainTypes.length > 0 && (
            <FilterSection
              title="Strain Type"
              isExpanded={expandedSections.includes('strain')}
              onToggle={() => toggleSection('strain')}
              count={filters.strainTypes.length}
              accentColor={accentColor}
              count={draft.strainTypes.length}
            >
              <div className="space-y-1">
                {availableStrainTypes.map(strain => (
                  <label
                    key={strain}
                    className="flex items-center gap-3 px-2 py-2 rounded cursor-pointer hover:opacity-80 min-h-[44px]"
                  >
                    <Checkbox
                      checked={draft.strainTypes.includes(strain)}
                      onCheckedChange={() => toggleStrainType(strain)}
                    />
                    <span className="text-sm">{strain}</span>
                  </label>
                ))}
              </div>
            </FilterSection>
          )}

          {/* In Stock Only */}
          <FilterSection
            title="Availability"
            isExpanded={expandedSections.includes('availability')}
            onToggle={() => toggleSection('availability')}
            accentColor={accentColor}
          >
            <label className="flex items-center gap-3 px-2 py-2 rounded cursor-pointer hover:opacity-80 min-h-[44px]">
              <Checkbox
                checked={filters.inStockOnly ?? false}
                onCheckedChange={(checked) =>
                  onFiltersChange({ ...filters, inStockOnly: !!checked })
                }
              />
              <span className="text-sm">In Stock Only</span>
            </label>
          </FilterSection>

          {/* Price Range */}
          <FilterSection
            title="Price Range"
            isExpanded={expandedSections.includes('price')}
            onToggle={() => toggleSection('price')}
            accentColor={accentColor}
          >
            <div className="px-2 pt-2 pb-4">
              <EnhancedPriceSlider
                value={draft.priceRange}
                onChange={(value) => setDraft(prev => ({ ...prev, priceRange: value }))}
                max={maxPrice}
                step={5}
                accentColor={accentColor}
              />
            </div>
          </FilterSection>
        </div>

        {/* Apply Button */}
        <div
          className="p-4 border-t"
          style={{ borderColor: 'var(--storefront-border, #e5e7eb)' }}
        >
          <Button
            onClick={onClose}
            onClick={handleApply}
            className="w-full py-3 rounded-full text-white font-medium"
            style={{ backgroundColor: accentColor }}
          >
            {resultCount !== undefined
              ? `Show ${resultCount} Product${resultCount !== 1 ? 's' : ''}`
              ? `Show ${resultCount} Result${resultCount !== 1 ? 's' : ''}`
              : 'Apply Filters'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Calculate active filter count for badge display */
export function getActiveFilterCount(filters: FilterState, maxPrice: number): number {
  let count = 0;
  count += filters.categories.length;
  count += filters.strainTypes.length;
  if (filters.priceRange[0] > 0 || filters.priceRange[1] < maxPrice) count += 1;
  if (filters.inStockOnly) count += 1;
  if (filters.thcRange && (filters.thcRange[0] > 0 || filters.thcRange[1] < 100)) count += 1;
  if (filters.cbdRange && (filters.cbdRange[0] > 0 || filters.cbdRange[1] < 100)) count += 1;
  return count;
}

interface FilterSectionProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  count?: number;
  accentColor?: string;
  children: React.ReactNode;
}

function FilterSection({
  title,
  isExpanded,
  onToggle,
  count,
  accentColor,
  children,
}: FilterSectionProps) {
  return (
    <div
      className="border-b pb-4"
      style={{ borderColor: 'var(--storefront-border, #e5e7eb)', opacity: 0.95 }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-2 text-left min-h-[44px]"
        className="w-full flex items-center justify-between py-2 text-left rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-expanded={isExpanded}
      >
        <span className="text-sm font-medium tracking-wide flex items-center gap-2">
          {title}
          {count !== undefined && count > 0 && (
            <span
              className="px-1.5 py-0.5 rounded text-[10px] text-white font-medium"
              style={{ backgroundColor: accentColor }}
            >
              {count}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            'w-4 h-4 opacity-40 transition-transform duration-200',
            isExpanded && 'rotate-180'
          )}
        />
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface FilterTriggerButtonProps {
  onClick: () => void;
  activeCount?: number;
  className?: string;
}

/** Trigger button that opens the filter drawer on mobile */
/** Trigger button for opening the filter drawer on mobile */
export function FilterTriggerButton({
  onClick,
  activeCount,
  accentColor,
  className,
}: FilterTriggerButtonProps) {
}: {
  onClick: () => void;
  activeCount: number;
  accentColor?: string;
  className?: string;
}) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className={cn(
        'gap-2 rounded-full min-h-[44px]',
        'relative gap-2 bg-white/[0.02] border-white/10 text-white/60 hover:bg-white/5 hover:text-white rounded-full',
        className
      )}
    >
      <SlidersHorizontal className="w-4 h-4" />
      Filters
      {activeCount !== undefined && activeCount > 0 && (
        <span className="px-1.5 py-0.5 bg-primary text-primary-foreground rounded-full text-xs font-medium">
          {activeCount}
        </span>
      {activeCount > 0 && (
        <Badge
          className="ml-1 h-5 min-w-5 px-1.5 text-[10px] font-bold text-white border-0"
          style={{ backgroundColor: accentColor ?? '#10b981' }}
        >
          {activeCount}
        </Badge>
      )}
    </Button>
  );
}
