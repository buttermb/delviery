import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CreditCard, AlertCircle } from "lucide-react";
import { logger } from "@/lib/logger";
import { humanizeError } from '@/lib/humanizeError';
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";

export function TenantStripeCheckout() {
  const { tenant } = useTenantAdminAuth();
  const [loading, setLoading] = useState(false);
  const [priceId, setPriceId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [stripeConfigured, setStripeConfigured] = useState<boolean | null>(null);

  // Check if Stripe is configured
  useEffect(() => {
    checkStripeConfiguration();
  }, [tenant?.id]);

  const checkStripeConfiguration = async () => {
    if (!tenant?.id) return;

    try {
      const { data: account } = await supabase
        .from("accounts")
        .select("id")
        .eq("tenant_id", tenant.id)
        .maybeSingle();

      if (!account) return;

      const { data: settings } = await supabase
        .from("account_settings")
        .select("integration_settings")
        .eq("account_id", account.id)
        .maybeSingle();

      const integrationSettings = settings?.integration_settings as any;
      setStripeConfigured(!!integrationSettings?.stripe_secret_key);
    } catch (error) {
      logger.error("Error checking Stripe configuration:", error);
      setStripeConfigured(false);
    }
  };

  const handleCheckout = async () => {
    if (!priceId) {
      toast.error("Please enter a Stripe Price ID");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("tenant-stripe-checkout", {
        body: {
          line_items: [
            {
              price: priceId,
              quantity: quantity,
            },
          ],
          success_url: `${window.location.origin}/payment-success`,
          cancel_url: `${window.location.origin}/payment-canceled`,
        },
      });

      if (error) throw error;

      if (data.url) {
        window.open(data.url, "_blank");
        toast.success("Opening checkout page...");
      }
    } catch (error: any) {
      logger.error("Checkout error", error, { component: "TenantStripeCheckout" });
      toast.error(humanizeError(error, "Failed to create checkout session"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Test Tenant Stripe Checkout
        </CardTitle>
        <CardDescription>
          Test your Stripe integration by creating a checkout session with your own Stripe credentials
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {stripeConfigured === false && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Stripe Not Configured:</strong> Please configure your Stripe credentials in the Integrations tab first.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="priceId">Stripe Price ID</Label>
          <Input
            id="priceId"
            placeholder="price_abc123xyz"
            value={priceId}
            onChange={(e) => setPriceId(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Enter a Price ID from your Stripe dashboard (Products → Pricing)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="quantity">Quantity</Label>
          <Input
            id="quantity"
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
          />
        </div>

        <Button onClick={handleCheckout} disabled={loading || stripeConfigured === false} className="w-full">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Checkout Session
        </Button>

        <div className="rounded-lg bg-muted p-3 text-sm">
          <p className="font-medium mb-1">Test Card Numbers:</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>• Success: 4242 4242 4242 4242</li>
            <li>• Decline: 4000 0000 0000 0002</li>
            <li>• CVC: Any 3 digits, Date: Any future date</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}