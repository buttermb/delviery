/**
 * Checkout Loyalty Component
 * Displays loyalty points balance, earning estimate, and redemption options at checkout
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useCheckoutLoyalty } from '@/hooks/useLoyaltyPoints';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { Gift, Star, Sparkles, Loader2, Info, X } from 'lucide-react';

interface CheckoutLoyaltyProps {
  storeId: string;
  customerEmail: string;
  orderSubtotal: number;
  onPointsRedeemed: (discount: number, pointsUsed: number) => void;
  onPointsRemoved: () => void;
  redeemedPoints?: number;
  redeemedDiscount?: number;
}

export function CheckoutLoyalty({
  storeId,
  customerEmail,
  orderSubtotal,
  onPointsRedeemed,
  onPointsRemoved,
  redeemedPoints = 0,
  redeemedDiscount = 0,
}: CheckoutLoyaltyProps) {
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [showRedemption, setShowRedemption] = useState(false);

  const {
    isLoading,
    isActive,
    pointsPerDollar,
    pointsToDollarRatio,
    currentPoints,
    pointsToEarn,
    maxRedeemablePoints,
    maxDiscount,
    redeemPointsAsync,
    isRedeeming,
  } = useCheckoutLoyalty(storeId, customerEmail, orderSubtotal);

  // Don't render if loyalty is not active or still loading
  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 border-purple-200 dark:border-purple-800">
        <CardContent className="p-4 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
        </CardContent>
      </Card>
    );
  }

  if (!isActive) {
    return null;
  }

  // Calculate discount for current slider value
  const selectedDiscount = pointsToRedeem / pointsToDollarRatio;

  // Handle redemption
  const handleRedeem = async () => {
    if (pointsToRedeem <= 0) return;

    try {
      const result = await redeemPointsAsync({
        storeId,
        customerEmail,
        pointsToRedeem,
      });

      onPointsRedeemed(result.discount_amount, pointsToRedeem);
      setShowRedemption(false);
      setPointsToRedeem(0);

      toast.success('Points Redeemed!', {
        description: `You saved ${formatCurrency(result.discount_amount)} with ${pointsToRedeem} points.`,
      });
    } catch (error) {
      toast.error('Failed to redeem points', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    }
  };

  // Handle removal of redeemed points
  const handleRemoveRedemption = () => {
    onPointsRemoved();
    toast.info('Points removed', {
      description: 'Loyalty discount has been removed from your order.',
    });
  };

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 border-purple-200 dark:border-purple-800">
      <CardContent className="p-4 space-y-3">
        {/* Header with Icon */}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-full">
            <Star className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm text-purple-900 dark:text-purple-100">
              Loyalty Points
            </h3>
            <p className="text-sm text-purple-600 dark:text-purple-400">
              Earn & redeem points on every order
            </p>
          </div>
        </div>

        <Separator className="bg-purple-200 dark:bg-purple-800" />

        {/* Points Balance */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-purple-700 dark:text-purple-300">Your Balance</span>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
              <Sparkles className="w-3 h-3 mr-1" />
              {currentPoints.toLocaleString()} pts
            </Badge>
            {currentPoints > 0 && (
              <span className="text-sm text-purple-500">
                (worth {formatCurrency(currentPoints / pointsToDollarRatio)})
              </span>
            )}
          </div>
        </div>

        {/* Points to Earn */}
        <div className="flex items-center justify-between bg-green-50 dark:bg-green-950/30 p-2 rounded-lg">
          <span className="text-sm text-green-700 dark:text-green-300 flex items-center gap-1">
            <Gift className="w-4 h-4" />
            You'll earn on this order
          </span>
          <Badge className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border-0">
            +{pointsToEarn} pts
          </Badge>
        </div>

        {/* Active Redemption Display */}
        {redeemedPoints > 0 && (
          <div className="flex items-center justify-between bg-purple-100 dark:bg-purple-900/50 p-3 rounded-lg">
            <div>
              <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                {redeemedPoints} points applied
              </p>
              <p className="text-sm text-purple-600 dark:text-purple-400">
                Saving {formatCurrency(redeemedDiscount)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveRedemption}
              className="text-purple-600 hover:text-purple-800 hover:bg-purple-200"
            >
              <X className="w-4 h-4 mr-1" />
              Remove
            </Button>
          </div>
        )}

        {/* Redemption UI */}
        {!redeemedPoints && currentPoints > 0 && maxRedeemablePoints > 0 && (
          <>
            {!showRedemption ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRedemption(true)}
                className="w-full border-purple-300 text-purple-700 hover:bg-purple-100 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-900/50"
              >
                <Gift className="w-4 h-4 mr-2" />
                Redeem Points (up to {formatCurrency(maxDiscount)} off)
              </Button>
            ) : (
              <div className="space-y-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Points to redeem</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowRedemption(false);
                      setPointsToRedeem(0);
                    }}
                    className="h-9 w-9 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <Slider
                  value={[pointsToRedeem]}
                  onValueChange={([value]) => setPointsToRedeem(value)}
                  max={maxRedeemablePoints}
                  step={Math.ceil(pointsToDollarRatio / 10)} // Step by 10 cents worth
                  className="w-full"
                />

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">0 pts</span>
                  <span className="font-medium text-purple-600">
                    {pointsToRedeem} pts = {formatCurrency(selectedDiscount)}
                  </span>
                  <span className="text-muted-foreground">{maxRedeemablePoints} pts</span>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPointsToRedeem(Math.floor(maxRedeemablePoints / 2))}
                    className="flex-1 text-sm"
                  >
                    Use Half
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPointsToRedeem(maxRedeemablePoints)}
                    className="flex-1 text-sm"
                  >
                    Use All
                  </Button>
                </div>

                <Button
                  onClick={handleRedeem}
                  disabled={pointsToRedeem <= 0 || isRedeeming}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {isRedeeming ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Redeeming...
                    </>
                  ) : (
                    <>
                      <Gift className="w-4 h-4 mr-2" />
                      Redeem {pointsToRedeem} pts for {formatCurrency(selectedDiscount)} off
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}

        {/* Earning Info */}
        <div className="flex items-start gap-2 text-sm text-purple-600 dark:text-purple-400">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>
            Earn {pointsPerDollar} point{pointsPerDollar !== 1 ? 's' : ''} per dollar spent.
            {pointsToDollarRatio} points = $1 discount.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
