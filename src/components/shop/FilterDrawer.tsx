/**
 * FilterDrawer - Mobile-friendly filter panel
 * Slides in from left on mobile, sidebar on desktop
 */

import { motion, AnimatePresence } from 'framer-motion';
import { X, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { EnhancedPriceSlider } from './EnhancedPriceSlider';

export interface FilterState {
  categories: string[];
  strainTypes: string[];
  priceRange: [number, number];
  sortBy: string;
}

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  availableCategories: string[];
  availableStrainTypes: string[];
  maxPrice: number;
  accentColor?: string;
}

const SORT_OPTIONS = [
  { value: 'name', label: 'Name A-Z' },
  { value: 'name-desc', label: 'Name Z-A' },
  { value: 'price', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest First' },
];

export function FilterDrawer({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  availableCategories,
  availableStrainTypes,
  maxPrice,
  accentColor = '#10b981',
}: FilterDrawerProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>(['categories', 'price', 'sort']);

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  const toggleCategory = (category: string) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter(c => c !== category)
      : [...filters.categories, category];
    onFiltersChange({ ...filters, categories: newCategories });
  };

  const toggleStrainType = (strainType: string) => {
    const newStrainTypes = filters.strainTypes.includes(strainType)
      ? filters.strainTypes.filter(s => s !== strainType)
      : [...filters.strainTypes, strainType];
    onFiltersChange({ ...filters, strainTypes: newStrainTypes });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      categories: [],
      strainTypes: [],
      priceRange: [0, maxPrice],
      sortBy: 'name',
    });
  };

  const activeFilterCount =
    filters.categories.length +
    filters.strainTypes.length +
    (filters.priceRange[0] > 0 || filters.priceRange[1] < maxPrice ? 1 : 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop - mobile only */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-0 top-0 bottom-0 w-full max-w-xs bg-neutral-950 border-r border-white/10 z-50 flex flex-col lg:relative lg:z-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-white/60" />
                <h3 className="text-white font-light tracking-wide">Filters</h3>
                {activeFilterCount > 0 && (
                  <span className="px-2 py-0.5 bg-white/10 rounded-full text-white/60 text-xs">
                    {activeFilterCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearAllFilters}
                    className="text-xs text-white/40 hover:text-white transition-colors"
                  >
                    Clear all
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1 rounded hover:bg-white/10 transition-colors lg:hidden"
                >
                  <X className="w-5 h-5 text-white/60" />
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
              >
                <div className="space-y-2">
                  {SORT_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => onFiltersChange({ ...filters, sortBy: option.value })}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                        filters.sortBy === option.value
                          ? 'bg-white/10 text-white'
                          : 'text-white/50 hover:bg-white/5 hover:text-white/70'
                      )}
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
                >
                  <div className="space-y-2">
                    {availableCategories.map(category => (
                      <label
                        key={category}
                        className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer group"
                      >
                        <Checkbox
                          checked={filters.categories.includes(category)}
                          onCheckedChange={() => toggleCategory(category)}
                          className="border-white/30 data-[state=checked]:bg-white data-[state=checked]:border-white"
                        />
                        <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors">
                          {category}
                        </span>
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
                >
                  <div className="space-y-2">
                    {availableStrainTypes.map(strain => (
                      <label
                        key={strain}
                        className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer group"
                      >
                        <Checkbox
                          checked={filters.strainTypes.includes(strain)}
                          onCheckedChange={() => toggleStrainType(strain)}
                          className="border-white/30 data-[state=checked]:bg-white data-[state=checked]:border-white"
                        />
                        <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors">
                          {strain}
                        </span>
                      </label>
                    ))}
                  </div>
                </FilterSection>
              )}

              {/* Price Range - Enhanced Slider */}
              <FilterSection
                title="Price Range"
                isExpanded={expandedSections.includes('price')}
                onToggle={() => toggleSection('price')}
              >
                <div className="px-2 pt-2 pb-4">
                  <EnhancedPriceSlider
                    value={filters.priceRange}
                    onChange={(value) => onFiltersChange({ ...filters, priceRange: value })}
                    max={maxPrice}
                    step={5}
                    accentColor={accentColor}
                    className="[&_input]:bg-white/5 [&_input]:border-white/10 [&_input]:text-white [&_label]:text-white/50 [&_button]:border-white/20 [&_button]:text-white/60 [&_button:hover]:bg-white/10"
                  />
                </div>
              </FilterSection>
            </div>

            {/* Apply Button - Mobile */}
            <div className="p-4 border-t border-white/10 lg:hidden">
              <Button
                onClick={onClose}
                className="w-full py-3 rounded-full"
                style={{ backgroundColor: accentColor }}
              >
                Apply Filters
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Collapsible filter section
function FilterSection({
  title,
  isExpanded,
  onToggle,
  count,
  children,
}: {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-white/5 pb-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-2 text-left"
      >
        <span className="text-white/80 text-sm font-medium tracking-wide flex items-center gap-2">
          {title}
          {count !== undefined && count > 0 && (
            <span className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] text-white/60">
              {count}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-white/40 transition-transform duration-200',
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

// Trigger button for mobile
export function FilterTriggerButton({
  onClick,
  activeCount,
  className,
}: {
  onClick: () => void;
  activeCount?: number;
  className?: string;
}) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className={cn(
        'gap-2 bg-white/[0.02] border-white/10 text-white/60 hover:bg-white/5 hover:text-white rounded-full',
        className
      )}
    >
      <SlidersHorizontal className="w-4 h-4" />
      Filters
      {activeCount !== undefined && activeCount > 0 && (
        <span className="px-1.5 py-0.5 bg-white/20 rounded-full text-xs">{activeCount}</span>
      )}
    </Button>
  );
}
