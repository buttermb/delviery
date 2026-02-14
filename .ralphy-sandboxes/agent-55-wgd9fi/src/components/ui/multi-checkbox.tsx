import React, { useCallback, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface CheckboxOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  /** Whether this option is recommended/default */
  recommended?: boolean;
}

interface MultiCheckboxProps {
  /** Available options */
  options: CheckboxOption[];
  /** Currently selected values */
  value: string[];
  /** Callback when selection changes */
  onChange: (value: string[]) => void;
  /** Show select all / deselect all buttons */
  showSelectAll?: boolean;
  /** Show selection count */
  showCount?: boolean;
  /** Layout direction */
  direction?: 'horizontal' | 'vertical';
  /** Number of columns for vertical layout */
  columns?: 1 | 2 | 3 | 4;
  /** Disabled state */
  disabled?: boolean;
  /** Additional class name */
  className?: string;
  /** Label for the group */
  label?: string;
  /** Show recommended badge */
  showRecommended?: boolean;
}

/**
 * MultiCheckbox - Checkbox group with select all pattern
 * 
 * Features:
 * - Select All / Deselect All buttons
 * - Selection count indicator
 * - Recommended options highlighting
 * - Flexible grid layout
 */
export function MultiCheckbox({
  options,
  value,
  onChange,
  showSelectAll = true,
  showCount = true,
  direction = 'vertical',
  columns = 1,
  disabled = false,
  className,
  label,
  showRecommended = true,
}: MultiCheckboxProps) {
  // Handle individual checkbox toggle
  const handleToggle = useCallback((optionValue: string, checked: boolean) => {
    if (checked) {
      onChange([...value, optionValue]);
    } else {
      onChange(value.filter(v => v !== optionValue));
    }
  }, [value, onChange]);
  
  // Select all (non-disabled)
  const handleSelectAll = useCallback(() => {
    const selectableValues = options
      .filter(o => !o.disabled)
      .map(o => o.value);
    onChange(selectableValues);
  }, [options, onChange]);
  
  // Deselect all
  const handleDeselectAll = useCallback(() => {
    onChange([]);
  }, [onChange]);
  
  // Select recommended only
  const handleSelectRecommended = useCallback(() => {
    const recommendedValues = options
      .filter(o => o.recommended && !o.disabled)
      .map(o => o.value);
    onChange(recommendedValues);
  }, [options, onChange]);
  
  // Check states
  const allSelected = useMemo(() => {
    const selectableOptions = options.filter(o => !o.disabled);
    return selectableOptions.every(o => value.includes(o.value));
  }, [options, value]);
  
  const noneSelected = value.length === 0;
  
  const hasRecommended = options.some(o => o.recommended);
  
  // Grid classes
  const gridClasses = useMemo(() => {
    if (direction === 'horizontal') {
      return 'flex flex-wrap gap-4';
    }
    
    switch (columns) {
      case 2: return 'grid grid-cols-2 gap-3';
      case 3: return 'grid grid-cols-3 gap-3';
      case 4: return 'grid grid-cols-4 gap-3';
      default: return 'flex flex-col gap-2';
    }
  }, [direction, columns]);
  
  return (
    <div className={cn('space-y-3', className)}>
      {/* Header with label and actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          {label && (
            <span className="text-sm font-medium">{label}</span>
          )}
          {showCount && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {value.length} of {options.length} selected
            </span>
          )}
        </div>
        
        {showSelectAll && (
          <div className="flex items-center gap-2">
            {hasRecommended && showRecommended && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSelectRecommended}
                disabled={disabled}
                className="h-7 text-xs"
              >
                Recommended
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              disabled={disabled || allSelected}
              className="h-7 text-xs"
            >
              Select All
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDeselectAll}
              disabled={disabled || noneSelected}
              className="h-7 text-xs"
            >
              Clear
            </Button>
          </div>
        )}
      </div>
      
      {/* Checkboxes */}
      <div className={gridClasses}>
        {options.map(option => (
          <CheckboxItem
            key={option.value}
            option={option}
            checked={value.includes(option.value)}
            onChange={(checked) => handleToggle(option.value, checked)}
            disabled={disabled || option.disabled}
            showRecommended={showRecommended}
          />
        ))}
      </div>
    </div>
  );
}

interface CheckboxItemProps {
  option: CheckboxOption;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
  showRecommended: boolean;
}

function CheckboxItem({
  option,
  checked,
  onChange,
  disabled,
  showRecommended,
}: CheckboxItemProps) {
  const id = `checkbox-${option.value}`;
  
  return (
    <div className={cn(
      'flex items-start space-x-2 p-2 rounded-md',
      'hover:bg-accent/50 transition-colors',
      option.recommended && showRecommended && 'ring-1 ring-primary/20 bg-primary/5'
    )}>
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        className="mt-0.5"
      />
      <div className="flex-1 space-y-1">
        <Label
          htmlFor={id}
          className={cn(
            'text-sm font-medium cursor-pointer',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          {option.label}
          {option.recommended && showRecommended && (
            <span className="ml-2 text-xs text-primary">Recommended</span>
          )}
        </Label>
        {option.description && (
          <p className="text-xs text-muted-foreground">
            {option.description}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Helper to create checkbox options from enum or array
 */
export function createCheckboxOptions(
  items: string[] | Record<string, string>,
  recommendedValues: string[] = []
): CheckboxOption[] {
  if (Array.isArray(items)) {
    return items.map(item => ({
      value: item,
      label: item.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      recommended: recommendedValues.includes(item),
    }));
  }
  
  return Object.entries(items).map(([value, label]) => ({
    value,
    label,
    recommended: recommendedValues.includes(value),
  }));
}

export default MultiCheckbox;
