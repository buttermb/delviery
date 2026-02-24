/**
 * Expression Input Component
 * Supports inline calculations: 20%, cost + 30%, 100 * 1.08
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Calculator, Percent, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ExpressionInputProps {
  value: number;
  onChange: (value: number) => void;
  baseValue?: number; // For percentage calculations (e.g., subtotal for discounts)
  costValue?: number; // For markup calculations (e.g., cost for markup)
  placeholder?: string;
  className?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  label?: string;
}

interface ParsedExpression {
  type: 'absolute' | 'percentage' | 'markup' | 'math';
  result: number;
  display: string;
}

export function ExpressionInput({
  value,
  onChange,
  baseValue = 0,
  costValue = 0,
  placeholder = 'Enter value or expression',
  className,
  min,
  max,
  disabled = false,
  label,
}: ExpressionInputProps) {
  const [inputValue, setInputValue] = useState(value.toString());
  const [isFocused, setIsFocused] = useState(false);

  // Parse expression and calculate result
  const parseExpression = useCallback((expr: string): ParsedExpression | null => {
    const trimmed = expr.trim();
    if (!trimmed) return null;

    // Percentage: 20%, 15.5%
    const percentMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*%$/);
    if (percentMatch) {
      const percent = parseFloat(percentMatch[1]);
      const result = (baseValue * percent) / 100;
      return {
        type: 'percentage',
        result,
        display: `${percent}% of ${formatCurrency(baseValue)} = ${formatCurrency(result)}`,
      };
    }

    // Markup: cost + 30%, cost * 1.3
    const markupAddMatch = trimmed.match(/^cost\s*\+\s*(\d+(?:\.\d+)?)\s*%$/i);
    if (markupAddMatch) {
      const markup = parseFloat(markupAddMatch[1]);
      const result = costValue * (1 + markup / 100);
      return {
        type: 'markup',
        result,
        display: `${formatCurrency(costValue)} + ${markup}% = ${formatCurrency(result)}`,
      };
    }

    const markupMultMatch = trimmed.match(/^cost\s*\*\s*(\d+(?:\.\d+)?)$/i);
    if (markupMultMatch) {
      const multiplier = parseFloat(markupMultMatch[1]);
      const result = costValue * multiplier;
      return {
        type: 'markup',
        result,
        display: `${formatCurrency(costValue)} x ${multiplier} = ${formatCurrency(result)}`,
      };
    }

    // Simple math: 100 * 1.08, 50 + 10, 100 - 20, 200 / 2
    const mathMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*([\+\-\*\/])\s*(\d+(?:\.\d+)?)$/);
    if (mathMatch) {
      const a = parseFloat(mathMatch[1]);
      const op = mathMatch[2];
      const b = parseFloat(mathMatch[3]);
      let result: number;
      
      switch (op) {
        case '+': result = a + b; break;
        case '-': result = a - b; break;
        case '*': result = a * b; break;
        case '/': result = b !== 0 ? a / b : 0; break;
        default: result = a;
      }

      return {
        type: 'math',
        result,
        display: `${a} ${op} ${b} = ${formatCurrency(result)}`,
      };
    }

    // Plain number
    const numMatch = trimmed.match(/^\$?(\d+(?:\.\d+)?)$/);
    if (numMatch) {
      const result = parseFloat(numMatch[1]);
      return {
        type: 'absolute',
        result,
        display: formatCurrency(result),
      };
    }

    return null;
  }, [baseValue, costValue]);

  // Derive parsed result from input
  const parsedResult = useMemo(() => parseExpression(inputValue), [inputValue, parseExpression]);

  // Sync external value changes
  useEffect(() => {
    if (!isFocused) {
      setInputValue(value.toString());
    }
  }, [value, isFocused]);

  const handleBlur = () => {
    setIsFocused(false);
    
    if (parsedResult) {
      let finalValue = parsedResult.result;
      
      // Apply min/max constraints
      if (min !== undefined) finalValue = Math.max(min, finalValue);
      if (max !== undefined) finalValue = Math.min(max, finalValue);
      
      onChange(finalValue);
      setInputValue(finalValue.toString());
    } else {
      // Reset to original value if invalid
      setInputValue(value.toString());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className={cn('relative', className)}>
      {label && (
        <label className="text-sm font-medium text-foreground mb-1.5 block">
          {label}
        </label>
      )}
      
      <div className="relative">
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'pr-10',
            parsedResult && isFocused && 'border-primary'
          )}
        />
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                <Calculator className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              <p className="font-medium mb-1">Expression Calculator</p>
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li><code>20%</code> → Percentage of base value</li>
                <li><code>cost + 30%</code> → Markup from cost</li>
                <li><code>cost * 1.3</code> → Multiplier markup</li>
                <li><code>100 * 1.08</code> → Basic math</li>
              </ul>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      {/* Result preview */}
      {isFocused && parsedResult && parsedResult.type !== 'absolute' && (
        <div className="mt-1 flex items-center gap-1.5 text-xs">
          {parsedResult.type === 'percentage' && (
            <Percent className="h-3 w-3 text-primary" />
          )}
          {parsedResult.type === 'markup' && (
            <DollarSign className="h-3 w-3 text-green-500" />
          )}
          {parsedResult.type === 'math' && (
            <Calculator className="h-3 w-3 text-blue-500" />
          )}
          <span className="text-muted-foreground">{parsedResult.display}</span>
        </div>
      )}
    </div>
  );
}

// Simplified version for discount fields
export function DiscountInput({
  value,
  onChange,
  subtotal,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  subtotal: number;
  className?: string;
}) {
  return (
    <ExpressionInput
      value={value}
      onChange={onChange}
      baseValue={subtotal}
      placeholder="20% or $50"
      className={className}
      min={0}
      max={subtotal}
      label="Discount"
    />
  );
}

// Simplified version for markup/price fields
export function MarkupInput({
  value,
  onChange,
  cost,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  cost: number;
  className?: string;
}) {
  return (
    <ExpressionInput
      value={value}
      onChange={onChange}
      costValue={cost}
      placeholder="cost + 30% or $99.99"
      className={className}
      min={0}
      label="Price"
    />
  );
}
