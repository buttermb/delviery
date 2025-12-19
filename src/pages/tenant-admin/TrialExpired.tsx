/**
 * Trial Expired Page
 * Shown when tenant's trial has ended and they haven't upgraded
 */

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Package,
  Users,
  Smartphone,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { useTenantAdminAuth, Tenant } from "@/contexts/TenantAdminAuthContext";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { UpgradePrompt } from "@/components/shared/UpgradePrompt";
import { useState } from "react";
import type { Database } from "@/integrations/supabase/types";

interface TenantStats {
  products: number;
  customers: number;
  menus: number;
  revenue: number;
}

export default function TrialExpiredPage() {
  const navigate = useNavigate();
  const { tenant } = useTenantAdminAuth();
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  // Fetch tenant stats
  // @ts-ignore - Complex query return type
  const { data: tenantStats } = useQuery<TenantStats | null>({
    queryKey: ["trial-expired-stats", tenant?.id],
    queryFn: async (): Promise<TenantStats | null> => {
      if (!tenant?.id) return null;

      const usage = tenant?.usage || { products: 0, customers: 0, menus: 0, revenue: 0 };

      // Get revenue if any
      // @ts-ignore - Deep instantiation error from Supabase types
      const ordersQuery = await supabase
        .from("menu_orders")
        .select("total_amount")
        .eq("tenant_id", tenant.id)
        .eq("status", "confirmed");

      interface OrderWithAmount {
        total_amount: number | null;
      }

      const orders = (ordersQuery.data || []) as OrderWithAmount[];

      const revenue = orders?.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0) || 0;

      return {
        products: Number(usage.products || 0),
        customers: Number(usage.customers || 0),
        menus: Number(usage.menus || 0),
        revenue,
      };
    },
    enabled: !!tenant?.id,
  });

  const trialEndsAt = tenant?.trial_ends_at;
  const daysSinceExpiry = trialEndsAt
    ? Math.floor((Date.now() - new Date(trialEndsAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="min-h-screen bg-[hsl(var(--tenant-bg))]">
      {/* Header */}
      <header className="border-b border-[hsl(var(--tenant-border))] bg-white sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-[hsl(var(--tenant-text))]">
            🎛️ {tenant?.business_name || "Account"}
          </h1>
        </div>
      </header>

      <div className="container mx-auto px-4 md:px-6 py-8 md:py-12 max-w-4xl">
        {/* Main Message Card */}
        <Card className="border-2 border-red-400 bg-red-50 mb-6">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-8 w-8 text-red-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-red-900 mb-2">
                  Your Trial Has Expired
                </h2>
                <p className="text-red-700 mb-4">
                  {daysSinceExpiry === 0
                    ? "Your 14-day free trial ended today."
                    : `Your 14-day free trial ended ${daysSinceExpiry} day${daysSinceExpiry !== 1 ? "s" : ""} ago.`}
                </p>
                <p className="text-red-600 text-sm">
                  Your data is safe and preserved. Upgrade to a paid plan to continue using the
                  platform and access all your information.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* What You Built */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-[hsl(var(--tenant-text))]">
              What You've Built
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[hsl(var(--tenant-text-light))] mb-4">
              Here's a summary of what you created during your trial:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-4 border border-[hsl(var(--tenant-border))] rounded-lg">
                <Package className="h-6 w-6 text-[hsl(var(--tenant-primary))]" />
                <div>
                  <div className="text-2xl font-bold text-[hsl(var(--tenant-text))]">
                    {tenantStats?.products || 0}
                  </div>
                  <div className="text-sm text-[hsl(var(--tenant-text-light))]">
                    Products
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 border border-[hsl(var(--tenant-border))] rounded-lg">
                <Users className="h-6 w-6 text-purple-500" />
                <div>
                  <div className="text-2xl font-bold text-[hsl(var(--tenant-text))]">
                    {tenantStats?.customers || 0}
                  </div>
                  <div className="text-sm text-[hsl(var(--tenant-text-light))]">
                    Customers
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 border border-[hsl(var(--tenant-border))] rounded-lg">
                <Smartphone className="h-6 w-6 text-[hsl(var(--tenant-secondary))]" />
                <div>
                  <div className="text-2xl font-bold text-[hsl(var(--tenant-text))]">
                    {tenantStats?.menus || 0}
                  </div>
                  <div className="text-sm text-[hsl(var(--tenant-text-light))]">
                    Menus
                  </div>
                </div>
              </div>
            </div>
            {tenantStats?.revenue && tenantStats.revenue > 0 && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-green-700">Revenue Generated</span>
                  <span className="text-lg font-bold text-green-900">
                    {formatCurrency(tenantStats.revenue)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pricing Comparison */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-[hsl(var(--tenant-text))]">
              Choose Your Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Starter Plan */}
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="text-lg">Starter</CardTitle>
                  <div className="text-3xl font-bold text-[hsl(var(--tenant-text))]">
                    {formatCurrency(99)}
                    <span className="text-lg font-normal text-[hsl(var(--tenant-text-light))]">
                      /month
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-4">
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>100 products</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>50 customers</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>3 menus</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Email support</span>
                    </li>
                  </ul>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate(`/${tenant?.slug}/admin/billing`)}
                  >
                    Select Starter
                  </Button>
                </CardContent>
              </Card>

              {/* Professional Plan */}
              <Card className="border-2 border-[hsl(var(--tenant-primary))] relative">
                <Badge className="absolute top-4 right-4 bg-[hsl(var(--tenant-primary))]">
                  Popular
                </Badge>
                <CardHeader>
                  <CardTitle className="text-lg">Professional</CardTitle>
                  <div className="text-3xl font-bold text-[hsl(var(--tenant-text))]">
                    {formatCurrency(299)}
                    <span className="text-lg font-normal text-[hsl(var(--tenant-text-light))]">
                      /month
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-4">
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Unlimited products</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Unlimited customers</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Unlimited menus</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Priority support</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Advanced analytics</span>
                    </li>
                  </ul>
                  <Button
                    className="w-full bg-[hsl(var(--tenant-primary))] hover:bg-[hsl(var(--tenant-primary))]/90"
                    onClick={() => {
                      setShowUpgradeDialog(true);
                    }}
                  >
                    Upgrade to Professional
                  </Button>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* CTA Section */}
        <Card className="bg-gradient-to-r from-[hsl(var(--tenant-primary))]/5 to-[hsl(var(--tenant-secondary))]/5 border-2 border-[hsl(var(--tenant-primary))]">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-[hsl(var(--tenant-text))] mb-1">
                  Ready to Continue?
                </h3>
                <p className="text-sm text-[hsl(var(--tenant-text-light))]">
                  Your data is preserved and ready to continue where you left off.
                </p>
              </div>
              <Button
                size="lg"
                className="bg-[hsl(var(--tenant-primary))] hover:bg-[hsl(var(--tenant-primary))]/90 text-white"
                onClick={() => navigate(`/${tenant?.slug}/admin/billing`)}
              >
                View Billing Options
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Upgrade Dialog */}
        <UpgradePrompt
          open={showUpgradeDialog}
          onOpenChange={setShowUpgradeDialog}
          type="trial"
          tenantSlug={tenant?.slug}
          title="Upgrade to Professional"
          description="Upgrade to Professional to get unlimited products, customers, and menus, plus priority support and advanced analytics."
        />
      </div>
    </div>
  );
}

