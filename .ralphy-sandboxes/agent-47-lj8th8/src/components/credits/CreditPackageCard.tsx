import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Coins, Loader2, Minus, Plus, Sparkles, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPricePerCredit } from '@/lib/credits/creditCosts';

export interface CreditPackageCardProps {
  /** Unique package identifier */
  id: string;
  /** Display name of the package */
  name: string;
  /** Number of credits in the package */
  credits: number;
  /** Price in cents */
  priceCents: number;
  /** Bonus credits included (highlighted separately) */
  bonusCredits?: number | null;
  /** Badge text (e.g., "POPULAR", "BEST VALUE") */
  badge?: string | null;
  /** Package description */
  description?: string | null;
  /** Whether this package is featured/highlighted */
  isFeatured?: boolean;
  /** Callback when package is selected */
  onSelect: (id: string, quantity: number) => void;
  /** Whether the select action is loading */
  isLoading?: boolean;
  /** Whether the card is disabled (e.g., at purchase limit) */
  isDisabled?: boolean;
  /** Reason for being disabled (shown as tooltip text) */
  disabledReason?: string;
  /** Whether to show a quantity selector */
  showQuantitySelector?: boolean;
  /** Maximum quantity allowed */
  maxQuantity?: number;
  /** Minimum quantity allowed */
  minQuantity?: number;
  /** Base price per credit for savings calculation (uses first/smallest package rate) */
  basePricePerCredit?: number;
}

export function CreditPackageCard({
  id,
  name,
  credits,
  priceCents,
  bonusCredits,
  badge,
  description,
  isFeatured = false,
  onSelect,
  isLoading = false,
  isDisabled = false,
  disabledReason,
  showQuantitySelector = false,
  maxQuantity = 10,
  minQuantity = 1,
  basePricePerCredit,
}: CreditPackageCardProps) {
  const [quantity, setQuantity] = useState(minQuantity);

  const totalCredits = credits + (bonusCredits ?? 0);
  const pricePerCredit = getPricePerCredit(priceCents, totalCredits);
  const priceDisplay = (priceCents / 100).toFixed(2);

  // Calculate savings percentage relative to base price
  const savingsPercent = basePricePerCredit && basePricePerCredit > pricePerCredit
    ? Math.round((1 - pricePerCredit / basePricePerCredit) * 100)
    : 0;

  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => Math.max(minQuantity, Math.min(maxQuantity, prev + delta)));
  };

  const handleSelect = () => {
    onSelect(id, quantity);
  };

  const badgeLabel = badge || (isFeatured ? 'POPULAR' : null);
  const isBestValue = badge?.toUpperCase() === 'BEST VALUE';
  const isPopular = badge?.toUpperCase() === 'POPULAR' || (isFeatured && !badge);

  return (
    <Card
      className={cn(
        'relative flex flex-col transition-shadow hover:shadow-md',
        (isPopular || isFeatured) && 'border-primary ring-2 ring-primary/20',
        isBestValue && 'border-emerald-500 ring-2 ring-emerald-500/20',
        isDisabled && 'opacity-60 pointer-events-none',
      )}
    >
      {/* Featured badge */}
      {badgeLabel && (
        <div
          className={cn(
            'absolute -top-3 left-1/2 -translate-x-1/2 text-xs px-3 py-0.5 rounded-full font-medium whitespace-nowrap',
            isBestValue
              ? 'bg-emerald-500 text-white'
              : 'bg-primary text-primary-foreground',
          )}
        >
          <span className="flex items-center gap-1">
            {isBestValue ? <Sparkles className="w-3 h-3" /> : null}
            {isPopular ? <TrendingUp className="w-3 h-3" /> : null}
            {badgeLabel}
          </span>
        </div>
      )}

      {/* Header: name and credit amount */}
      <CardHeader className="text-center pb-2 pt-5">
        <CardTitle className="text-lg">{name}</CardTitle>
        <div className="flex items-center justify-center gap-1 mt-1">
          <Coins className="w-4 h-4 text-amber-500" />
          <span className="text-xl font-bold">{credits.toLocaleString()}</span>
          {bonusCredits && bonusCredits > 0 ? (
            <span className="text-sm font-semibold text-emerald-600">
              +{bonusCredits.toLocaleString()} bonus
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        ) : null}
      </CardHeader>

      {/* Content: price, per-credit cost, savings */}
      <CardContent className="flex-1 flex flex-col text-center pb-4">
        <div className="text-3xl font-bold">${priceDisplay}</div>
        <p className="text-xs text-muted-foreground mt-1">
          {(pricePerCredit * 100).toFixed(1)}¢ per credit
        </p>

        {/* Savings badge */}
        {savingsPercent > 0 ? (
          <Badge variant="secondary" className="mt-2 mx-auto bg-emerald-100 text-emerald-700 border-emerald-200">
            Save {savingsPercent}%
          </Badge>
        ) : null}

        <div className="flex-1" />

        {/* Quantity selector */}
        {showQuantitySelector ? (
          <div className="flex items-center justify-center gap-3 mt-4">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleQuantityChange(-1)}
              disabled={quantity <= minQuantity || isDisabled}
              aria-label="Decrease quantity"
            >
              <Minus className="w-4 h-4" />
            </Button>
            <span className="text-lg font-medium w-8 text-center">{quantity}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleQuantityChange(1)}
              disabled={quantity >= maxQuantity || isDisabled}
              aria-label="Increase quantity"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        ) : null}

        {/* Select button */}
        <div className="mt-4">
          <Button
            className="w-full"
            variant={(isPopular || isFeatured) ? 'default' : isBestValue ? 'default' : 'outline'}
            disabled={isDisabled || isLoading}
            onClick={handleSelect}
            title={isDisabled ? disabledReason : undefined}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : isDisabled ? (
              disabledReason || 'Limit Reached'
            ) : (
              showQuantitySelector
                ? `Buy ${quantity > 1 ? `${quantity}x ` : ''}— $${((priceCents * quantity) / 100).toFixed(2)}`
                : 'Select Package'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
