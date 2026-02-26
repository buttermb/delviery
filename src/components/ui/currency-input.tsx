import * as React from 'react';

import { cn } from '@/lib/utils';
import { Input, type InputProps } from '@/components/ui/input';

/**
 * Filters a keyboard event to only allow numeric characters, decimals, and control keys.
 * Returns true if the key should be blocked.
 */
function shouldBlockKey(e: React.KeyboardEvent<HTMLInputElement>, allowDecimal: boolean, allowNegative = false): boolean {
  // Allow control keys
  if (
    e.key === 'Backspace' ||
    e.key === 'Delete' ||
    e.key === 'Tab' ||
    e.key === 'Escape' ||
    e.key === 'Enter' ||
    e.key === 'ArrowLeft' ||
    e.key === 'ArrowRight' ||
    e.key === 'ArrowUp' ||
    e.key === 'ArrowDown' ||
    e.key === 'Home' ||
    e.key === 'End' ||
    e.ctrlKey ||
    e.metaKey
  ) {
    return false;
  }

  // Allow minus sign at beginning only if allowNegative is true
  if (e.key === '-') {
    if (!allowNegative) return true;
    const target = e.target as HTMLInputElement;
    if (target.selectionStart === 0 && !target.value.includes('-')) {
      return false;
    }
    return true;
  }

  // Allow decimal point (only one)
  if (allowDecimal && (e.key === '.' || e.key === ',')) {
    const target = e.target as HTMLInputElement;
    if (!target.value.includes('.')) {
      return false;
    }
    return true;
  }

  // Allow digits
  if (/^\d$/.test(e.key)) {
    return false;
  }

  return true;
}

/**
 * Formats a numeric value as currency string with 2 decimal places.
 */
function formatCurrency(value: string | number): string {
  if (value === '' || value === undefined || value === null) return '';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '';
  return num.toFixed(2);
}

export interface CurrencyInputProps extends Omit<InputProps, 'type' | 'onChange'> {
  /** Called with the raw numeric string value */
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Called with the parsed number value on change */
  onValueChange?: (value: number | undefined) => void;
  /** Whether to format to 2 decimal places on blur (default: true) */
  formatOnBlur?: boolean;
  /** Whether to show $ prefix (default: true) */
  showPrefix?: boolean;
}

/**
 * CurrencyInput - Accepts only numbers and decimals.
 * Formats to 2 decimal places on blur.
 * Shows $ prefix by default.
 */
const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      className,
      onChange,
      onValueChange,
      onBlur,
      onKeyDown,
      formatOnBlur = true,
      showPrefix = true,
      ...props
    },
    ref,
  ) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (shouldBlockKey(e, true, false)) {
        e.preventDefault();
      }
      onKeyDown?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Strip any non-numeric chars that got through (e.g., paste)
      const raw = e.target.value;
      const cleaned = raw.replace(/[^0-9.]/g, '');

      // Only allow one decimal point
      const parts = cleaned.split('.');
      const sanitized = parts.length > 2
        ? parts[0] + '.' + parts.slice(1).join('')
        : cleaned;

      if (sanitized !== raw) {
        e.target.value = sanitized;
      }

      onChange?.(e);
      if (onValueChange) {
        onValueChange(sanitized === '' ? undefined : parseFloat(sanitized));
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      if (formatOnBlur && e.target.value !== '') {
        const formatted = formatCurrency(e.target.value);
        if (formatted && formatted !== e.target.value) {
          e.target.value = formatted;
          onChange?.({
            ...e,
            target: e.target,
          } as React.ChangeEvent<HTMLInputElement>);
        }
      }
      onBlur?.(e);
    };

    if (showPrefix) {
      return (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            $
          </span>
          <Input
            {...props}
            ref={ref}
            type="text"
            inputMode="decimal"
            step="0.01"
            min="0"
            className={cn('pl-7', className)}
            onKeyDown={handleKeyDown}
            onChange={handleChange}
            onBlur={handleBlur}
          />
        </div>
      );
    }

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="decimal"
        step="0.01"
        min="0"
        className={className}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        onBlur={handleBlur}
      />
    );
  },
);
CurrencyInput.displayName = 'CurrencyInput';

export interface IntegerInputProps extends Omit<InputProps, 'type' | 'onChange'> {
  /** Called with the raw change event */
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Called with the parsed integer value on change */
  onValueChange?: (value: number | undefined) => void;
}

/**
 * IntegerInput - Accepts only whole numbers (integers).
 * Blocks decimal points, letters, and special characters.
 */
const IntegerInput = React.forwardRef<HTMLInputElement, IntegerInputProps>(
  ({ className, onChange, onValueChange, onKeyDown, ...props }, ref) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (shouldBlockKey(e, false)) {
        e.preventDefault();
      }
      onKeyDown?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Strip any non-numeric chars that got through (e.g., paste)
      const raw = e.target.value;
      const cleaned = raw.replace(/[^0-9-]/g, '');

      if (cleaned !== raw) {
        e.target.value = cleaned;
      }

      onChange?.(e);
      if (onValueChange) {
        onValueChange(cleaned === '' ? undefined : parseInt(cleaned, 10));
      }
    };

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        className={className}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
      />
    );
  },
);
IntegerInput.displayName = 'IntegerInput';

export { CurrencyInput, IntegerInput, formatCurrency, shouldBlockKey };
