/**
 * OrderDiscountModal - Modal for applying discounts to orders
 * Supports percentage, fixed amount, and coupon code discount options
 */

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Percent from "lucide-react/dist/esm/icons/percent";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import Ticket from "lucide-react/dist/esm/icons/ticket";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import X from "lucide-react/dist/esm/icons/x";
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { validateCoupon, type CouponValidationResult } from '@/lib/api/coupons';

export type DiscountType = 'percentage' | 'fixed' | 'coupon';

export interface OrderDiscount {
  type: DiscountType;
  value: number;
  amount: number;
  couponCode?: string;
  couponId?: string;
  description?: string;
}

interface OrderDiscountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId?: string;
  orderSubtotal: number;
  currentDiscount?: OrderDiscount | null;
  userId?: string | null;
  onApplyDiscount: (discount: OrderDiscount | null) => void;
}

export function OrderDiscountModal({
  open,
  onOpenChange,
  orderSubtotal,
  currentDiscount,
  userId = null,
  onApplyDiscount,
}: OrderDiscountModalProps) {
  const [activeTab, setActiveTab] = useState<DiscountType>(currentDiscount?.type || 'percentage');
  const [percentageValue, setPercentageValue] = useState<number>(
    currentDiscount?.type === 'percentage' ? currentDiscount.value : 0
  );
  const [fixedValue, setFixedValue] = useState<number>(
    currentDiscount?.type === 'fixed' ? currentDiscount.value : 0
  );
  const [couponCode, setCouponCode] = useState<string>(currentDiscount?.couponCode || '');
  const [couponValidation, setCouponValidation] = useState<CouponValidationResult | null>(null);

  // Sync form state from props when modal opens with fresh data
  useEffect(() => {
    if (open) {
      setActiveTab(currentDiscount?.type || 'percentage');
      setPercentageValue(currentDiscount?.type === 'percentage' ? currentDiscount.value : 0);
      setFixedValue(currentDiscount?.type === 'fixed' ? currentDiscount.value : 0);
      setCouponCode(currentDiscount?.couponCode || '');
      setCouponValidation(null);
    }
  }, [open, currentDiscount]);

  // Validate coupon mutation
  const validateCouponMutation = useMutation({
    mutationFn: async (code: string) => {
      return validateCoupon(code, userId, orderSubtotal);
    },
    onSuccess: (result) => {
      setCouponValidation(result);
      if (!result.valid) {
        toast.error(result.message || 'Invalid coupon code');
      }
    },
    onError: (error) => {
      logger.error('Failed to validate coupon', error, { component: 'OrderDiscountModal' });
      toast.error('Failed to validate coupon');
      setCouponValidation(null);
    },
  });

  // Calculate discount amount based on type
  const calculateDiscountAmount = (type: DiscountType, value: number): number => {
    if (type === 'percentage') {
      return Math.min((orderSubtotal * value) / 100, orderSubtotal);
    }
    return Math.min(value, orderSubtotal);
  };

  // Get preview of discount amount for display
  const getPreviewAmount = (): number => {
    switch (activeTab) {
      case 'percentage':
        return calculateDiscountAmount('percentage', percentageValue);
      case 'fixed':
        return calculateDiscountAmount('fixed', fixedValue);
      case 'coupon':
        return couponValidation?.valid ? couponValidation.discount : 0;
      default:
        return 0;
    }
  };

  const handleValidateCoupon = () => {
    if (!couponCode.trim()) {
      toast.error('Please enter a coupon code');
      return;
    }
    validateCouponMutation.mutate(couponCode.trim());
  };

  const handleApply = () => {
    let discount: OrderDiscount | null = null;

    switch (activeTab) {
      case 'percentage':
        if (percentageValue <= 0) {
          toast.error('Please enter a valid percentage');
          return;
        }
        if (percentageValue > 100) {
          toast.error('Percentage cannot exceed 100%');
          return;
        }
        discount = {
          type: 'percentage',
          value: percentageValue,
          amount: calculateDiscountAmount('percentage', percentageValue),
          description: `${percentageValue}% off`,
        };
        break;

      case 'fixed':
        if (fixedValue <= 0) {
          toast.error('Please enter a valid amount');
          return;
        }
        if (fixedValue > orderSubtotal) {
          toast.error('Discount cannot exceed order subtotal');
          return;
        }
        discount = {
          type: 'fixed',
          value: fixedValue,
          amount: calculateDiscountAmount('fixed', fixedValue),
          description: `${formatCurrency(fixedValue)} off`,
        };
        break;

      case 'coupon':
        if (!couponValidation?.valid) {
          toast.error('Please validate a coupon first');
          return;
        }
        discount = {
          type: 'coupon',
          value: couponValidation.discount,
          amount: couponValidation.discount,
          couponCode: couponCode.toUpperCase(),
          description: `Coupon ${couponCode.toUpperCase()} - ${
            couponValidation.discountType === 'percentage'
              ? `${couponValidation.discount}% off`
              : `${formatCurrency(couponValidation.discount)} off`
          }`,
        };
        break;
    }

    onApplyDiscount(discount);
    toast.success('Discount applied successfully');
    onOpenChange(false);
  };

  const handleRemoveDiscount = () => {
    onApplyDiscount(null);
    setPercentageValue(0);
    setFixedValue(0);
    setCouponCode('');
    setCouponValidation(null);
    toast.success('Discount removed');
    onOpenChange(false);
  };

  const handleReset = () => {
    setPercentageValue(0);
    setFixedValue(0);
    setCouponCode('');
    setCouponValidation(null);
  };

  const previewAmount = getPreviewAmount();
  const hasCurrentDiscount = currentDiscount && currentDiscount.amount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Apply Discount
          </DialogTitle>
          <DialogDescription>
            Add a percentage, fixed amount, or coupon discount to this order.
          </DialogDescription>
        </DialogHeader>

        {/* Current Discount Badge */}
        {hasCurrentDiscount && (
          <Alert className="border-primary/20 bg-primary/5">
            <CheckCircle className="h-4 w-4 text-primary" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                Current discount: <strong>{currentDiscount.description}</strong> (
                {formatCurrency(currentDiscount.amount)})
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveDiscount}
                className="h-6 px-2 text-destructive hover:text-destructive"
              >
                <X className="h-3 w-3 mr-1" />
                Remove
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Order Subtotal Info */}
        <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
          <span className="text-sm text-muted-foreground">Order Subtotal</span>
          <span className="font-semibold">{formatCurrency(orderSubtotal)}</span>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DiscountType)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="percentage" className="gap-1.5">
              <Percent className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Percentage</span>
            </TabsTrigger>
            <TabsTrigger value="fixed" className="gap-1.5">
              <DollarSign className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Fixed</span>
            </TabsTrigger>
            <TabsTrigger value="coupon" className="gap-1.5">
              <Ticket className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Coupon</span>
            </TabsTrigger>
          </TabsList>

          {/* Percentage Discount */}
          <TabsContent value="percentage" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="percentage-value">Discount Percentage</Label>
              <div className="relative">
                <Input
                  id="percentage-value"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={percentageValue || ''}
                  onChange={(e) => setPercentageValue(Number(e.target.value))}
                  placeholder="Enter percentage"
                  className="pr-10 min-h-[44px] touch-manipulation"
                />
                <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">
                Enter a value between 0 and 100
              </p>
            </div>

            {/* Quick percentage buttons */}
            <div className="flex gap-2">
              {[5, 10, 15, 20, 25].map((pct) => (
                <Button
                  key={pct}
                  type="button"
                  variant={percentageValue === pct ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPercentageValue(pct)}
                  className="flex-1"
                >
                  {pct}%
                </Button>
              ))}
            </div>
          </TabsContent>

          {/* Fixed Amount Discount */}
          <TabsContent value="fixed" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="fixed-value">Discount Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="fixed-value"
                  type="number"
                  min="0"
                  max={orderSubtotal}
                  step="0.01"
                  value={fixedValue || ''}
                  onChange={(e) => setFixedValue(Number(e.target.value))}
                  placeholder="Enter amount"
                  className="pl-10 min-h-[44px] touch-manipulation"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Maximum: {formatCurrency(orderSubtotal)}
              </p>
            </div>

            {/* Quick amount buttons */}
            <div className="flex gap-2">
              {[5, 10, 20, 50].map((amt) => (
                <Button
                  key={amt}
                  type="button"
                  variant={fixedValue === amt ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFixedValue(Math.min(amt, orderSubtotal))}
                  className="flex-1"
                  disabled={amt > orderSubtotal}
                >
                  ${amt}
                </Button>
              ))}
            </div>
          </TabsContent>

          {/* Coupon Code */}
          <TabsContent value="coupon" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="coupon-code">Coupon Code</Label>
              <div className="flex gap-2">
                <Input
                  id="coupon-code"
                  type="text"
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value.toUpperCase());
                    setCouponValidation(null);
                  }}
                  placeholder="Enter coupon code"
                  className="flex-1 min-h-[44px] touch-manipulation uppercase"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleValidateCoupon}
                  disabled={validateCouponMutation.isPending || !couponCode.trim()}
                  className="min-h-[44px] touch-manipulation"
                >
                  {validateCouponMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Validate'
                  )}
                </Button>
              </div>
            </div>

            {/* Validation Result */}
            {couponValidation && (
              <Alert
                variant={couponValidation.valid ? 'default' : 'destructive'}
                className={couponValidation.valid ? 'border-green-500/50 bg-green-500/10' : ''}
              >
                {couponValidation.valid ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  {couponValidation.valid ? (
                    <span className="flex items-center justify-between">
                      <span>
                        Valid! Discount:{' '}
                        <strong>
                          {couponValidation.discountType === 'percentage'
                            ? `${couponValidation.discount}%`
                            : formatCurrency(couponValidation.discount)}
                        </strong>
                      </span>
                      <Badge variant="secondary" className="ml-2">
                        {formatCurrency(couponValidation.discount)} off
                      </Badge>
                    </span>
                  ) : (
                    couponValidation.message
                  )}
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>

        {/* Discount Preview */}
        {previewAmount > 0 && (
          <div className="flex items-center justify-between py-3 px-4 bg-primary/5 border border-primary/20 rounded-lg">
            <span className="text-sm font-medium">Discount Amount</span>
            <span className="text-lg font-bold text-primary">
              -{formatCurrency(previewAmount)}
            </span>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            className="min-h-[44px] touch-manipulation"
          >
            Reset
          </Button>
          <div className="flex gap-2 flex-1 sm:flex-initial">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="flex-1 sm:flex-initial min-h-[44px] touch-manipulation"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleApply}
              disabled={
                (activeTab === 'percentage' && percentageValue <= 0) ||
                (activeTab === 'fixed' && fixedValue <= 0) ||
                (activeTab === 'coupon' && !couponValidation?.valid)
              }
              className="flex-1 sm:flex-initial min-h-[44px] touch-manipulation"
            >
              Apply Discount
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
