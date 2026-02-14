/**
 * Vendor Selector Component
 *
 * Enhanced vendor dropdown for product forms.
 * Shows vendors with their product counts and ratings.
 * Supports auto-population of vendor-specific fields.
 */

import { useState, useEffect, useMemo } from 'react';
import { Check, ChevronsUpDown, Star, Package, Building2, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useVendorsWithStats, type VendorWithStats } from '@/hooks/useVendorsWithStats';

// ============================================================================
// Types
// ============================================================================

interface VendorSelectorProps {
  /** Current vendor name value */
  value: string;
  /** Callback when vendor is selected */
  onChange: (vendorName: string) => void;
  /** Callback with full vendor details for auto-populating fields */
  onVendorSelect?: (vendor: VendorWithStats | null) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Allow creating new vendor names */
  allowCreate?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getRatingColor(rating: number): string {
  if (rating >= 4.5) return 'text-green-600';
  if (rating >= 4) return 'text-green-500';
  if (rating >= 3) return 'text-yellow-500';
  if (rating >= 2) return 'text-orange-500';
  return 'text-red-500';
}

// ============================================================================
// Component
// ============================================================================

export function VendorSelector({
  value,
  onChange,
  onVendorSelect,
  placeholder = 'Select vendor...',
  allowCreate = true,
  disabled = false,
  className,
}: VendorSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const { data: vendors, isLoading } = useVendorsWithStats();

  // Find currently selected vendor
  const selectedVendor = useMemo(() => {
    return vendors?.find((v) => v.name.toLowerCase() === value.toLowerCase()) || null;
  }, [vendors, value]);

  // Filter vendors by search
  const filteredVendors = useMemo(() => {
    if (!vendors) return [];
    if (!searchValue) return vendors;

    const searchLower = searchValue.toLowerCase();
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(searchLower) ||
        v.contact_name?.toLowerCase().includes(searchLower)
    );
  }, [vendors, searchValue]);

  // Check if search value is a new vendor name
  const isNewVendor = useMemo(() => {
    if (!searchValue || !allowCreate) return false;
    return !vendors?.some((v) => v.name.toLowerCase() === searchValue.toLowerCase());
  }, [vendors, searchValue, allowCreate]);

  // Handle vendor selection
  const handleSelect = (vendorName: string) => {
    onChange(vendorName);

    const vendor = vendors?.find((v) => v.name.toLowerCase() === vendorName.toLowerCase()) || null;
    onVendorSelect?.(vendor);

    setOpen(false);
    setSearchValue('');
  };

  // Handle creating new vendor entry
  const handleCreateNew = () => {
    if (searchValue) {
      onChange(searchValue);
      onVendorSelect?.(null);
      setOpen(false);
      setSearchValue('');
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <span className="truncate flex items-center gap-2">
            {value ? (
              <>
                <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                {value}
                {selectedVendor?.avg_rating && (
                  <Badge variant="outline" className="ml-2 flex-shrink-0">
                    <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                    {selectedVendor.avg_rating}
                  </Badge>
                )}
              </>
            ) : (
              placeholder
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search vendors..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading vendors...</span>
              </div>
            ) : (
              <>
                <CommandEmpty>
                  {isNewVendor ? (
                    <div className="px-2 py-3">
                      <p className="text-sm text-muted-foreground mb-2">
                        No vendor found with name &quot;{searchValue}&quot;
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={handleCreateNew}
                      >
                        Use &quot;{searchValue}&quot; as vendor name
                      </Button>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">No vendors found</span>
                  )}
                </CommandEmpty>
                <CommandGroup>
                  {filteredVendors.map((vendor) => (
                    <CommandItem
                      key={vendor.id}
                      value={vendor.name}
                      onSelect={() => handleSelect(vendor.name)}
                      className="flex flex-col items-start gap-1 py-3"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <Check
                            className={cn(
                              'h-4 w-4',
                              value.toLowerCase() === vendor.name.toLowerCase()
                                ? 'opacity-100'
                                : 'opacity-0'
                            )}
                          />
                          <span className="font-medium">{vendor.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Product count badge */}
                          <Badge variant="secondary" className="text-xs">
                            <Package className="h-3 w-3 mr-1" />
                            {vendor.product_count}
                          </Badge>
                          {/* Rating badge */}
                          {vendor.avg_rating && (
                            <Badge variant="outline" className="text-xs">
                              <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                              <span className={getRatingColor(vendor.avg_rating)}>
                                {vendor.avg_rating}
                              </span>
                            </Badge>
                          )}
                        </div>
                      </div>
                      {/* Additional vendor info */}
                      <div className="ml-6 text-xs text-muted-foreground flex items-center gap-3">
                        {vendor.contact_name && (
                          <span>Contact: {vendor.contact_name}</span>
                        )}
                        {vendor.payment_terms && (
                          <span>Terms: {vendor.payment_terms}</span>
                        )}
                        {vendor.lead_time_days !== null && (
                          <span>Lead time: {vendor.lead_time_days}d</span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
