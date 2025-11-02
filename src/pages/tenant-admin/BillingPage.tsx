import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CreditCard,
  CheckCircle2,
  ExternalLink,
  TrendingUp,
  AlertCircle
} from "lucide-react";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { formatSmartDate } from "@/lib/utils/formatDate";
import { ErrorState } from "@/components/shared/ErrorState";
import { SuccessState } from "@/components/shared/SuccessState";

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

  const limits = (tenant as any)?.limits || {};
  const usage = (tenant as any)?.usage || {};

  const getUsagePercentage = (resource: string) => {
    const limit = limits[resource] === -1 ? Infinity : (limits[resource] || 0);
    const current = usage[resource] || 0;
    if (limit === Infinity) return 0;
    return Math.min((current / limit) * 100, 100);
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--tenant-bg))] p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-[hsl(var(--tenant-text))] mb-2">💳 Billing & Subscription</h1>
          <p className="text-[hsl(var(--tenant-text-light))]">Manage your subscription and view billing history</p>
        </div>

        {/* Current Plan */}
        <Card className="bg-white border-[hsl(var(--tenant-border))] shadow-sm">
          <CardHeader>
            <CardTitle className="text-[hsl(var(--tenant-text))] flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[hsl(var(--tenant-primary))]" />
              Current Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-bold text-[hsl(var(--tenant-text))]">
                  {plan?.display_name || (tenant?.subscription_plan as string)?.toUpperCase() || "No Plan"}
                </span>
                <Badge 
                  variant="outline" 
                  className="border-[hsl(var(--tenant-primary))] text-[hsl(var(--tenant-primary))] bg-[hsl(var(--tenant-primary))]/5"
                >
                  {formatCurrency((tenant as any)?.mrr || 0)}/month
                </Badge>
              </div>
              <p className="text-sm text-[hsl(var(--tenant-text-light))] mb-4">
                {plan?.description || "Your current subscription plan"}
              </p>

              {plan?.features && Array.isArray(plan.features) && (
                <div className="space-y-2 mb-4">
                  {plan.features.map((feature: string, index: number) => (
                    <div key={index} className="flex items-center gap-2 text-sm text-[hsl(var(--tenant-text))]">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>{feature.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t border-[hsl(var(--tenant-border))]">
                <Button 
                  variant="outline"
                  className="border-[hsl(var(--tenant-primary))] text-[hsl(var(--tenant-primary))] hover:bg-[hsl(var(--tenant-primary))]/10"
                >
                  ⬆️ Upgrade Plan
                </Button>
                <Button 
                  variant="outline"
                  className="border-[hsl(var(--tenant-border))] text-[hsl(var(--tenant-text))] hover:bg-[hsl(var(--tenant-surface))]"
                >
                  Change Plan
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Usage This Month */}
        <Card className="bg-white border-[hsl(var(--tenant-border))] shadow-sm">
          <CardHeader>
            <CardTitle className="text-[hsl(var(--tenant-text))]">📊 Usage This Month</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.keys(limits).length > 0 ? (
              Object.keys(limits).map((resource) => {
                const limit = limits[resource];
                const current = usage[resource] || 0;
                const isUnlimited = limit === -1;
                const percentage = getUsagePercentage(resource);
                const isOverLimit = !isUnlimited && current > limit;

                return (
                  <div key={resource} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize text-[hsl(var(--tenant-text))]">{resource.replace(/_/g, " ")}</span>
                      <span className={isOverLimit ? "text-red-600 font-semibold" : "text-[hsl(var(--tenant-text-light))]"}>
                        {current.toLocaleString()} / {isUnlimited ? "Unlimited" : limit.toLocaleString()}
                        {!isUnlimited && ` (${percentage.toFixed(0)}%)`}
                      </span>
                    </div>
                    {!isUnlimited && (
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            isOverLimit 
                              ? "bg-red-500" 
                              : percentage > 80 
                                ? "bg-yellow-500" 
                                : "bg-[hsl(var(--tenant-primary))]"
                          }`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                    )}
                    {isOverLimit && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Over limit! Overage charges may apply.
                      </p>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-[hsl(var(--tenant-text-light))] text-center py-4">No usage limits configured</p>
            )}

            {usage?.customers && limits?.customers && usage.customers > limits.customers && (
              <Card className="bg-yellow-50 border-yellow-500 border-2">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <p className="text-sm font-medium text-yellow-900">Overage Charges</p>
                  </div>
                  <p className="text-sm text-yellow-800">
                    <strong>{formatCurrency(
                      ((usage.customers - limits.customers) * 0.50)
                    )}</strong> for exceeding customer limit
                  </p>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card className="bg-white border-[hsl(var(--tenant-border))] shadow-sm">
          <CardHeader>
            <CardTitle className="text-[hsl(var(--tenant-text))] flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-[hsl(var(--tenant-primary))]" />
              Payment Method
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(tenant as any)?.payment_method_added ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[hsl(var(--tenant-surface))]">
                    <CreditCard className="h-5 w-5 text-[hsl(var(--tenant-primary))]" />
                  </div>
                  <div>
                    <p className="font-medium text-[hsl(var(--tenant-text))]">Payment method on file</p>
                    <p className="text-sm text-[hsl(var(--tenant-text-light))]">Visa ending in 4242</p>
                  </div>
                </div>
                <Button 
                  variant="outline"
                  className="border-[hsl(var(--tenant-border))] text-[hsl(var(--tenant-text))] hover:bg-[hsl(var(--tenant-surface))]"
                >
                  Update Payment Method
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[hsl(var(--tenant-surface))] mb-4">
                  <CreditCard className="h-8 w-8 text-[hsl(var(--tenant-text-light))]" />
                </div>
                <p className="text-[hsl(var(--tenant-text-light))] mb-4">No payment method added</p>
                <Button 
                  className="bg-[hsl(var(--tenant-primary))] hover:bg-[hsl(var(--tenant-primary))]/90 text-white"
                >
                  Add Payment Method
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Billing History */}
        <Card className="bg-white border-[hsl(var(--tenant-border))] shadow-sm">
          <CardHeader>
            <CardTitle className="text-[hsl(var(--tenant-text))]">📄 Billing History</CardTitle>
          </CardHeader>
          <CardContent>
            {invoices && invoices.length > 0 ? (
              <div className="space-y-2">
                {invoices.map((invoice: any) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-4 border border-[hsl(var(--tenant-border))] rounded-lg hover:bg-[hsl(var(--tenant-surface))] transition-colors"
                  >
                    <div>
                      <p className="font-medium text-[hsl(var(--tenant-text))]">{invoice.invoice_number || `Invoice #${invoice.id.slice(0, 8)}`}</p>
                      <p className="text-sm text-[hsl(var(--tenant-text-light))]">
                        {formatSmartDate(invoice.issue_date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-[hsl(var(--tenant-text))]">{formatCurrency(invoice.total || 0)}</p>
                      <Badge 
                        variant={invoice.status === "paid" ? "default" : "outline"}
                        className={
                          invoice.status === "paid" 
                            ? "bg-green-100 text-green-800 border-green-200"
                            : "border-[hsl(var(--tenant-border))] text-[hsl(var(--tenant-text))]"
                        }
                      >
                        {invoice.status?.toUpperCase() || "PENDING"}
                      </Badge>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="hover:bg-[hsl(var(--tenant-surface))] text-[hsl(var(--tenant-text))]"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[hsl(var(--tenant-surface))] mb-4">
                  <CreditCard className="h-8 w-8 text-[hsl(var(--tenant-text-light))]" />
                </div>
                <p className="text-[hsl(var(--tenant-text-light))]">No invoices yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer Note */}
        <div className="text-center text-sm text-[hsl(var(--tenant-text-light))] bg-white p-4 rounded-lg border border-[hsl(var(--tenant-border))]">
          <p className="mb-1">Billing is managed by the platform administrator.</p>
          <p>For changes to your subscription, please contact support.</p>
        </div>
      </div>
    </div>
  );
}
