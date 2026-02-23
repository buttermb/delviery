/**
 * Multi-Item Comparison View
 * Side-by-side comparison of 2-4 items with differences highlighted
 */

import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  X,
  ArrowLeftRight,
  Check,
  Minus,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatSmartDate } from '@/lib/formatters';

interface ComparisonItem {
  id: string;
  name: string;
  image?: string;
  data: Record<string, unknown>;
}

interface FieldConfig {
  key: string;
  label: string;
  format?: (value: unknown) => string;
  type?: 'text' | 'number' | 'currency' | 'boolean' | 'date' | 'array';
  highlight?: 'difference' | 'best' | 'none';
  bestFn?: (values: unknown[]) => number; // Returns index of best value
}

interface ComparisonViewProps {
  items: ComparisonItem[];
  fields: FieldConfig[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemoveItem?: (id: string) => void;
  title?: string;
  emptyMessage?: string;
}

export function ComparisonView({
  items,
  fields,
  open,
  onOpenChange,
  onRemoveItem,
  title = 'Compare Items',
  emptyMessage = 'Select items to compare',
}: ComparisonViewProps) {
  // Calculate differences
  const analysis = useMemo(() => {
    if (items.length < 2) return null;

    const fieldAnalysis = fields.map(field => {
      const values = items.map(item => item.data[field.key]);
      const allSame = values.every(v => JSON.stringify(v) === JSON.stringify(values[0]));
      
      let bestIndex: number | undefined;
      if (field.bestFn && !allSame) {
        bestIndex = field.bestFn(values);
      }

      return {
        key: field.key,
        allSame,
        bestIndex,
        values,
      };
    });

    const differentFieldsCount = fieldAnalysis.filter(f => !f.allSame).length;

    return {
      fields: fieldAnalysis,
      differentFieldsCount,
      totalFields: fields.length,
    };
  }, [items, fields]);

  const formatValue = (value: unknown, field: FieldConfig): string => {
    if (value === null || value === undefined) return '—';
    
    if (field.format) {
      return field.format(value);
    }

    switch (field.type) {
      case 'currency':
        return typeof value === 'number' 
          ? `$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}` 
          : String(value);
      case 'number':
        return typeof value === 'number' ? value.toLocaleString() : String(value);
      case 'boolean':
        return value ? 'Yes' : 'No';
      case 'date':
        return value instanceof Date
          ? formatSmartDate(value)
          : typeof value === 'string' ? formatSmartDate(value) : String(value);
      case 'array':
        return Array.isArray(value) ? value.join(', ') : String(value);
      default:
        return String(value);
    }
  };

  const renderValue = (value: unknown, field: FieldConfig, isBest: boolean, isDifferent: boolean) => {
    const formatted = formatValue(value, field);

    if (field.type === 'boolean') {
      return value ? (
        <Check className={cn('h-4 w-4', isBest ? 'text-green-500' : 'text-muted-foreground')} />
      ) : (
        <Minus className="h-4 w-4 text-muted-foreground/50" />
      );
    }

    return (
      <span className={cn(
        'text-sm',
        isBest && 'font-medium text-green-600',
        isDifferent && !isBest && field.highlight === 'difference' && 'text-amber-600'
      )}>
        {formatted}
      </span>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            {title}
            {analysis && (
              <Badge variant="secondary" className="ml-2">
                {analysis.differentFieldsCount} difference{analysis.differentFieldsCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground py-12">
            <div className="text-center">
              <ArrowLeftRight className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>{emptyMessage}</p>
            </div>
          </div>
        ) : items.length === 1 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground py-12">
            <div className="text-center">
              <AlertTriangle className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Add at least one more item to compare</p>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th scope="col" className="sticky left-0 bg-background z-10 min-w-[120px] p-3 text-left text-sm font-medium text-muted-foreground border-b">
                      Field
                    </th>
                    {items.map(item => (
                      <th
                        key={item.id}
                        scope="col"
                        className="min-w-[150px] p-3 text-center border-b"
                      >
                        <div className="flex flex-col items-center gap-2">
                          {item.image && (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-12 h-12 rounded-md object-cover"
                            />
                          )}
                          <span className="font-medium text-sm">{item.name}</span>
                          {onRemoveItem && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs text-muted-foreground"
                              onClick={() => onRemoveItem(item.id)}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Remove
                            </Button>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, fieldIndex) => {
                    const fieldAnalysis = analysis?.fields[fieldIndex];
                    const isDifferent = fieldAnalysis ? !fieldAnalysis.allSame : false;

                    return (
                      <tr
                        key={field.key}
                        className={cn(
                          'border-b hover:bg-muted/30',
                          isDifferent && 'bg-amber-50/50 dark:bg-amber-950/10'
                        )}
                      >
                        <td className="sticky left-0 bg-inherit z-10 p-3 text-sm font-medium">
                          <div className="flex items-center gap-2">
                            {field.label}
                            {isDifferent && (
                              <Badge variant="outline" className="text-xs px-1.5 py-0 text-amber-600 border-amber-300">
                                differs
                              </Badge>
                            )}
                          </div>
                        </td>
                        {items.map((item, itemIndex) => {
                          const value = item.data[field.key];
                          const isBest = fieldAnalysis?.bestIndex === itemIndex;

                          return (
                            <td
                              key={item.id}
                              className={cn(
                                'p-3 text-center',
                                isBest && 'bg-green-50/50 dark:bg-green-950/10'
                              )}
                            >
                              {renderValue(value, field, isBest, isDifferent)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Comparing {items.length} item{items.length !== 1 ? 's' : ''}
          </p>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook to manage comparison state
export function useComparison<T extends { id: string }>(maxItems = 4) {
  const [items, setItems] = React.useState<T[]>([]);
  const [open, setOpen] = React.useState(false);

  const addItem = (item: T) => {
    if (items.length >= maxItems) {
      return false;
    }
    if (items.some(i => i.id === item.id)) {
      return false;
    }
    setItems(prev => [...prev, item]);
    return true;
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const clearAll = () => {
    setItems([]);
  };

  const isSelected = (id: string) => items.some(i => i.id === id);

  const toggleItem = (item: T) => {
    if (isSelected(item.id)) {
      removeItem(item.id);
    } else {
      addItem(item);
    }
  };

  return {
    items,
    open,
    setOpen,
    addItem,
    removeItem,
    clearAll,
    isSelected,
    toggleItem,
    canAdd: items.length < maxItems,
    count: items.length,
  };
}

// Floating comparison bar
export function ComparisonBar({
  count,
  onCompare,
  onClear,
  className,
}: {
  count: number;
  onCompare: () => void;
  onClear: () => void;
  className?: string;
}) {
  if (count === 0) return null;

  return (
    <div
      className={cn(
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-50',
        'bg-primary text-primary-foreground rounded-full shadow-lg',
        'flex items-center gap-2 px-4 py-2',
        className
      )}
    >
      <Badge variant="secondary" className="rounded-full">
        {count}
      </Badge>
      <span className="text-sm">item{count !== 1 ? 's' : ''} selected</span>
      <Button
        variant="secondary"
        size="sm"
        className="ml-2"
        onClick={onCompare}
        disabled={count < 2}
      >
        <ArrowLeftRight className="h-4 w-4 mr-1" />
        Compare
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-primary-foreground/70 hover:text-primary-foreground"
        onClick={onClear}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
