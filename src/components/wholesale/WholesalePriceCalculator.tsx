/**
 * Wholesale Price Calculator Component
 * Calculates pricing based on quantity tiers
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { Calculator } from "lucide-react";

interface PricingTier {
  min_quantity: number;
  max_quantity: number | null;
  unit_price: number;
}

interface WholesalePriceCalculatorProps {
  productName: string;
  tiers: PricingTier[];
  basePrice: number;
}

export function WholesalePriceCalculator({
  productName,
  tiers,
  basePrice,
}: WholesalePriceCalculatorProps) {
  const [quantity, setQuantity] = useState(1);

  const calculatePrice = (qty: number): { unitPrice: number; total: number; tierName: string } => {
    const tier = tiers.find(
      t => qty >= t.min_quantity && (t.max_quantity === null || qty <= t.max_quantity)
    );

    const unitPrice = tier?.unit_price || basePrice;
    return {
      unitPrice,
      total: unitPrice * qty,
      tierName: tier
        ? `${tier.min_quantity}-${tier.max_quantity || '+'} units`
        : 'Base price',
    };
  };

  const result = calculatePrice(quantity);
  const savings = (basePrice - result.unitPrice) * quantity;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Price Calculator - {productName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="quantity">Quantity</Label>
          <Input
            id="quantity"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
          />
        </div>

        <div className="space-y-2 bg-muted p-4 rounded-lg">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Tier:</span>
            <span className="font-medium">{result.tierName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Unit Price:</span>
            <span className="font-medium">{formatCurrency(result.unitPrice)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span>Total:</span>
            <span className="text-primary">{formatCurrency(result.total)}</span>
          </div>
          {savings > 0 && (
            <div className="flex justify-between text-success">
              <span className="text-sm">You save:</span>
              <span className="font-medium">{formatCurrency(savings)}</span>
            </div>
          )}
        </div>

        {tiers.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Pricing Tiers</h4>
            {tiers.map((tier, idx) => (
              <div
                key={idx}
                className="flex justify-between text-sm p-2 rounded bg-background border"
              >
                <span>
                  {tier.min_quantity}-{tier.max_quantity || '+'} units
                </span>
                <span className="font-medium">{formatCurrency(tier.unit_price)}/unit</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
