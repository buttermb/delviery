import React, { useState, useMemo, useCallback } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, ChevronDown, Search, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface SelectGroup {
  label: string;
  options: SelectOption[];
}

interface GroupedSelectProps {
  /** Groups of options */
  groups: SelectGroup[];
  /** Currently selected value */
  value?: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Enable search */
  searchable?: boolean;
  /** Search placeholder */
  searchPlaceholder?: string;
  /** Show recent selections */
  showRecent?: boolean;
  /** Storage key for recent selections */
  recentStorageKey?: string;
  /** Maximum recent items to show */
  maxRecent?: number;
  /** Disabled state */
  disabled?: boolean;
  /** Additional class name */
  className?: string;
}

/**
 * GroupedSelect - Dropdown with grouped options, search, and recent selections
 * 
 * Features:
 * - Groups options by category
 * - Search within dropdown
 * - Recent selections (persisted)
 * - Keyboard navigation
 */
export function GroupedSelect({
  groups,
  value,
  onChange,
  placeholder = 'Select option...',
  searchable = true,
  searchPlaceholder = 'Search...',
  showRecent = true,
  recentStorageKey = 'grouped-select-recent',
  maxRecent = 3,
  disabled = false,
  className,
}: GroupedSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  // Get recent selections from localStorage
  const [recentValues, setRecentValues] = useState<string[]>(() => {
    if (!showRecent) return [];
    try {
      const stored = localStorage.getItem(recentStorageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  
  // Find all options flat
  const allOptions = useMemo(() => {
    return groups.flatMap(g => g.options);
  }, [groups]);
  
  // Get selected option
  const selectedOption = useMemo(() => {
    return allOptions.find(o => o.value === value);
  }, [allOptions, value]);
  
  // Filter options by search
  const filteredGroups = useMemo(() => {
    if (!search) return groups;
    
    const query = search.toLowerCase();
    return groups
      .map(group => ({
        ...group,
        options: group.options.filter(
          o => 
            o.label.toLowerCase().includes(query) ||
            o.description?.toLowerCase().includes(query)
        ),
      }))
      .filter(group => group.options.length > 0);
  }, [groups, search]);
  
  // Get recent options
  const recentOptions = useMemo(() => {
    if (!showRecent || recentValues.length === 0) return [];
    
    return recentValues
      .map(v => allOptions.find(o => o.value === v))
      .filter((o): o is SelectOption => o !== undefined)
      .slice(0, maxRecent);
  }, [showRecent, recentValues, allOptions, maxRecent]);
  
  const handleSelect = useCallback((optionValue: string) => {
    onChange(optionValue);
    setOpen(false);
    setSearch('');
    
    // Update recent selections
    if (showRecent) {
      const newRecent = [
        optionValue,
        ...recentValues.filter(v => v !== optionValue),
      ].slice(0, maxRecent + 2); // Keep a few extra
      
      setRecentValues(newRecent);
      try {
        localStorage.setItem(recentStorageKey, JSON.stringify(newRecent));
      } catch {
        // Ignore storage errors
      }
    }
  }, [onChange, showRecent, recentValues, maxRecent, recentStorageKey]);
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between', className)}
        >
          <span className="truncate">
            {selectedOption?.label ?? placeholder}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        {/* Search */}
        {searchable && (
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8"
              />
            </div>
          </div>
        )}
        
        <ScrollArea className="max-h-[300px]">
          <div className="p-1">
            {/* Recent selections */}
            {recentOptions.length > 0 && !search && (
              <div className="mb-2">
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Recent
                </div>
                {recentOptions.map(option => (
                  <SelectItem
                    key={`recent-${option.value}`}
                    option={option}
                    isSelected={value === option.value}
                    onSelect={() => handleSelect(option.value)}
                  />
                ))}
                <div className="my-1 border-b" />
              </div>
            )}
            
            {/* Grouped options */}
            {filteredGroups.map((group, groupIndex) => (
              <div key={group.label} className={cn(groupIndex > 0 && 'mt-2')}>
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  {group.label}
                </div>
                {group.options.map(option => (
                  <SelectItem
                    key={option.value}
                    option={option}
                    isSelected={value === option.value}
                    onSelect={() => handleSelect(option.value)}
                  />
                ))}
              </div>
            ))}
            
            {/* No results */}
            {filteredGroups.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No options found
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

interface SelectItemProps {
  option: SelectOption;
  isSelected: boolean;
  onSelect: () => void;
}

function SelectItem({ option, isSelected, onSelect }: SelectItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={option.disabled}
      className={cn(
        'w-full flex items-start gap-2 rounded-sm px-2 py-1.5 text-sm',
        'hover:bg-accent hover:text-accent-foreground',
        'focus:bg-accent focus:text-accent-foreground focus:outline-none',
        option.disabled && 'opacity-50 cursor-not-allowed',
        isSelected && 'bg-accent'
      )}
    >
      <div className="flex-1 text-left">
        <div className="font-medium">{option.label}</div>
        {option.description && (
          <div className="text-xs text-muted-foreground">{option.description}</div>
        )}
      </div>
      {isSelected && <Check className="h-4 w-4 shrink-0 mt-0.5" />}
    </button>
  );
}

export default GroupedSelect;
