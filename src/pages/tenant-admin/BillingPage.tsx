import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// Progress bar implemented inline
import { 
  CreditCard,
  CheckCircle2,
  ExternalLink
} from "lucide-react";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { formatSmartDate } from "@/lib/utils/formatDate";

export default function TenantAdminBillingPage() {
  const { tenant, admin } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  // Fetch invoices
  const { data: invoices } = useQuery({
    queryKey: ["tenant-invoices", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data } = await supabase
        .from("invoices")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("issue_date", { ascending: false })
        .limit(10);

      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch subscription plan details
  const { data: plan } = useQuery({
    queryKey: ["subscription-plan", tenant?.subscription_plan],
    queryFn: async () => {
      if (!tenant?.subscription_plan) return null;

      const { data } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("name", tenant.subscription_plan)
        .maybeSingle();

      return data;
    },
    enabled: !!tenant?.subscription_plan,
  });

  const limits = tenant?.limits || {};
  const usage = tenant?.usage || {};

  const getUsagePercentage = (resource: string) => {
    const limit = limits[resource] === -1 ? Infinity : (limits[resource] || 0);
    const current = usage[resource] || 0;
    if (limit === Infinity) return 0;
    return Math.min((current / limit) * 100, 100);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">💳 Billing & Subscription</h1>
        <p className="text-muted-foreground">Manage your subscription and view billing history</p>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle>✨ Current Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold">
                {plan?.display_name || tenant?.subscription_plan?.toUpperCase()}
              </span>
              <Badge variant="outline">{formatCurrency(tenant?.mrr || 0)}/month</Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {plan?.description || "Your current subscription plan"}
            </p>

            {plan?.features && Array.isArray(plan.features) && (
              <div className="space-y-2 mb-4">
                {plan.features.map((feature: string, index: number) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>{feature.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-4 border-t">
              <Button variant="outline">
                ⬆️ Upgrade to Enterprise
              </Button>
              <Button variant="outline">
                Change Plan
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage This Month */}
      <Card>
        <CardHeader>
          <CardTitle>📊 Usage This Month</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.keys(limits).map((resource) => {
            const limit = limits[resource];
            const current = usage[resource] || 0;
            const isUnlimited = limit === -1;
            const percentage = getUsagePercentage(resource);
            const isOverLimit = !isUnlimited && current > limit;

            return (
              <div key={resource} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="capitalize">{resource.replace(/_/g, " ")}</span>
                  <span className={isOverLimit ? "text-red-600 font-semibold" : ""}>
                    {current.toLocaleString()} / {isUnlimited ? "Unlimited" : limit.toLocaleString()}
                    {!isUnlimited && ` (${percentage.toFixed(0)}%)`}
                  </span>
                </div>
                {!isUnlimited && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${isOverLimit ? "bg-red-500" : "bg-blue-500"}`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                )}
                {isOverLimit && (
                  <p className="text-xs text-red-600">
                    ⚠️ Over limit! Overage charges may apply.
                  </p>
                )}
              </div>
            );
          })}

          {tenant?.usage?.customers && tenant.usage.customers > (limits.customers || 0) && (
            <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500">
              <CardContent className="pt-6">
                <p className="text-sm">
                  <strong>Overage charges:</strong> {formatCurrency(
                    ((tenant.usage.customers - (limits.customers || 0)) * 0.50)
                  )}
                </p>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Payment Method */}
      <Card>
        <CardHeader>
          <CardTitle>💳 Payment Method</CardTitle>
        </CardHeader>
        <CardContent>
          {tenant?.payment_method_added ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5" />
                <div>
                  <p className="font-medium">Payment method on file</p>
                  <p className="text-sm text-muted-foreground">Visa ending in 4242</p>
                </div>
              </div>
              <Button variant="outline">
                Update Payment Method
              </Button>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No payment method added</p>
              <Button>
                Add Payment Method
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card>
        <CardHeader>
          <CardTitle>📄 Billing History</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices && invoices.length > 0 ? (
            <div className="space-y-2">
              {invoices.map((invoice: any) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{invoice.invoice_number}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatSmartDate(invoice.issue_date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(invoice.total || 0)}</p>
                    <Badge variant={invoice.status === "paid" ? "default" : "outline"}>
                      {invoice.status.toUpperCase()}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="sm">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No invoices yet</p>
          )}
        </CardContent>
      </Card>

      <div className="text-center text-sm text-muted-foreground">
        <p>Billing is managed by the platform administrator.</p>
        <p>For changes to your subscription, please contact support.</p>
      </div>
    </div>
  );
}

