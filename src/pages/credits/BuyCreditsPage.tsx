import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Coins, ArrowLeft, Loader2, Tag, Check, Sparkles } from 'lucide-react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useCreditPackages, type CreditPackage } from '@/hooks/useCreditPackages';

// Alias for backwards compatibility
type CreditPackageDisplay = CreditPackage;
import { useCredits } from '@/hooks/useCredits';
import { validatePromoCode } from '@/lib/credits';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { logger } from '@/lib/logger';
import { formatCurrency } from '@/lib/formatters';
import { Skeleton } from '@/components/ui/skeleton';

export function BuyCreditsPage() {
  const { tenant } = useTenantAdminAuth();
  const navigate = useNavigate();
  const { packages, isLoading: packagesLoading, error: packagesError } = useCreditPackages();
  const { balance, isLoading: balanceLoading } = useCredits();

  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState<{ code: string; creditsAmount: number } | null>(null);
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  if (!tenant) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const tenantSlug = tenant.slug || 'admin';

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) {
      toast.error('Please enter a promo code');
      return;
    }

    setIsApplyingPromo(true);
    try {
      const result = await validatePromoCode(promoCode.trim());
      if (result.valid && result.promoCode) {
        setPromoApplied({
          code: result.promoCode.code,
          creditsAmount: result.promoCode.creditsAmount,
        });
        toast.success('Promo code applied!', {
          description: `+${result.promoCode.creditsAmount.toLocaleString()} bonus credits will be added`,
        });
      } else {
        toast.error('Invalid promo code', {
          description: result.error || 'This code is not valid',
        });
      }
    } catch (err) {
      logger.error('Promo code validation failed', err);
      toast.error('Failed to validate promo code', { description: humanizeError(err) });
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const handleCheckout = async () => {
    if (!selectedPackageId) {
      toast.error('Please select a package');
      return;
    }

    const selectedPkg = packages.find(p => p.id === selectedPackageId);
    if (!selectedPkg) return;

    setIsCheckingOut(true);
    try {
      const origin = window.location.origin;

      const { data, error } = await supabase.functions.invoke('purchase-credits', {
        body: {
          tenant_id: tenant.id,
          package_slug: selectedPkg.slug,
          promo_code: promoApplied?.code || undefined,
          success_url: `${origin}/${tenantSlug}/admin/credits/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/${tenantSlug}/admin/credits/cancelled`,
        },
      });

      if (error) {
        logger.error('Purchase error', error);
        toast.error('Failed to start purchase', { description: humanizeError(error) });
        return;
      }

      if (data?.checkout_url) {
        window.open(data.checkout_url, '_blank', 'noopener,noreferrer');
        toast.success('Checkout opened', { description: 'Complete your purchase in the new tab' });
      } else {
        toast.error('No checkout URL returned');
      }
    } catch (err) {
      logger.error('Purchase error', err);
      toast.error('Purchase failed', { description: 'Please try again' });
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (packagesLoading) {
    return (
      <div className="container max-w-6xl mx-auto py-8 px-4">
        <div className="flex items-center gap-4 mb-8">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-72 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (packagesError) {
    return (
      <div className="container max-w-6xl mx-auto py-8 px-4">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load credit packages. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/${tenantSlug}/admin`)}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Buy Credits</h1>
            <p className="text-sm text-muted-foreground">
              Select a package to power your operations
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Coins className="h-4 w-4" />
          <span>Balance: </span>
          {balanceLoading ? (
            <Skeleton className="h-4 w-16 inline-block" />
          ) : (
            <span className="font-semibold text-foreground">{balance.toLocaleString()}</span>
          )}
        </div>
      </div>

      {/* Package Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {packages.map((pkg) => (
          <PackageCard
            key={pkg.id}
            pkg={pkg}
            isSelected={selectedPackageId === pkg.id}
            onSelect={() => setSelectedPackageId(pkg.id)}
          />
        ))}
      </div>

      {/* Promo Code Section */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Promo Code</span>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Enter promo code"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              disabled={!!promoApplied || isApplyingPromo}
              aria-label="Promo code"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApplyPromo();
              }}
            />
            {promoApplied ? (
              <Button variant="outline" disabled className="gap-2 shrink-0">
                <Check className="h-4 w-4 text-green-500" />
                Applied
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={handleApplyPromo}
                disabled={isApplyingPromo || !promoCode.trim()}
                className="shrink-0"
              >
                {isApplyingPromo ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Apply'
                )}
              </Button>
            )}
          </div>
          {promoApplied && (
            <p className="text-sm text-green-600 mt-2">
              +{promoApplied.creditsAmount.toLocaleString()} bonus credits will be added to your purchase
            </p>
          )}
        </CardContent>
      </Card>

      {/* Checkout Button */}
      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={handleCheckout}
          disabled={!selectedPackageId || isCheckingOut}
          className="gap-2 min-w-[200px]"
        >
          {isCheckingOut ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Coins className="h-4 w-4" />
              Proceed to Payment
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function PackageCard({
  pkg,
  isSelected,
  onSelect,
}: {
  pkg: CreditPackageDisplay;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <Card
      className={`relative cursor-pointer transition-all hover:shadow-md ${
        isSelected
          ? 'border-primary ring-2 ring-primary/20'
          : pkg.isFeatured
          ? 'border-primary/50'
          : ''
      }`}
      onClick={onSelect}
    >
      {/* Featured Badge */}
      {pkg.isFeatured && pkg.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge variant="default" className="gap-1">
            <Sparkles className="h-3 w-3" />
            {pkg.badge}
          </Badge>
        </div>
      )}

      {/* Selection Indicator */}
      {isSelected && (
        <div className="absolute top-3 right-3">
          <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
            <Check className="h-3 w-3 text-primary-foreground" />
          </div>
        </div>
      )}

      <CardHeader className="text-center pb-2 pt-6">
        <CardTitle className="text-lg">{pkg.name}</CardTitle>
      </CardHeader>

      <CardContent className="text-center space-y-3">
        {/* Credits Amount */}
        <div>
          <div className="text-3xl font-bold">{pkg.credits.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
            <Coins className="h-3 w-3" />
            credits
          </div>
        </div>

        {/* Bonus Credits */}
        {(pkg.bonus_credits ?? 0) > 0 && (
          <div className="text-sm text-accent-foreground font-medium">
            +{(pkg.bonus_credits ?? 0).toLocaleString()} bonus
          </div>
        )}

        {/* Price */}
        <div className="text-2xl font-semibold">
          {formatCurrency(pkg.price_cents / 100)}
        </div>

        {/* Savings */}
        {pkg.savingsPercent > 0 && (
          <Badge variant="secondary" className="text-accent-foreground">
            Save {pkg.savingsPercent}%
          </Badge>
        )}

        {/* Description */}
        {pkg.description && (
          <p className="text-xs text-muted-foreground">{pkg.description}</p>
        )}
      </CardContent>
    </Card>
  );
}

