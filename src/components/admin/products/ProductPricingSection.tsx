/**
 * ProductPricingSection
 * A comprehensive pricing section for products with retail, wholesale, and bulk price tiers
 */

import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import Plus from "lucide-react/dist/esm/icons/plus";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import Info from "lucide-react/dist/esm/icons/info";
import Percent from "lucide-react/dist/esm/icons/percent";
import Package from "lucide-react/dist/esm/icons/package";
import { cn } from '@/lib/utils';

export interface BulkPriceTier {
  minQuantity: number;
  price: number;
}

export interface ProductPricingData {
  costPerUnit: string;
  wholesalePrice: string;
  retailPrice: string;
  bulkPriceTiers: BulkPriceTier[];
  excludeFromDiscounts: boolean;
  minimumPrice: string;
}

interface ProductPricingSectionProps {
  data: ProductPricingData;
  onChange: (data: ProductPricingData) => void;
  className?: string;
  showRetailPrice?: boolean;
  showBulkPricing?: boolean;
  showMinimumPrice?: boolean;
  showExcludeDiscounts?: boolean;
}

/**
 * Calculate profit margin percentage
 */
function calculateMargin(cost: string, price: string): number | null {
  const costNum = parseFloat(cost);
  const priceNum = parseFloat(price);
  if (!costNum || !priceNum || costNum <= 0 || priceNum <= 0) return null;
  return ((priceNum - costNum) / priceNum) * 100;
}

/**
 * Calculate profit amount
 */
function calculateProfit(cost: string, price: string): number | null {
  const costNum = parseFloat(cost);
  const priceNum = parseFloat(price);
  if (!costNum || !priceNum) return null;
  return priceNum - costNum;
}

/**
 * Get margin badge color based on percentage
 */
function getMarginColor(margin: number): string {
  if (margin < 10) return 'text-red-600 bg-red-50 border-red-200';
  if (margin < 20) return 'text-amber-600 bg-amber-50 border-amber-200';
  if (margin < 30) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  return 'text-green-600 bg-green-50 border-green-200';
}

