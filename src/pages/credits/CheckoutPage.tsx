/**
 * Credits Checkout Page
 *
 * Protected page for purchasing credit packages.
 * Shows selected package summary, promo discount, total price,
 * billing address collection, and initiates Stripe payment.
 */

import { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  CreditCard,
  Coins,
  Loader2,
  Tag,
  ArrowLeft,
  ShieldCheck,
  Lock,
  Check,
  X,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/hooks/useTenantNavigation';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { validatePromoCode, type PromoCode } from '@/lib/credits/promoCodeService';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

interface CreditPackage {
  id: string;
  credits: number;
  price: number;
  label: string;
  popular?: boolean;
}

interface BillingAddress {
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface PromoDiscount {
  code: string;
  creditsAmount: number;
  promoCode: PromoCode;
}

// ============================================================================
// Constants
// ============================================================================

const PACKAGES: CreditPackage[] = [
  { id: 'starter-pack', credits: 5000, price: 9.99, label: 'Starter Pack' },
  { id: 'growth-pack', credits: 15000, price: 24.99, label: 'Growth Pack', popular: true },
  { id: 'power-pack', credits: 50000, price: 49.99, label: 'Power Pack' },
  { id: 'enterprise-pack', credits: 150000, price: 179.99, label: 'Enterprise Pack' },
];

const INITIAL_BILLING_ADDRESS: BillingAddress = {
  name: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'US',
};

// ============================================================================
// Component
// ============================================================================

export function CheckoutPage() {
  const { tenant } = useTenantAdminAuth();
  const { navigateToAdmin } = useTenantNavigation();
  const location = useLocation();

  // Get selected package from location state or default to growth pack
  const selectedPackageId = (location.state as { packageId?: string })?.packageId || 'growth-pack';
  const selectedPackage = useMemo(
    () => PACKAGES.find((pkg) => pkg.id === selectedPackageId) || PACKAGES[1],
    [selectedPackageId]
  );

  // State
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoDiscount | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [billingAddress, setBillingAddress] = useState<BillingAddress>(INITIAL_BILLING_ADDRESS);
  const [requireBilling, setRequireBilling] = useState(false);

  // Calculate pricing
  const subtotal = selectedPackage.price;
  const discount = appliedPromo ? calculatePromoDiscount(subtotal, appliedPromo) : 0;
  const total = Math.max(0, subtotal - discount);

  // Purchase mutation
  const purchaseMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id) throw new Error('No tenant found');

      const origin = window.location.origin;
      const tenantSlug = tenant.slug || 'admin';

      const { data, error } = await supabase.functions.invoke('purchase-credits', {
        body: {
          tenant_id: tenant.id,
          package_slug: selectedPackage.id,
          success_url: `${origin}/${tenantSlug}/admin/credits/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/${tenantSlug}/admin/credits/checkout`,
          ...(appliedPromo ? { promo_code: appliedPromo.code } : {}),
          ...(requireBilling && billingAddress.name ? { billing_address: billingAddress } : {}),
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to create checkout session');
      }

      if (!data?.checkout_url) {
        throw new Error('No checkout URL returned');
      }

      return data as { checkout_url: string; session_id: string };
    },
    onSuccess: (data) => {
      // Redirect to Stripe Checkout
      window.location.href = data.checkout_url;
    },
    onError: (error: Error) => {
      logger.error('Credit purchase checkout failed', { error: error.message });
      toast.error('Payment failed', {
        description: error.message || 'Unable to start checkout. Please try again.',
      });
    },
  });

  // Promo code validation
  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;

    setIsValidatingPromo(true);
    setPromoError(null);

    try {
      const result = await validatePromoCode(promoCode.trim());

      if (result.valid && result.promoCode) {
        setAppliedPromo({
          code: promoCode.trim().toUpperCase(),
          creditsAmount: result.promoCode.creditsAmount,
          promoCode: result.promoCode,
        });
        setPromoError(null);
        toast.success('Promo code applied!');
      } else {
        setPromoError(result.error || 'Invalid promo code');
        setAppliedPromo(null);
      }
    } catch (err) {
      logger.error('Failed to validate promo code', { error: err });
      setPromoError('Unable to validate code. Please try again.');
      setAppliedPromo(null);
    } finally {
      setIsValidatingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCode('');
    setPromoError(null);
  };

  const handlePromoKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApplyPromo();
    }
  };

  const handleBillingChange = (field: keyof BillingAddress, value: string) => {
    setBillingAddress((prev) => ({ ...prev, [field]: value }));
  };

  const handlePayNow = () => {
    if (requireBilling && !billingAddress.name) {
      toast.error('Please fill in your billing name');
      return;
    }
    purchaseMutation.mutate();
  };

  const isProcessing = purchaseMutation.isPending;

  // If no tenant, show loading
  if (!tenant) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4"
            onClick={() => navigateToAdmin('dashboard')}
            disabled={isProcessing}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-extrabold text-foreground">Checkout</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complete your credit package purchase
          </p>
        </div>

        <div className="space-y-6">
          {/* Package Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Coins className="h-5 w-5 text-primary" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Coins className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{selectedPackage.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedPackage.credits.toLocaleString()} credits
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">
                    {formatCurrency(selectedPackage.price)}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {((selectedPackage.price / selectedPackage.credits) * 100).toFixed(1)}&cent; / credit
                  </p>
                </div>
              </div>

              {/* Features */}
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Check className="h-3.5 w-3.5 text-green-500" />
                  Instant delivery
                </span>
                <span className="flex items-center gap-1">
                  <Check className="h-3.5 w-3.5 text-green-500" />
                  Never expires
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Promo Code */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Tag className="h-4 w-4 text-purple-500" />
                Promo Code
              </CardTitle>
              <CardDescription>Have a promotional code? Apply it for a discount.</CardDescription>
            </CardHeader>
            <CardContent>
              {appliedPromo ? (
                <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-emerald-500" />
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      {appliedPromo.code}
                    </span>
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                      +{appliedPromo.creditsAmount.toLocaleString()} bonus credits
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemovePromo}
                    disabled={isProcessing}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter promo code"
                    value={promoCode}
                    onChange={(e) => {
                      setPromoCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                      setPromoError(null);
                    }}
                    onKeyDown={handlePromoKeyDown}
                    className={cn(
                      'font-mono uppercase',
                      promoError && 'border-red-500 focus-visible:ring-red-500'
                    )}
                    maxLength={20}
                    disabled={isProcessing}
                  />
                  <Button
                    onClick={handleApplyPromo}
                    disabled={!promoCode.trim() || isValidatingPromo || isProcessing}
                    variant="outline"
                  >
                    {isValidatingPromo ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Apply'
                    )}
                  </Button>
                </div>
              )}
              {promoError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{promoError}</p>
              )}
            </CardContent>
          </Card>

          {/* Billing Address (optional, toggleable) */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CreditCard className="h-4 w-4" />
                  Billing Address
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRequireBilling(!requireBilling)}
                  disabled={isProcessing}
                  className="text-xs"
                >
                  {requireBilling ? 'Remove' : 'Add'}
                </Button>
              </div>
              <CardDescription>
                {requireBilling
                  ? 'Enter your billing address for the receipt.'
                  : 'Optional. Add a billing address for your receipt.'}
              </CardDescription>
            </CardHeader>
            {requireBilling && (
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="billing-name">Full Name</Label>
                  <Input
                    id="billing-name"
                    placeholder="John Doe"
                    value={billingAddress.name}
                    onChange={(e) => handleBillingChange('name', e.target.value)}
                    disabled={isProcessing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="billing-line1">Address Line 1</Label>
                  <Input
                    id="billing-line1"
                    placeholder="123 Main St"
                    value={billingAddress.line1}
                    onChange={(e) => handleBillingChange('line1', e.target.value)}
                    disabled={isProcessing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="billing-line2">Address Line 2</Label>
                  <Input
                    id="billing-line2"
                    placeholder="Suite 100"
                    value={billingAddress.line2}
                    onChange={(e) => handleBillingChange('line2', e.target.value)}
                    disabled={isProcessing}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="billing-city">City</Label>
                    <Input
                      id="billing-city"
                      placeholder="San Francisco"
                      value={billingAddress.city}
                      onChange={(e) => handleBillingChange('city', e.target.value)}
                      disabled={isProcessing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing-state">State</Label>
                    <Input
                      id="billing-state"
                      placeholder="CA"
                      value={billingAddress.state}
                      onChange={(e) => handleBillingChange('state', e.target.value)}
                      disabled={isProcessing}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="billing-postal">Postal Code</Label>
                    <Input
                      id="billing-postal"
                      placeholder="94102"
                      value={billingAddress.postalCode}
                      onChange={(e) => handleBillingChange('postalCode', e.target.value)}
                      disabled={isProcessing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing-country">Country</Label>
                    <Input
                      id="billing-country"
                      placeholder="US"
                      value={billingAddress.country}
                      onChange={(e) => handleBillingChange('country', e.target.value)}
                      disabled={isProcessing}
                    />
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Payment Summary & Pay Button */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                Payment
              </CardTitle>
              <CardDescription>
                Secure payment powered by Stripe
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Price Breakdown */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {selectedPackage.label} ({selectedPackage.credits.toLocaleString()} credits)
                  </span>
                  <span className="tabular-nums">{formatCurrency(subtotal)}</span>
                </div>
                {appliedPromo && discount > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
                    <span>Promo discount ({appliedPromo.code})</span>
                    <span className="tabular-nums">-{formatCurrency(discount)}</span>
                  </div>
                )}
                {appliedPromo && (
                  <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
                    <span>Bonus credits</span>
                    <span>+{appliedPromo.creditsAmount.toLocaleString()}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span className="tabular-nums">{formatCurrency(total)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  You will receive{' '}
                  <span className="font-medium">
                    {(selectedPackage.credits + (appliedPromo?.creditsAmount || 0)).toLocaleString()}
                  </span>{' '}
                  credits
                </p>
              </div>

              <Separator />

              {/* Stripe Payment Info */}
              <div className="rounded-lg border border-dashed p-4 text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Lock className="h-4 w-4" />
                  <span className="text-sm">Card details collected securely via Stripe</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  You will be redirected to Stripe&apos;s secure checkout to enter your payment details.
                </p>
              </div>

              {/* Pay Now Button */}
              <Button
                className="w-full h-12 text-base font-semibold"
                size="lg"
                onClick={handlePayNow}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-5 w-5 mr-2" />
                    Pay Now &mdash; {formatCurrency(total)}
                  </>
                )}
              </Button>

              {/* Security Badge */}
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>256-bit SSL encrypted. Your payment info is secure.</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Calculate discount amount from a promo code.
 * Promo codes in this system grant bonus credits rather than price discounts,
 * but we show a monetary value equivalent for clarity.
 */
function calculatePromoDiscount(subtotal: number, promo: PromoDiscount): number {
  // Promo codes grant bonus credits, not direct price discounts.
  // We show a $0 price discount but display the bonus credits separately.
  return 0;
}

export default CheckoutPage;
