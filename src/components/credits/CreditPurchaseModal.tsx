import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Coins, Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { humanizeError } from "@/lib/humanizeError";

interface CreditPurchaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PACKAGES = [
  { id: 'starter-pack', credits: 5000, price: 9.99, label: 'Starter Pack', popular: false },
  { id: 'growth-pack', credits: 15000, price: 24.99, label: 'Growth Pack', popular: true },
  { id: 'power-pack', credits: 50000, price: 49.99, label: 'Power Pack', popular: false },
  { id: 'enterprise-pack', credits: 150000, price: 179.99, label: 'Enterprise Pack', popular: false },
];

export function CreditPurchaseModal({ open, onOpenChange }: CreditPurchaseModalProps) {
  const { tenant } = useTenantAdminAuth();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handlePurchase = async (packageSlug: string) => {
    if (!tenant?.id) {
      toast.error('No tenant found');
      return;
    }

    setLoadingId(packageSlug);

    try {
      const origin = window.location.origin;
      const tenantSlug = tenant.slug || 'admin';
      
      const { data, error } = await supabase.functions.invoke('purchase-credits', {
        body: {
          tenant_id: tenant.id,
          package_slug: packageSlug,
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
        // Open Stripe checkout in new tab
        window.open(data.checkout_url, '_blank', 'noopener,noreferrer');
        toast.success('Checkout opened', { description: 'Complete your purchase in the new tab' });
        onOpenChange(false);
      } else {
        toast.error('No checkout URL returned');
      }
    } catch (err) {
      logger.error('Purchase error', err);
      toast.error('Purchase failed', { description: 'Please try again' });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px]">
        <DialogHeader>
          <DialogTitle>Top Up Credits</DialogTitle>
          <DialogDescription>
            Purchase credits to continue using premium features.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 py-4">
          {PACKAGES.map((pkg) => (
            <Card key={pkg.id} className={`relative ${pkg.popular ? 'border-primary ring-2 ring-primary/20' : ''}`}>
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full font-medium">
                  Best Value
                </div>
              )}
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-lg">{pkg.label}</CardTitle>
                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                  <Coins className="w-4 h-4" />
                  <span>{pkg.credits.toLocaleString()}</span>
                </div>
              </CardHeader>
              <CardContent className="text-center pb-4">
                <div className="text-3xl font-bold">${pkg.price}</div>
                <CardDescription className="text-xs mt-1">
                  ${(pkg.price / pkg.credits * 100).toFixed(1)}¢ / credit
                </CardDescription>

                <ul className="mt-4 space-y-2 text-sm text-left px-2">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Instant delivery</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Never expires</span>
                  </li>
                </ul>
              </CardContent>
              <div className="p-4 pt-0">
                <Button
                  className="w-full"
                  variant={pkg.popular ? "default" : "outline"}
                  disabled={loadingId !== null}
                  onClick={() => handlePurchase(pkg.id)}
                >
                  {loadingId === pkg.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Buy Now'
                  )}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