export function ProductPricingSection({
  data,
  onChange,
  className,
  showRetailPrice = true,
  showBulkPricing = true,
  showMinimumPrice = true,
  showExcludeDiscounts = true,
}: ProductPricingSectionProps) {
  const [bulkPricingEnabled, setBulkPricingEnabled] = useState(data.bulkPriceTiers.length > 0);

  const handleFieldChange = useCallback(
    (field: keyof ProductPricingData, value: string | boolean | BulkPriceTier[]) => {
      onChange({
        ...data,
        [field]: value,
      });
    },
    [data, onChange]
  );

  const handleAddBulkTier = useCallback(() => {
    const lastTier = data.bulkPriceTiers[data.bulkPriceTiers.length - 1];
    const newMinQuantity = lastTier ? lastTier.minQuantity + 10 : 10;
    const newPrice = lastTier ? Math.max(0, lastTier.price - 0.5) : parseFloat(data.wholesalePrice) || 0;

    handleFieldChange('bulkPriceTiers', [
      ...data.bulkPriceTiers,
      { minQuantity: newMinQuantity, price: newPrice },
    ]);
  }, [data.bulkPriceTiers, data.wholesalePrice, handleFieldChange]);

  const handleRemoveBulkTier = useCallback(
    (index: number) => {
      handleFieldChange(
        'bulkPriceTiers',
        data.bulkPriceTiers.filter((_, i) => i !== index)
      );
    },
    [data.bulkPriceTiers, handleFieldChange]
  );

  const handleBulkTierChange = useCallback(
    (index: number, field: 'minQuantity' | 'price', value: string) => {
      const newTiers = [...data.bulkPriceTiers];
      newTiers[index] = {
        ...newTiers[index],
        [field]: field === 'minQuantity' ? parseInt(value) || 1 : parseFloat(value) || 0,
      };
      handleFieldChange('bulkPriceTiers', newTiers);
    },
    [data.bulkPriceTiers, handleFieldChange]
  );

  const toggleBulkPricing = useCallback(
    (enabled: boolean) => {
      setBulkPricingEnabled(enabled);
      if (!enabled) {
        handleFieldChange('bulkPriceTiers', []);
      } else if (data.bulkPriceTiers.length === 0) {
        handleAddBulkTier();
      }
    },
    [data.bulkPriceTiers.length, handleFieldChange, handleAddBulkTier]
  );

  // Calculate margins for display
  const wholesaleMargin = useMemo(
    () => calculateMargin(data.costPerUnit, data.wholesalePrice),
    [data.costPerUnit, data.wholesalePrice]
  );

  const retailMargin = useMemo(
    () => calculateMargin(data.costPerUnit, data.retailPrice),
    [data.costPerUnit, data.retailPrice]
  );

  const wholesaleProfit = useMemo(
    () => calculateProfit(data.costPerUnit, data.wholesalePrice),
    [data.costPerUnit, data.wholesalePrice]
  );

  const retailProfit = useMemo(
    () => calculateProfit(data.costPerUnit, data.retailPrice),
    [data.costPerUnit, data.retailPrice]
  );

  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Pricing
        </CardTitle>
        <CardDescription>
          Set cost, wholesale, retail, and bulk pricing for this product
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Base Prices */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Cost per Unit */}
          <div className="space-y-2">
            <Label htmlFor="cost-per-unit" className="flex items-center gap-1">
              Cost per Unit
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Your acquisition cost for this product</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="cost-per-unit"
                type="number"
                step="0.01"
                min="0"
                value={data.costPerUnit}
                onChange={(e) => handleFieldChange('costPerUnit', e.target.value)}
                placeholder="0.00"
                className="pl-7"
              />
            </div>
          </div>

          {/* Wholesale Price */}
          <div className="space-y-2">
            <Label htmlFor="wholesale-price" className="flex items-center gap-1">
              Wholesale Price
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Price for B2B/wholesale customers</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="wholesale-price"
                type="number"
                step="0.01"
                min="0"
                value={data.wholesalePrice}
                onChange={(e) => handleFieldChange('wholesalePrice', e.target.value)}
                placeholder="0.00"
                className="pl-7"
              />
            </div>
            {wholesaleMargin !== null && wholesaleProfit !== null && (
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={cn('text-xs', getMarginColor(wholesaleMargin))}>
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {wholesaleMargin.toFixed(1)}% margin
                </Badge>
                <span className="text-xs text-muted-foreground">
                  ${wholesaleProfit.toFixed(2)} profit
                </span>
              </div>
            )}
          </div>

          {/* Retail Price */}
          {showRetailPrice && (
            <div className="space-y-2">
              <Label htmlFor="retail-price" className="flex items-center gap-1">
                Retail Price
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Price for direct consumer sales</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="retail-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={data.retailPrice}
                  onChange={(e) => handleFieldChange('retailPrice', e.target.value)}
                  placeholder="0.00"
                  className="pl-7"
                />
              </div>
              {retailMargin !== null && retailProfit !== null && (
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className={cn('text-xs', getMarginColor(retailMargin))}>
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {retailMargin.toFixed(1)}% margin
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    ${retailProfit.toFixed(2)} profit
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bulk Pricing Section */}
        {showBulkPricing && (
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Bulk Pricing Tiers
                </Label>
                <p className="text-sm text-muted-foreground">
                  Offer discounted prices for larger quantities
                </p>
              </div>
              <Checkbox
                id="bulk-pricing-toggle"
                checked={bulkPricingEnabled}
                onCheckedChange={(checked) => toggleBulkPricing(checked as boolean)}
              />
            </div>

            {bulkPricingEnabled && (
              <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                {data.bulkPriceTiers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No bulk pricing tiers configured
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr,1fr,auto] gap-2 text-xs font-medium text-muted-foreground px-1">
                      <span>Min. Quantity</span>
                      <span>Price per Unit</span>
                      <span className="w-9" />
                    </div>
                    {data.bulkPriceTiers.map((tier, index) => {
                      const tierMargin = calculateMargin(data.costPerUnit, tier.price.toString());
                      return (
                        <div key={index} className="grid grid-cols-[1fr,1fr,auto] gap-2 items-center">
                          <div className="relative">
                            <Input
                              type="number"
                              min="1"
                              value={tier.minQuantity}
                              onChange={(e) => handleBulkTierChange(index, 'minQuantity', e.target.value)}
                              placeholder="10"
                              className="pr-8"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                              +
                            </span>
                          </div>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={tier.price}
                              onChange={(e) => handleBulkTierChange(index, 'price', e.target.value)}
                              placeholder="0.00"
                              className="pl-7"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            {tierMargin !== null && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge
                                      variant="outline"
                                      className={cn('text-[10px] px-1.5 cursor-help', getMarginColor(tierMargin))}
                                    >
                                      {tierMargin.toFixed(0)}%
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Profit margin at this tier</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-11 w-11"
                              onClick={() => handleRemoveBulkTier(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddBulkTier}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Bulk Tier
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Discount and Minimum Price Settings */}
        {(showExcludeDiscounts || showMinimumPrice) && (
          <div className="space-y-4 pt-4 border-t">
            {showExcludeDiscounts && (
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="exclude-discounts"
                  checked={data.excludeFromDiscounts}
                  onCheckedChange={(checked) =>
                    handleFieldChange('excludeFromDiscounts', checked as boolean)
                  }
                />
                <div className="space-y-1">
                  <Label htmlFor="exclude-discounts" className="cursor-pointer">
                    Exclude from Discounts
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    This product will not be eligible for order-level discounts or promotions
                  </p>
                </div>
              </div>
            )}

            {showMinimumPrice && (
              <div className="space-y-2">
                <Label htmlFor="minimum-price" className="flex items-center gap-1">
                  <Percent className="h-4 w-4" />
                  Minimum Allowed Price
                </Label>
                <div className="relative max-w-xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="minimum-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={data.minimumPrice}
                    onChange={(e) => handleFieldChange('minimumPrice', e.target.value)}
                    placeholder="0.00"
                    className="pl-7"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Regulatory minimum — discounts will not reduce the price below this amount
                </p>
              </div>
            )}
          </div>
        )}

        {/* Margin Summary */}
        {data.costPerUnit && (data.wholesalePrice || data.retailPrice) && (
          <div className="p-4 bg-muted rounded-lg">
            <div className="text-sm font-medium mb-3">Margin Summary</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.wholesalePrice && wholesaleMargin !== null && wholesaleProfit !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Wholesale</span>
                  <div className="text-right">
                    <div className="font-semibold text-primary">
                      {wholesaleMargin.toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ${wholesaleProfit.toFixed(2)}/unit
                    </div>
                  </div>
                </div>
              )}
              {showRetailPrice && data.retailPrice && retailMargin !== null && retailProfit !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Retail</span>
                  <div className="text-right">
                    <div className="font-semibold text-primary">
                      {retailMargin.toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ${retailProfit.toFixed(2)}/unit
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
