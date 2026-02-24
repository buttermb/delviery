/**
 * ProductPricingSection
 * Handles retail, wholesale, and bulk pricing for products
 */

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import Plus from "lucide-react/dist/esm/icons/plus";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import Package from "lucide-react/dist/esm/icons/package";
import Store from "lucide-react/dist/esm/icons/store";
import Building2 from "lucide-react/dist/esm/icons/building-2";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";

interface BulkPriceTier {
  id: string;
  minQuantity: number;
  maxQuantity: number | null;
  price: number;
  discountPercent?: number;
}

interface ProductPricingData {
  cost_per_unit: string;
  retail_price: string;
  wholesale_price: string;
  minimum_price: string;
  exclude_from_discounts: boolean;
  bulk_pricing_enabled: boolean;
  bulk_price_tiers: BulkPriceTier[];
}

interface ProductPricingSectionProps {
  formData: ProductPricingData;
  updateFormData: (data: Partial<ProductPricingData>) => void;
}

export function ProductPricingSection({ formData, updateFormData }: ProductPricingSectionProps) {
  const [showBulkPricing, setShowBulkPricing] = useState(formData.bulk_pricing_enabled || false);

  const costPerUnit = parseFloat(formData.cost_per_unit) || 0;
  const retailPrice = parseFloat(formData.retail_price) || 0;
  const wholesalePrice = parseFloat(formData.wholesale_price) || 0;
  const minimumPrice = parseFloat(formData.minimum_price) || 0;

  // Calculate margins
  const calculateMargin = (price: number) => {
    if (!costPerUnit || !price) return 0;
    return ((price - costPerUnit) / price * 100);
  };

  const retailMargin = calculateMargin(retailPrice);
  const wholesaleMargin = calculateMargin(wholesalePrice);

  const getMarginColor = (margin: number) => {
    if (margin >= 40) return 'text-green-600';
    if (margin >= 20) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getMarginBadgeVariant = (margin: number): 'default' | 'secondary' | 'destructive' => {
    if (margin >= 40) return 'default';
    if (margin >= 20) return 'secondary';
    return 'destructive';
  };

  // Bulk pricing handlers
  const addBulkTier = () => {
    const currentTiers = formData.bulk_price_tiers ?? [];
    const lastTier = currentTiers[currentTiers.length - 1];
    const newMinQty = lastTier ? (lastTier.maxQuantity || lastTier.minQuantity) + 1 : 10;

    const newTier: BulkPriceTier = {
      id: `tier-${Date.now()}`,
      minQuantity: newMinQty,
      maxQuantity: newMinQty + 9,
      price: wholesalePrice || retailPrice || 0,
    };

    updateFormData({
      bulk_price_tiers: [...currentTiers, newTier],
    });
  };

  const updateBulkTier = (tierId: string, updates: Partial<BulkPriceTier>) => {
    const updatedTiers = (formData.bulk_price_tiers ?? []).map((tier) =>
      tier.id === tierId ? { ...tier, ...updates } : tier
    );
    updateFormData({ bulk_price_tiers: updatedTiers });
  };

  const removeBulkTier = (tierId: string) => {
    const updatedTiers = (formData.bulk_price_tiers ?? []).filter((tier) => tier.id !== tierId);
    updateFormData({ bulk_price_tiers: updatedTiers });
  };

  const calculateTierDiscount = (tierPrice: number, basePrice: number): number => {
    if (!basePrice || !tierPrice) return 0;
    return ((basePrice - tierPrice) / basePrice * 100);
  };

  const handleBulkPricingToggle = (enabled: boolean) => {
    setShowBulkPricing(enabled);
    updateFormData({
      bulk_pricing_enabled: enabled,
      bulk_price_tiers: enabled ? (formData.bulk_price_tiers ?? []) : [],
    });
  };

  // Validation helper
  const isPriceBelowMinimum = (price: number) => minimumPrice > 0 && price > 0 && price < minimumPrice;

  return (
    <div className="space-y-6">
      {/* Cost & Base Pricing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Base Pricing
          </CardTitle>
          <CardDescription>
            Set your cost and selling prices for different sales channels
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Cost Per Unit */}
          <div className="space-y-2">
            <Label htmlFor="cost_per_unit" className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Cost Per Unit
            </Label>
            <div className="relative max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="cost_per_unit"
                type="number"
                step="0.01"
                min="0"
                value={formData.cost_per_unit}
                onChange={(e) => updateFormData({ cost_per_unit: e.target.value })}
                placeholder="0.00"
                className="pl-7"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Your internal cost (not shown to customers)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Retail Price */}
            <div className="space-y-2">
              <Label htmlFor="retail_price" className="flex items-center gap-2">
                <Store className="h-4 w-4 text-muted-foreground" />
                Retail Price
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="retail_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.retail_price}
                  onChange={(e) => updateFormData({ retail_price: e.target.value })}
                  placeholder="0.00"
                  className="pl-7"
                />
              </div>
              {retailPrice > 0 && costPerUnit > 0 && (
                <div className="flex items-center gap-2 mt-1">
                  <TrendingUp className={`h-4 w-4 ${getMarginColor(retailMargin)}`} />
                  <span className={`text-sm font-medium ${getMarginColor(retailMargin)}`}>
                    {retailMargin.toFixed(1)}% margin
                  </span>
                  <Badge variant={getMarginBadgeVariant(retailMargin)} className="text-xs">
                    ${(retailPrice - costPerUnit).toFixed(2)} profit
                  </Badge>
                </div>
              )}
              {isPriceBelowMinimum(retailPrice) && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Below minimum price (${minimumPrice.toFixed(2)})
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Price for direct-to-consumer storefront sales
              </p>
            </div>

            {/* Wholesale Price */}
            <div className="space-y-2">
              <Label htmlFor="wholesale_price" className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Wholesale Price
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="wholesale_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.wholesale_price}
                  onChange={(e) => updateFormData({ wholesale_price: e.target.value })}
                  placeholder="0.00"
                  className="pl-7"
                />
              </div>
              {wholesalePrice > 0 && costPerUnit > 0 && (
                <div className="flex items-center gap-2 mt-1">
                  <TrendingUp className={`h-4 w-4 ${getMarginColor(wholesaleMargin)}`} />
                  <span className={`text-sm font-medium ${getMarginColor(wholesaleMargin)}`}>
                    {wholesaleMargin.toFixed(1)}% margin
                  </span>
                  <Badge variant={getMarginBadgeVariant(wholesaleMargin)} className="text-xs">
                    ${(wholesalePrice - costPerUnit).toFixed(2)} profit
                  </Badge>
                </div>
              )}
              {isPriceBelowMinimum(wholesalePrice) && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Below minimum price (${minimumPrice.toFixed(2)})
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Price for B2B wholesale customers
              </p>
            </div>
          </div>

          {/* Margin Comparison */}
          {costPerUnit > 0 && (retailPrice > 0 || wholesalePrice > 0) && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Margin Summary</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {retailPrice > 0 && (
                  <div>
                    <span className="text-muted-foreground">Retail:</span>{' '}
                    <span className={`font-medium ${getMarginColor(retailMargin)}`}>
                      {retailMargin.toFixed(1)}%
                    </span>
                  </div>
                )}
                {wholesalePrice > 0 && (
                  <div>
                    <span className="text-muted-foreground">Wholesale:</span>{' '}
                    <span className={`font-medium ${getMarginColor(wholesaleMargin)}`}>
                      {wholesaleMargin.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Pricing */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Bulk Pricing
              </CardTitle>
              <CardDescription>
                Offer quantity-based discounts for larger orders
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="bulk_pricing_enabled"
                checked={showBulkPricing}
                onCheckedChange={(checked) => handleBulkPricingToggle(checked as boolean)}
              />
              <Label htmlFor="bulk_pricing_enabled" className="cursor-pointer">
                Enable bulk pricing
              </Label>
            </div>
          </div>
        </CardHeader>

        {showBulkPricing && (
          <CardContent className="space-y-4">
            {/* Bulk Tiers */}
            {(formData.bulk_price_tiers ?? []).length > 0 && (
              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-2">
                  <div className="col-span-2">Min Qty</div>
                  <div className="col-span-2">Max Qty</div>
                  <div className="col-span-3">Unit Price</div>
                  <div className="col-span-3">Discount</div>
                  <div className="col-span-2"></div>
                </div>
                {(formData.bulk_price_tiers ?? []).map((tier) => {
                  const basePrice = wholesalePrice || retailPrice;
                  const discount = calculateTierDiscount(tier.price, basePrice);

                  return (
                    <div key={tier.id} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min="1"
                          value={tier.minQuantity}
                          onChange={(e) => updateBulkTier(tier.id, {
                            minQuantity: parseInt(e.target.value) || 1
                          })}
                          placeholder="Min"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min={tier.minQuantity}
                          value={tier.maxQuantity || ''}
                          onChange={(e) => updateBulkTier(tier.id, {
                            maxQuantity: e.target.value ? parseInt(e.target.value) : null
                          })}
                          placeholder="∞"
                        />
                      </div>
                      <div className="col-span-3">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={tier.price}
                            onChange={(e) => updateBulkTier(tier.id, {
                              price: parseFloat(e.target.value) || 0
                            })}
                            placeholder="0.00"
                            className="pl-7"
                          />
                        </div>
                      </div>
                      <div className="col-span-3">
                        {basePrice > 0 && tier.price > 0 && (
                          <Badge
                            variant={discount > 0 ? 'secondary' : 'outline'}
                            className="w-full justify-center"
                          >
                            {discount > 0 ? `-${discount.toFixed(1)}%` : 'No discount'}
                          </Badge>
                        )}
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeBulkTier(tier.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
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
              onClick={addBulkTier}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Price Tier
            </Button>

            {(formData.bulk_price_tiers ?? []).length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No bulk pricing tiers configured</p>
                <p className="text-xs">Add tiers to offer quantity discounts</p>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Pricing Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing Controls</CardTitle>
          <CardDescription>
            Additional pricing rules and restrictions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Minimum Price */}
          <div className="space-y-2">
            <Label htmlFor="minimum_price">Minimum Allowed Price</Label>
            <div className="relative max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="minimum_price"
                type="number"
                step="0.01"
                min="0"
                value={formData.minimum_price}
                onChange={(e) => updateFormData({ minimum_price: e.target.value })}
                placeholder="0.00"
                className="pl-7"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Regulatory minimum — discounts will not reduce the price below this amount
            </p>
          </div>

          {/* Exclude from Discounts */}
          <div className="flex items-start space-x-3 pt-2">
            <Checkbox
              id="exclude_from_discounts"
              checked={formData.exclude_from_discounts}
              onCheckedChange={(checked) =>
                updateFormData({ exclude_from_discounts: checked as boolean })
              }
            />
            <div className="space-y-1">
              <Label htmlFor="exclude_from_discounts" className="cursor-pointer">
                Exclude from Discounts
              </Label>
              <p className="text-xs text-muted-foreground">
                This product will not be eligible for order-level discounts or promotions
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
