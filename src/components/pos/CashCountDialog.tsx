import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calculator, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useCashDrawer, calculateCashCountTotal, type CashCount } from '@/hooks/useCashDrawer';
import { formatCurrency } from '@/lib/formatters';

interface CashCountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expectedAmount: number;
  shiftId: string | undefined;
}

const defaultCashCount: CashCount = {
  pennies: 0,
  nickels: 0,
  dimes: 0,
  quarters: 0,
  ones: 0,
  fives: 0,
  tens: 0,
  twenties: 0,
  fifties: 0,
  hundreds: 0,
};

const denominations: { key: keyof CashCount; label: string; value: number }[] = [
  { key: 'pennies', label: 'Pennies', value: 0.01 },
  { key: 'nickels', label: 'Nickels', value: 0.05 },
  { key: 'dimes', label: 'Dimes', value: 0.10 },
  { key: 'quarters', label: 'Quarters', value: 0.25 },
  { key: 'ones', label: '$1 Bills', value: 1.00 },
  { key: 'fives', label: '$5 Bills', value: 5.00 },
  { key: 'tens', label: '$10 Bills', value: 10.00 },
  { key: 'twenties', label: '$20 Bills', value: 20.00 },
  { key: 'fifties', label: '$50 Bills', value: 50.00 },
  { key: 'hundreds', label: '$100 Bills', value: 100.00 },
];

export function CashCountDialog({ open, onOpenChange, expectedAmount, shiftId }: CashCountDialogProps) {
  const [cashCount, setCashCount] = useState<CashCount>(defaultCashCount);
  const { addCash, removeCash, isPending } = useCashDrawer(shiftId);

  const total = useMemo(() => calculateCashCountTotal(cashCount), [cashCount]);
  const variance = total - expectedAmount;
  const hasVariance = Math.abs(variance) > 0.01;
  const isOver = variance > 0;

  const handleCountChange = (key: keyof CashCount, value: string) => {
    const numValue = parseInt(value) || 0;
    setCashCount(prev => ({
      ...prev,
      [key]: Math.max(0, numValue),
    }));
  };

  const handleQuickAdd = (key: keyof CashCount, amount: number) => {
    setCashCount(prev => ({
      ...prev,
      [key]: Math.max(0, prev[key] + amount),
    }));
  };

  const handleReset = () => {
    setCashCount(defaultCashCount);
  };

  const handleSubmit = async () => {
    // Record the variance as a cash drawer event if there's a difference
    if (hasVariance && shiftId) {
      if (isOver) {
        await addCash(variance, `Cash count: Over by ${formatCurrency(variance)}`);
      } else {
        await removeCash(Math.abs(variance), `Cash count: Short by ${formatCurrency(Math.abs(variance))}`);
      }
    }

    setCashCount(defaultCashCount);
    onOpenChange(false);
  };

  const handleClose = () => {
    setCashCount(defaultCashCount);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Count Cash Drawer
          </DialogTitle>
          <DialogDescription>
            Count each denomination in the drawer
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Expected vs Counted Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Expected</p>
              <p className="text-lg font-bold">{formatCurrency(expectedAmount)}</p>
            </div>
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
              <p className="text-xs text-muted-foreground mb-1">Counted</p>
              <p className="text-lg font-bold">{formatCurrency(total)}</p>
            </div>
          </div>

          {/* Variance Display */}
          {total > 0 && (
            <div className={`p-3 rounded-lg flex items-center justify-between ${
              hasVariance
                ? isOver
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
                : 'bg-green-50 border border-green-200'
            }`}>
              <div className="flex items-center gap-2">
                {hasVariance ? (
                  <AlertTriangle className={`h-4 w-4 ${isOver ? 'text-green-600' : 'text-red-600'}`} />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                )}
                <span className="text-sm font-medium">
                  {hasVariance ? (isOver ? 'Over' : 'Short') : 'Balanced'}
                </span>
              </div>
              <Badge variant={hasVariance ? (isOver ? 'default' : 'destructive') : 'secondary'}>
                {hasVariance ? `${isOver ? '+' : '-'}${formatCurrency(Math.abs(variance))}` : 'Exact'}
              </Badge>
            </div>
          )}

          <Separator />

          {/* Denomination Inputs */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Denomination Counts</h4>

            {/* Bills */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Bills</p>
              <div className="grid grid-cols-2 gap-2">
                {denominations.filter(d => d.value >= 1).reverse().map(({ key, label, value }) => (
                  <div key={key} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                    <div className="flex-1">
                      <Label htmlFor={key} className="text-xs font-medium">{label}</Label>
                      <p className="text-xs text-muted-foreground">
                        = {formatCurrency(cashCount[key] * value)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleQuickAdd(key, -1)}
                        disabled={cashCount[key] <= 0}
                      >
                        -
                      </Button>
                      <Input
                        id={key}
                        type="number"
                        min="0"
                        value={cashCount[key] || ''}
                        onChange={(e) => handleCountChange(key, e.target.value)}
                        className="w-16 h-8 text-center text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleQuickAdd(key, 1)}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Coins */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Coins</p>
              <div className="grid grid-cols-2 gap-2">
                {denominations.filter(d => d.value < 1).reverse().map(({ key, label, value }) => (
                  <div key={key} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                    <div className="flex-1">
                      <Label htmlFor={key} className="text-xs font-medium">{label}</Label>
                      <p className="text-xs text-muted-foreground">
                        = {formatCurrency(cashCount[key] * value)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleQuickAdd(key, -1)}
                        disabled={cashCount[key] <= 0}
                      >
                        -
                      </Button>
                      <Input
                        id={key}
                        type="number"
                        min="0"
                        value={cashCount[key] || ''}
                        onChange={(e) => handleCountChange(key, e.target.value)}
                        className="w-16 h-8 text-center text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleQuickAdd(key, 1)}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleReset} disabled={isPending}>
            Reset
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || total === 0}>
            {isPending ? 'Saving...' : 'Confirm Count'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
