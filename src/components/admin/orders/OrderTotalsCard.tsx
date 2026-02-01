/**
 * Order Totals Card Component
 * Displays order pricing breakdown with subtotal, tax, discount, and total
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Receipt, Percent, Tag } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cn } from '@/lib/utils';

interface OrderTotalsCardProps {
  subtotal: number;
  tax: number;
  discount?: number;
  total: number;
  taxRate?: number;
  discountLabel?: string;
  className?: string;
  compact?: boolean;
}

export function OrderTotalsCard({
  subtotal,
  tax,
  discount = 0,
  total,
  taxRate,
  discountLabel,
  className,
  compact = false,
}: OrderTotalsCardProps) {
  const hasDiscount = discount > 0;

  if (compact) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Tax{taxRate ? ` (${(taxRate * 100).toFixed(1)}%)` : ''}
          </span>
          <span>{formatCurrency(tax)}</span>
        </div>
        {hasDiscount && (
          <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
            <span>{discountLabel || 'Discount'}</span>
            <span>-{formatCurrency(discount)}</span>
          </div>
        )}
        <Separator />
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Receipt className="h-5 w-5" />
          Order Totals
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Subtotal */}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium">{formatCurrency(subtotal)}</span>
        </div>

        {/* Tax */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Percent className="h-4 w-4" />
            <span>Tax{taxRate ? ` (${(taxRate * 100).toFixed(1)}%)` : ''}</span>
          </div>
          <span className="font-medium">{formatCurrency(tax)}</span>
        </div>

        {/* Discount */}
        {hasDiscount && (
          <div className="flex items-center justify-between text-green-600 dark:text-green-400">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              <span>{discountLabel || 'Discount'}</span>
            </div>
            <span className="font-medium">-{formatCurrency(discount)}</span>
          </div>
        )}

        <Separator />

        {/* Total */}
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold">Total</span>
          <span className="text-lg font-bold text-primary">
            {formatCurrency(total)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
