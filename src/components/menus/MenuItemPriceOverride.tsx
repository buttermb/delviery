import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Badge } from '@/components/ui/badge';
import { DollarSign } from 'lucide-react';

interface MenuItemPriceOverrideProps {
  originalPrice: number;
  overridePrice: string;
  onOverridePriceChange: (price: string) => void;
}

export function MenuItemPriceOverride({
  originalPrice,
  overridePrice,
  onOverridePriceChange,
}: MenuItemPriceOverrideProps) {
  const hasOverride = overridePrice && parseFloat(overridePrice) !== originalPrice;

  return (
    <Card className="p-4">
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <DollarSign className="h-4 w-4" />
        Price Override
      </h4>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Original Price</span>
          <Badge variant="secondary">${originalPrice.toFixed(2)}</Badge>
        </div>
        <div className="space-y-2">
          <Label>Menu Price</Label>
          <CurrencyInput
            value={overridePrice}
            onChange={(e) => onOverridePriceChange(e.target.value)}
            placeholder={originalPrice.toFixed(2)}
          />
          {hasOverride && (
            <p className="text-xs text-emerald-600">
              Override active: ${parseFloat(overridePrice).toFixed(2)}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
