import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { DollarSign, X } from 'lucide-react';
import type { InventoryProduct } from './types';

interface StepPricingProps {
  inventory: InventoryProduct[] | undefined;
  selectedProducts: string[];
  customPrices: Record<string, number>;
  onCustomPricesChange: (prices: Record<string, number>) => void;
  applyDiscount: boolean;
  onApplyDiscountChange: (value: boolean) => void;
  discountPercent: number;
  onDiscountPercentChange: (value: number) => void;
}

export function StepPricing({
  inventory,
  selectedProducts,
  customPrices,
  onCustomPricesChange,
  applyDiscount,
  onApplyDiscountChange,
  discountPercent,
  onDiscountPercentChange,
}: StepPricingProps) {
  const setProductPrice = (productId: string, price: number) => {
    onCustomPricesChange({ ...customPrices, [productId]: price });
  };

  const removeCustomPrice = (productId: string) => {
    const next = { ...customPrices };
    delete next[productId];
    onCustomPricesChange(next);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Custom Pricing</h3>
      <p className="text-sm text-muted-foreground">
        Override default prices for selected products or apply a bulk discount.
      </p>

      {/* Bulk discount */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label>Apply Bulk Discount</Label>
            <p className="text-xs text-muted-foreground">
              Apply a percentage discount to all products
            </p>
          </div>
          <Switch checked={applyDiscount} onCheckedChange={onApplyDiscountChange} />
        </div>
        {applyDiscount && (
          <div className="flex items-center gap-3">
            <Label className="shrink-0">Discount %</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={discountPercent}
              onChange={(e) => onDiscountPercentChange(Math.min(50, Math.max(1, parseInt(e.target.value) || 0)))}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        )}
      </div>

      {/* Per-product pricing */}
      <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
        {selectedProducts.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Select products first to set custom prices</p>
          </div>
        ) : (
          selectedProducts.map((productId) => {
            const product = inventory?.find((p) => p.id === productId);
            if (!product) return null;
            const hasCustomPrice = productId in customPrices;
            return (
              <div key={productId} className="flex items-center gap-3 p-3">
                <div className="flex-1">
                  <div className="font-medium text-sm">{product.product_name}</div>
                  <div className="text-xs text-muted-foreground">
                    Default: ${product.base_price ?? 0}/lb
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs shrink-0">Custom $</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder={String(product.base_price ?? 0)}
                    value={hasCustomPrice ? customPrices[productId] : ''}
                    onChange={(e) =>
                      setProductPrice(productId, parseFloat(e.target.value) || 0)
                    }
                    className="w-24 h-8"
                  />
                  {hasCustomPrice && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-11 w-11 p-0"
                      onClick={() => removeCustomPrice(productId)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
