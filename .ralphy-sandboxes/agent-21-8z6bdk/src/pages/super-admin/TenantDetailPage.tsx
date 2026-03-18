import { logger } from '@/lib/logger';
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  ArrowLeft,
  LogIn,
  Play,
  Pause,
} from "lucide-react";
import { useSuperAdminAuth } from "@/contexts/SuperAdminAuthContext";
import { formatCurrency, formatPhoneNumber } from "@/lib/formatters";
import { formatSmartDate } from "@/lib/utils/formatDate";
import { getStatusColor, getStatusVariant } from "@/lib/utils/statusColors";
import { toast } from 'sonner';
import { showInfoToast } from "@/utils/toastHelpers";
import { FeatureList } from "@/components/admin/FeatureList";
import { ImpersonationMode } from "@/components/super-admin/ImpersonationMode";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { useState } from "react";
import type { Database } from "@/integrations/supabase/types";
import { SupportTicketsTab } from "@/components/super-admin/SupportTicketsTab";
import { SUBSCRIPTION_PLANS } from "@/utils/subscriptionPlans";
import { DetailPageSkeleton } from "@/components/admin/shared/LoadingSkeletons";
import { queryKeys } from "@/lib/queryKeys";
import { humanizeError } from "@/lib/humanizeError";

type Invoice = Database['public']['Tables']['invoices']['Row'];
type InvoiceLineItem = {
  description?: string;
  name?: string;
  quantity?: number;
  amount?: number;
  total?: number;
};
type TenantUser = {
  id: string;
  email: string;
  full_name?: string | null;
  role?: string | null;
  [key: string]: unknown;
};

export default function TenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const { superAdmin } = useSuperAdminAuth();
  const queryClient = useQueryClient();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  // Validate UUID format
  const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId ?? '');

  // Fetch tenant details
  const { data: tenant, isLoading } = useQuery({
    queryKey: queryKeys.superAdminTenantDetail.tenant(tenantId),
    queryFn: async () => {
      if (!tenantId || !isValidUUID) return null;

      const { data, error } = await supabase
        .from("tenants")
        .select("id, business_name, slug, owner_email, owner_name, phone, subscription_plan, subscription_status, trial_ends_at, stripe_customer_id, payment_method_added, mrr, limits, usage, features, white_label, status, cancelled_at, last_activity_at, onboarded, created_at, updated_at, monthly_orders")
        .eq("id", tenantId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && isValidUUID,
  });

  // Early return for invalid UUID logic handled in render
  // Hooks below are disabled if !isValidUUID, so they won't run network requests
  // but we must not return early to satisfy rules-of-hooks

  // Fetch subscription plan
  const { data: plan } = useQuery({
    queryKey: queryKeys.superAdminTenantDetail.subscriptionPlan(tenant?.subscription_plan),
    queryFn: async () => {
      if (!tenant?.subscription_plan) return null;

      const { data } = await supabase
        .from("subscription_plans")
        .select("id, name, display_name, description, features, price_monthly")
        .eq("name", tenant.subscription_plan)
        .maybeSingle();

      return data;
    },
    enabled: !!tenant?.subscription_plan,
  });

  // Fetch recent invoices
  const { data: invoices } = useQuery({
    queryKey: queryKeys.superAdminTenantDetail.invoices(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      const { data } = await supabase
        .from("invoices")
        .select("id, invoice_number, issue_date, due_date, total, subtotal, tax, status, billing_period_start, billing_period_end, stripe_invoice_id, line_items, amount_paid, amount_due")
        .eq("tenant_id", tenantId)
        .order("issue_date", { ascending: false })
        .limit(10);

      return data ?? [];
    },
    enabled: !!tenantId,
  });

  // Fetch tenant users
  const { data: tenantUsers } = useQuery({
    queryKey: queryKeys.superAdminTenantDetail.users(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      const { data } = await supabase
        .from("tenant_users")
        .select("id, email, full_name, role, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      return data ?? [];
    },
    enabled: !!tenantId,
  });

  // Fetch activity logs for this tenant
  const { data: activityLogs } = useQuery({
    queryKey: queryKeys.superAdminTenantDetail.activityLogs(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      const { data } = await supabase
        .from("super_admin_audit_logs")
        .select("id, action, details, created_at")
        .eq("entity_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(50);

      return data ?? [];
    },
    enabled: !!tenantId,
  });

  // Suspend/Resume tenant
  const suspendMutation = useMutation({
    mutationFn: async (suspend: boolean) => {
      const { error } = await supabase
        .from("tenants")
        .update({
          status: suspend ? "suspended" : "active",
          suspended_reason: suspend ? "Suspended by super admin" : null,
        })
        .eq("id", tenantId);

      if (error) throw error;

      // Log action (super_admin_audit_logs table)
      if (superAdmin) {
        await supabase.from("super_admin_audit_logs").insert({
          super_admin_id: superAdmin.id,
          action: suspend ? "TENANT_SUSPENDED" : "TENANT_ACTIVATED",
          entity_type: "tenant",
          entity_id: tenantId,
          action_data: { suspended: suspend },
          reason: suspend ? "Manual suspension by super admin" : "Manual activation by super admin",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.superAdminTenantDetail.tenant(tenantId) });
      toast.success(`Tenant ${suspendMutation.variables ? "suspended" : "activated"}`);
    },
    onError: (error: unknown) => {
      toast.error('Operation failed', { description: humanizeError(error) });
    },
  });

  // Change subscription plan
  const changePlanMutation = useMutation({
    mutationFn: async (newPlan: string) => {
      const { error } = await supabase
        .from("tenants")
        .update({ subscription_plan: newPlan })
        .eq("id", tenantId);

      if (error) throw error;

      // Log action (super_admin_audit_logs table)
      if (superAdmin) {
        await supabase.from("super_admin_audit_logs").insert({
          super_admin_id: superAdmin.id,
          action: "PLAN_CHANGED",
          entity_type: "tenant",
          entity_id: tenantId,
          details: { from: tenant?.subscription_plan, to: newPlan, reason: "Plan changed by super admin" },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.superAdminTenantDetail.tenant(tenantId) });
      toast.success('Subscription plan updated successfully');
    },
    onError: (error: unknown) => {
      toast.error('Failed to update subscription plan', { description: humanizeError(error) });
    },
  });

  if (!isValidUUID) {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="py-8 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invalid Tenant ID</h2>
            <p className="text-muted-foreground mb-4">
              The tenant ID in the URL is not valid.
            </p>
            <Button onClick={() => navigate('/super-admin/tenants')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Tenants
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <DetailPageSkeleton />;
  }

  if (!tenant) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[hsl(var(--super-admin-bg))]">
        <Card className="max-w-md bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
          <CardContent className="pt-6">
            <p className="text-center text-[hsl(var(--super-admin-text))]/70">Tenant not found</p>
            <Button
              variant="outline"
              className="w-full mt-4 border-white/10 text-[hsl(var(--super-admin-text))] hover:bg-white/10"
              onClick={() => navigate("/super-admin/dashboard")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    return (
      <Badge variant={getStatusVariant(status)} className={getStatusColor(status)}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getSubscriptionStatusBadge = (status: string) => {
    return (
      <Badge variant={getStatusVariant(status)} className={getStatusColor(status)}>
        {status.replace("_", " ").charAt(0).toUpperCase() + status.replace("_", " ").slice(1)}
      </Badge>
    );
  };

  return (
    <div className="min-h-dvh bg-[hsl(var(--super-admin-bg))]">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button
              variant="ghost"
              onClick={() => navigate("/super-admin/dashboard")}
              className="text-[hsl(var(--super-admin-text))]/80 hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-3xl font-bold mt-2 text-[hsl(var(--super-admin-text))]">{tenant.business_name}</h1>
            <p className="text-[hsl(var(--super-admin-text))]/70">{tenant.slug}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                window.open(`/${tenant.slug}/admin/dashboard`, '_blank', 'noopener,noreferrer');
              }}
              className="border-white/10 text-[hsl(var(--super-admin-text))] hover:bg-white/10"
            >
              <LogIn className="h-4 w-4 mr-2" />
              Login as Tenant
            </Button>
            {tenant.status === "active" ? (
              <Button
                variant="destructive"
                onClick={() => suspendMutation.mutate(true)}
                disabled={suspendMutation.isPending}
                className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30"
              >
                <Pause className="h-4 w-4 mr-2" />
                Suspend
              </Button>
            ) : (
              <Button
                onClick={() => suspendMutation.mutate(false)}
                disabled={suspendMutation.isPending}
                className="bg-gradient-to-r from-[hsl(var(--super-admin-primary))] to-[hsl(var(--super-admin-secondary))] hover:opacity-90 text-white"
              >
                <Play className="h-4 w-4 mr-2" />
                Activate
              </Button>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold capitalize text-[hsl(var(--super-admin-text))]">{tenant.subscription_plan}</p>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60">{formatCurrency(tenant.mrr ?? 0)}/month</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Status</CardTitle>
            </CardHeader>
            <CardContent>
              {getStatusBadge(tenant.status)}
              <div className="mt-2">
                {getSubscriptionStatusBadge(tenant.subscription_status)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">MRR</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">{formatCurrency(tenant.mrr ?? 0)}</p>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60">Monthly recurring</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Created</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium text-[hsl(var(--super-admin-text))]">{formatSmartDate(tenant.created_at)}</p>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60">Member since</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-[hsl(var(--super-admin-surface))]/80 border-white/10 flex w-full overflow-x-auto">
            <TabsTrigger value="overview" className="data-[state=active]:bg-white/10 data-[state=active]:text-[hsl(var(--super-admin-text))] text-[hsl(var(--super-admin-text))]/70">Overview</TabsTrigger>
            <TabsTrigger value="features" className="data-[state=active]:bg-white/10 data-[state=active]:text-[hsl(var(--super-admin-text))] text-[hsl(var(--super-admin-text))]/70">Features</TabsTrigger>
            <TabsTrigger value="usage" className="data-[state=active]:bg-white/10 data-[state=active]:text-[hsl(var(--super-admin-text))] text-[hsl(var(--super-admin-text))]/70">Usage</TabsTrigger>
            <TabsTrigger value="billing" className="data-[state=active]:bg-white/10 data-[state=active]:text-[hsl(var(--super-admin-text))] text-[hsl(var(--super-admin-text))]/70">Billing</TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-white/10 data-[state=active]:text-[hsl(var(--super-admin-text))] text-[hsl(var(--super-admin-text))]/70">Users</TabsTrigger>
            <TabsTrigger value="activity" className="data-[state=active]:bg-white/10 data-[state=active]:text-[hsl(var(--super-admin-text))] text-[hsl(var(--super-admin-text))]/70">Activity</TabsTrigger>
            <TabsTrigger value="data" className="data-[state=active]:bg-white/10 data-[state=active]:text-[hsl(var(--super-admin-text))] text-[hsl(var(--super-admin-text))]/70">Data</TabsTrigger>
            <TabsTrigger value="support" className="data-[state=active]:bg-white/10 data-[state=active]:text-[hsl(var(--super-admin-text))] text-[hsl(var(--super-admin-text))]/70">Support</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {tenantId && tenant && (
              <ImpersonationMode
                tenantId={tenantId}
                onStartImpersonation={(id) => {
                  if (tenant && tenant.id === id) {
                    window.open(`/${tenant.slug}/admin/dashboard`, '_blank', 'noopener,noreferrer');
                  }
                }}
              />
            )}
            <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-[hsl(var(--super-admin-text))]">Business Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-[hsl(var(--super-admin-text))]/70">Owner Email</p>
                    <p className="text-base text-[hsl(var(--super-admin-text))]">{tenant.owner_email}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[hsl(var(--super-admin-text))]/70">Owner Name</p>
                    <p className="text-base text-[hsl(var(--super-admin-text))]">{tenant.owner_name || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[hsl(var(--super-admin-text))]/70">Phone</p>
                    <p className="text-base text-[hsl(var(--super-admin-text))]">{formatPhoneNumber(tenant.phone, { fallback: 'N/A' })}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[hsl(var(--super-admin-text))]/70">Stripe Customer ID</p>
                    <p className="text-base font-mono text-sm text-[hsl(var(--super-admin-text))]">{tenant.stripe_customer_id || "Not set"}</p>
                  </div>
                </div>

                {tenant.trial_ends_at && (
                  <div className="p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                    <p className="text-sm text-yellow-400">
                      <strong>⏰ Trial ends:</strong> {formatSmartDate(tenant.trial_ends_at)}
                    </p>
                  </div>
                )}

                {plan && (
                  <div>
                    <p className="text-sm font-medium text-[hsl(var(--super-admin-text))]/70 mb-2">Plan Features</p>
                    <div className="flex flex-wrap gap-2">
                      {plan.features && Array.isArray(plan.features) && plan.features.map((feature: string, index: number) => (
                        <Badge key={index} variant="outline" className="border-[hsl(var(--super-admin-primary))]/30 text-[hsl(var(--super-admin-primary))]">
                          {feature.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-[hsl(var(--super-admin-text))]">Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries((tenant.usage as Record<string, number>) || {}).map(([key, value]) => {
                    const limit = ((tenant.limits as Record<string, number>) || {})[key] ?? 0;
                    const percentage = limit > 0 ? (Number(value) / limit) * 100 : 0;
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="capitalize text-[hsl(var(--super-admin-text))]">{key.replace(/_/g, " ")}</span>
                          <span className="text-[hsl(var(--super-admin-text))]/70">{Number(value).toLocaleString()} / {limit === -1 ? "Unlimited" : limit.toLocaleString()}</span>
                        </div>
                        {limit !== -1 && (
                          <div className="w-full bg-white/10 rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-[hsl(var(--super-admin-primary))] to-[hsl(var(--super-admin-secondary))] h-2 rounded-full"
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="features">
            {tenantId && (
              <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
                <CardContent className="pt-6">
                  <FeatureList features={(tenant.features as Record<string, boolean>) || {}} tenantId={tenantId} readOnly={false} />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="billing" className="space-y-4">
            {/* Current Subscription */}
            <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-[hsl(var(--super-admin-text))]">💳 CURRENT SUBSCRIPTION</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {plan && (
                  <>
                    <div className="p-6 border border-white/10 rounded-lg bg-[hsl(var(--super-admin-bg))]/50">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">
                              💼 {plan.name?.toUpperCase() || tenant.subscription_plan?.toUpperCase()} PLAN
                            </span>
                          </div>
                          <p className="text-3xl font-bold text-[hsl(var(--super-admin-primary))]">
                            {formatCurrency(plan.price_monthly || tenant.mrr || 0)} / month
                          </p>
                        </div>
                        <Badge
                          variant={tenant.subscription_status === "active" ? "default" : "outline"}
                          className={tenant.subscription_status === "active"
                            ? "bg-[hsl(var(--super-admin-secondary))]/20 text-[hsl(var(--super-admin-secondary))] border-[hsl(var(--super-admin-secondary))]/30"
                            : ""}
                        >
                          ✅ {tenant.subscription_status?.toUpperCase() || "ACTIVE"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-6">
                        <div>
                          <p className="text-sm text-[hsl(var(--super-admin-text))]/70 mb-1">Started:</p>
                          <p className="text-base font-medium text-[hsl(var(--super-admin-text))]">
                            {formatSmartDate(tenant.created_at)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-[hsl(var(--super-admin-text))]/70 mb-1">Next billing:</p>
                          <p className="text-base font-medium text-[hsl(var(--super-admin-text))]">
                            {tenant.trial_ends_at
                              ? formatSmartDate(tenant.trial_ends_at)
                              : (() => {
                                const nextBilling = new Date(tenant.created_at || new Date());
                                nextBilling.setMonth(nextBilling.getMonth() + 1);
                                return formatSmartDate(nextBilling.toISOString());
                              })()}
                            {tenant.trial_ends_at && new Date(tenant.trial_ends_at) > new Date() && (
                              <span className="text-[hsl(var(--super-admin-accent))] ml-2">
                                (in {Math.ceil((new Date(tenant.trial_ends_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days)
                              </span>
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-[hsl(var(--super-admin-text))]/70 mb-1">Billing cycle:</p>
                          <p className="text-base font-medium text-[hsl(var(--super-admin-text))]">
                            {(() => {
                              const start = new Date(tenant.created_at || new Date());
                              const next = new Date(start);
                              next.setMonth(next.getMonth() + 1);
                              return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${next.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                            })()}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3 mt-6">
                        <Button
                          variant="outline"
                          onClick={() => {
                            const planOrder = [SUBSCRIPTION_PLANS.STARTER, SUBSCRIPTION_PLANS.PROFESSIONAL, SUBSCRIPTION_PLANS.ENTERPRISE];
                            const currentIndex = planOrder.indexOf((tenant.subscription_plan || SUBSCRIPTION_PLANS.STARTER) as typeof SUBSCRIPTION_PLANS.STARTER);
                            if (currentIndex < planOrder.length - 1) {
                              changePlanMutation.mutate(planOrder[currentIndex + 1]);
                            }
                          }}
                          disabled={changePlanMutation.isPending || tenant.subscription_plan === SUBSCRIPTION_PLANS.ENTERPRISE}
                          className="flex-1 border-white/10 text-[hsl(var(--super-admin-text))] hover:bg-white/10"
                        >
                          ⬆️ UPGRADE
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            const planOrder = [SUBSCRIPTION_PLANS.STARTER, SUBSCRIPTION_PLANS.PROFESSIONAL, SUBSCRIPTION_PLANS.ENTERPRISE];
                            const currentIndex = planOrder.indexOf((tenant.subscription_plan || SUBSCRIPTION_PLANS.STARTER) as typeof SUBSCRIPTION_PLANS.STARTER);
                            if (currentIndex > 0) {
                              changePlanMutation.mutate(planOrder[currentIndex - 1]);
                            }
                          }}
                          disabled={changePlanMutation.isPending || tenant.subscription_plan === SUBSCRIPTION_PLANS.STARTER}
                          className="flex-1 border-white/10 text-[hsl(var(--super-admin-text))] hover:bg-white/10"
                        >
                          ⬇️ DOWNGRADE
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => setCancelDialogOpen(true)}
                          className="flex-1 bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30"
                        >
                          ❌ CANCEL
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Usage This Period */}
            <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-[hsl(var(--super-admin-text))]">📊 USAGE THIS PERIOD</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-[hsl(var(--super-admin-text))]">
                  <span>Base plan:</span>
                  <span className="font-medium">{formatCurrency(plan?.price_monthly || tenant.mrr || 0)}</span>
                </div>
                <div className="flex justify-between text-[hsl(var(--super-admin-text))]">
                  <span>SMS overage:</span>
                  <span className="font-medium">{formatCurrency(0)}</span>
                </div>
                <div className="flex justify-between text-[hsl(var(--super-admin-text))]">
                  <span>Storage overage:</span>
                  <span className="font-medium">{formatCurrency(0)}</span>
                </div>
                <Separator className="bg-white/10" />
                <div className="flex justify-between text-lg font-bold text-[hsl(var(--super-admin-text))]">
                  <span>Total next invoice:</span>
                  <span className="text-[hsl(var(--super-admin-primary))]">
                    {formatCurrency(plan?.price_monthly || tenant.mrr || 0)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Payment Method */}
            <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-[hsl(var(--super-admin-text))]">💳 PAYMENT METHOD</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {tenant.stripe_customer_id ? (
                  <>
                    <div className="p-4 border border-white/10 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-[hsl(var(--super-admin-text))]">
                            💳 Visa ending in 4242
                          </p>
                          <p className="text-sm text-[hsl(var(--super-admin-text))]/70 mt-1">
                            Expires: 12/2025
                          </p>
                          <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">
                            Last updated: {formatSmartDate(tenant.updated_at || tenant.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full border-white/10 text-[hsl(var(--super-admin-text))] hover:bg-white/10 gap-2 min-w-[100px]"
                      onClick={async () => {
                        try {
                          if (!tenant.stripe_customer_id) {
                            showInfoToast("No Stripe Customer", "This tenant doesn't have a Stripe customer ID");
                            return;
                          }
                          // Call Stripe Customer Portal
                          const { data: sessionData, error: sessionError } = await supabase.functions.invoke('stripe-customer-portal', {
                            body: { customerId: tenant.stripe_customer_id }
                          });

                          if (sessionError) throw sessionError;
                          if (sessionData?.url) {
                            window.open(sessionData.url, '_blank', 'noopener,noreferrer');
                          } else {
                            showInfoToast("Update Card", "Opening payment method update...");
                          }
                        } catch {
                          showInfoToast("Error", "Failed to update card");
                        }
                      }}
                    >
                      Update Card
                    </Button>
                  </>
                ) : (
                  <div className="p-4 border border-white/10 rounded-lg">
                    <p className="text-[hsl(var(--super-admin-text))]/70 text-center">
                      No payment method on file
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Billing History */}
            <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-[hsl(var(--super-admin-text))]">📋 BILLING HISTORY</CardTitle>
              </CardHeader>
              <CardContent>
                {invoices && invoices.length > 0 ? (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th scope="col" className="text-left py-3 px-4 text-sm font-medium text-[hsl(var(--super-admin-text))]/70">Date</th>
                            <th scope="col" className="text-left py-3 px-4 text-sm font-medium text-[hsl(var(--super-admin-text))]/70">Invoice</th>
                            <th scope="col" className="text-right py-3 px-4 text-sm font-medium text-[hsl(var(--super-admin-text))]/70">Amount</th>
                            <th scope="col" className="text-left py-3 px-4 text-sm font-medium text-[hsl(var(--super-admin-text))]/70">Status</th>
                            <th scope="col" className="text-right py-3 px-4 text-sm font-medium text-[hsl(var(--super-admin-text))]/70">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoices.map((invoice: Invoice) => (
                            <tr key={invoice.id} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                              <td className="py-3 px-4 text-sm text-[hsl(var(--super-admin-text))]">
                                {formatSmartDate(invoice.issue_date)}
                              </td>
                              <td className="py-3 px-4 text-sm font-medium text-[hsl(var(--super-admin-text))]">
                                {invoice.invoice_number}
                              </td>
                              <td className="py-3 px-4 text-sm text-right font-medium text-[hsl(var(--super-admin-text))]">
                                {formatCurrency(invoice.total ?? 0)}
                              </td>
                              <td className="py-3 px-4">
                                <Badge
                                  variant={invoice.status === "paid" ? "default" : "outline"}
                                  className={
                                    invoice.status === "paid"
                                      ? "bg-[hsl(var(--super-admin-secondary))]/20 text-[hsl(var(--super-admin-secondary))] border-[hsl(var(--super-admin-secondary))]/30"
                                      : ""
                                  }
                                >
                                  {invoice.status === "paid" ? "✅ Paid" : invoice.status?.toUpperCase() || "PENDING"}
                                </Badge>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      // Open invoice view dialog
                                      const invoiceWindow = window.open('', '_blank', 'noopener,noreferrer');
                                      if (invoiceWindow) {
                                        invoiceWindow.document.write(`
                                          <!DOCTYPE html>
                                          <html>
                                            <head>
                                              <title>Invoice ${invoice.invoice_number}</title>
                                              <style>
                                                body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
                                                .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
                                                .invoice-info { display: flex; justify-content: space-between; margin-bottom: 30px; }
                                                .line-items { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                                                .line-items th { background: #f5f5f5; padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
                                                .line-items td { padding: 10px; border-bottom: 1px solid #eee; }
                                                .totals { text-align: right; margin-top: 20px; }
                                                .totals table { width: 300px; margin-left: auto; }
                                                .totals td { padding: 5px 0; }
                                                .totals .total-row { font-weight: bold; font-size: 1.2em; border-top: 2px solid #333; padding-top: 10px; }
                                              </style>
                                            </head>
                                            <body>
                                              <div class="header">
                                                <h1>Invoice ${invoice.invoice_number}</h1>
                                                <p>Tenant: ${tenant?.business_name || 'N/A'}</p>
                                              </div>
                                              <div class="invoice-info">
                                                <div>
                                                  <p><strong>Issue Date:</strong> ${formatSmartDate(invoice.issue_date)}</p>
                                                  <p><strong>Due Date:</strong> ${formatSmartDate(invoice.due_date)}</p>
                                                  ${invoice.billing_period_start ? `<p><strong>Billing Period:</strong> ${formatSmartDate(invoice.billing_period_start)} - ${formatSmartDate(invoice.billing_period_end)}</p>` : ''}
                                                </div>
                                                <div>
                                                  <p><strong>Status:</strong> ${invoice.status?.toUpperCase() || 'PENDING'}</p>
                                                  ${invoice.stripe_invoice_id ? `<p><strong>Stripe Invoice:</strong> ${invoice.stripe_invoice_id}</p>` : ''}
                                                </div>
                                              </div>
                                              <table class="line-items">
                                                <thead>
                                                  <tr>
                                                    <th scope="col">Description</th>
                                                    <th scope="col">Quantity</th>
                                                    <th scope="col" style="text-align: right;">Amount</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  ${Array.isArray(invoice.line_items) && invoice.line_items.length > 0
                                            ? (invoice.line_items as InvoiceLineItem[]).map((item) => `
                                                      <tr>
                                                        <td>${item.description || item.name || 'N/A'}</td>
                                                        <td>${item.quantity || 1}</td>
                                                        <td style="text-align: right;">${formatCurrency(Number(item.amount || item.total || 0))}</td>
                                                      </tr>
                                                    `).join('')
                                            : `
                                                      <tr>
                                                        <td colspan="3" style="text-align: center; color: #999;">No line items available</td>
                                                      </tr>
                                                    `}
                                                </tbody>
                                              </table>
                                              <div class="totals">
                                                <table>
                                                  <tr>
                                                    <td>Subtotal:</td>
                                                    <td style="text-align: right;">${formatCurrency(Number(invoice.subtotal ?? 0))}</td>
                                                  </tr>
                                                  <tr>
                                                    <td>Tax:</td>
                                                    <td style="text-align: right;">${formatCurrency(Number(invoice.tax ?? 0))}</td>
                                                  </tr>
                                                  <tr class="total-row">
                                                    <td>Total:</td>
                                                    <td style="text-align: right;">${formatCurrency(Number(invoice.total ?? 0))}</td>
                                                  </tr>
                                                  <tr>
                                                    <td>Amount Paid:</td>
                                                    <td style="text-align: right;">${formatCurrency(Number(invoice.amount_paid ?? 0))}</td>
                                                  </tr>
                                                  <tr>
                                                    <td>Amount Due:</td>
                                                    <td style="text-align: right;">${formatCurrency(Number(invoice.amount_due ?? 0))}</td>
                                                  </tr>
                                                </table>
                                              </div>
                                            </body>
                                          </html>
                                        `);
                                        invoiceWindow.document.close();
                                      }
                                    }}
                                    className="text-[hsl(var(--super-admin-text))]/70 hover:text-[hsl(var(--super-admin-primary))]"
                                  >
                                    View
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      // Generate and download HTML invoice
                                      const invoiceHTML = `
                                        <!DOCTYPE html>
                                        <html>
                                          <head>
                                            <title>Invoice ${invoice.invoice_number}</title>
                                            <style>
                                              body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
                                              .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
                                              .invoice-info { display: flex; justify-content: space-between; margin-bottom: 30px; }
                                              .line-items { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                                              .line-items th { background: #f5f5f5; padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
                                              .line-items td { padding: 10px; border-bottom: 1px solid #eee; }
                                              .totals { text-align: right; margin-top: 20px; }
                                              .totals table { width: 300px; margin-left: auto; }
                                              .totals td { padding: 5px 0; }
                                              .totals .total-row { font-weight: bold; font-size: 1.2em; border-top: 2px solid #333; padding-top: 10px; }
                                            </style>
                                          </head>
                                          <body>
                                            <div class="header">
                                              <h1>Invoice ${invoice.invoice_number}</h1>
                                              <p>Tenant: ${tenant?.business_name || 'N/A'}</p>
                                            </div>
                                            <div class="invoice-info">
                                              <div>
                                                <p><strong>Issue Date:</strong> ${formatSmartDate(invoice.issue_date)}</p>
                                                <p><strong>Due Date:</strong> ${formatSmartDate(invoice.due_date)}</p>
                                                ${invoice.billing_period_start ? `<p><strong>Billing Period:</strong> ${formatSmartDate(invoice.billing_period_start)} - ${formatSmartDate(invoice.billing_period_end)}</p>` : ''}
                                              </div>
                                              <div>
                                                <p><strong>Status:</strong> ${invoice.status?.toUpperCase() || 'PENDING'}</p>
                                                ${invoice.stripe_invoice_id ? `<p><strong>Stripe Invoice:</strong> ${invoice.stripe_invoice_id}</p>` : ''}
                                              </div>
                                            </div>
                                            <table class="line-items">
                                              <thead>
                                                <tr>
                                                  <th scope="col">Description</th>
                                                  <th scope="col">Quantity</th>
                                                  <th scope="col" style="text-align: right;">Amount</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                ${Array.isArray(invoice.line_items) && invoice.line_items.length > 0
                                          ? invoice.line_items.map((item: InvoiceLineItem) => `
                                                    <tr>
                                                      <td>${item.description || item.name || 'N/A'}</td>
                                                      <td>${item.quantity || 1}</td>
                                                      <td style="text-align: right;">${formatCurrency(Number(item.amount || item.total || 0))}</td>
                                                    </tr>
                                                  `).join('')
                                          : `
                                                    <tr>
                                                      <td colspan="3" style="text-align: center; color: #999;">No line items available</td>
                                                    </tr>
                                                  `}
                                              </tbody>
                                            </table>
                                            <div class="totals">
                                              <table>
                                                <tr>
                                                  <td>Subtotal:</td>
                                                  <td style="text-align: right;">${formatCurrency(Number(invoice.subtotal ?? 0))}</td>
                                                </tr>
                                                <tr>
                                                  <td>Tax:</td>
                                                  <td style="text-align: right;">${formatCurrency(Number(invoice.tax ?? 0))}</td>
                                                </tr>
                                                <tr class="total-row">
                                                  <td>Total:</td>
                                                  <td style="text-align: right;">${formatCurrency(Number(invoice.total ?? 0))}</td>
                                                </tr>
                                                <tr>
                                                  <td>Amount Paid:</td>
                                                  <td style="text-align: right;">${formatCurrency(Number(invoice.amount_paid ?? 0))}</td>
                                                </tr>
                                                <tr>
                                                  <td>Amount Due:</td>
                                                  <td style="text-align: right;">${formatCurrency(Number(invoice.amount_due ?? 0))}</td>
                                                </tr>
                                              </table>
                                            </div>
                                          </body>
                                        </html>
                                      `;

                                      // Create a blob and download
                                      const blob = new Blob([invoiceHTML], { type: 'text/html' });
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = `invoice-${invoice.invoice_number}.html`;
                                      document.body.appendChild(a);
                                      a.click();
                                      document.body.removeChild(a);
                                      URL.revokeObjectURL(url);

                                      toast.success(`Invoice ${invoice.invoice_number} downloaded successfully`);
                                    }}
                                    className="text-[hsl(var(--super-admin-text))]/70 hover:text-[hsl(var(--super-admin-primary))]"
                                  >
                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Download
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <p className="text-sm text-[hsl(var(--super-admin-text))]/70">
                        Lifetime Value:{" "}
                        <span className="font-bold text-[hsl(var(--super-admin-text))]">
                          {formatCurrency(
                            invoices.reduce((sum: number, inv: Invoice) => sum + (Number(inv.total) || 0), 0)
                          )}
                        </span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-[hsl(var(--super-admin-text))]/60">No invoices yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Admin Actions */}
            <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-[hsl(var(--super-admin-text))]">⚙️ ADMIN ACTIONS</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      const amount = prompt("Enter refund amount (USD):");
                      if (amount && !isNaN(Number(amount)) && tenant.stripe_customer_id) {
                        try {
                          const { error } = await supabase.functions.invoke('create-stripe-refund', {
                            body: { customerId: tenant.stripe_customer_id, amount: Number(amount) * 100 }
                          });
                          if (error) throw error;
                          showInfoToast("Refund Issued", `$${amount} refunded successfully`);
                        } catch {
                          showInfoToast("Refund Failed", "Unable to process refund");
                        }
                      }
                    }}
                    className="flex-1 gap-2 min-w-[100px] border-white/10 text-[hsl(var(--super-admin-text))] hover:bg-white/10"
                  >
                    💰 Issue Refund
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      const credit = prompt("Enter credit amount (USD):");
                      if (credit && !isNaN(Number(credit))) {
                        const { error } = await supabase.from('tenants').update({
                          mrr: (tenant.mrr ?? 0) - Number(credit)
                        }).eq('id', tenantId);

                        if (!error) {
                          showInfoToast("Credit Applied", `$${credit} credit applied to account`);
                          queryClient.invalidateQueries({ queryKey: queryKeys.superAdminTenantDetail.tenant(tenantId) });
                        }
                      }
                    }}
                    className="flex-1 gap-2 min-w-[100px] border-white/10 text-[hsl(var(--super-admin-text))] hover:bg-white/10"
                  >
                    🎁 Apply Credit
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      if (confirm("Retry failed payment?") && tenant.stripe_customer_id) {
                        try {
                          const { error } = await supabase.functions.invoke('retry-stripe-payment', {
                            body: { customerId: tenant.stripe_customer_id }
                          });
                          if (error) throw error;
                          showInfoToast("Payment Retried", "Payment retry initiated");
                        } catch {
                          showInfoToast("Retry Failed", "Unable to retry payment");
                        }
                      }
                    }}
                    className="flex-1 gap-2 min-w-[100px] border-white/10 text-[hsl(var(--super-admin-text))] hover:bg-white/10"
                  >
                    🔄 Retry
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-[hsl(var(--super-admin-text))]">Team Members</CardTitle>
              </CardHeader>
              <CardContent>
                {tenantUsers && tenantUsers.length > 0 ? (
                  <div className="space-y-2">
                    {tenantUsers.map((user: TenantUser) => (
                      <div key={user.id} className="flex items-center justify-between p-3 border border-white/10 rounded-lg hover:bg-white/5 transition-colors">
                        <div>
                          <p className="font-medium text-[hsl(var(--super-admin-text))]">{user.email}</p>
                          <p className="text-sm text-[hsl(var(--super-admin-text))]/60">{user.full_name || "No name"}</p>
                        </div>
                        <Badge variant="outline" className="border-[hsl(var(--super-admin-primary))]/30 text-[hsl(var(--super-admin-primary))]">{user.role}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-[hsl(var(--super-admin-text))]/60 py-8">No team members</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity">
            <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-[hsl(var(--super-admin-text))]">Recent Admin Actions</CardTitle>
              </CardHeader>
              <CardContent>
                {activityLogs && activityLogs.length > 0 ? (
                  <div className="space-y-3">
                    {activityLogs.map((log) => (
                      <div key={log.id} className="flex items-start justify-between p-3 border border-white/10 rounded-lg">
                        <div className="space-y-1">
                          <p className="font-medium text-[hsl(var(--super-admin-text))]">
                            {log.action.replace(/_/g, ' ')}
                          </p>
                          {log.details && (
                            <p className="text-sm text-[hsl(var(--super-admin-text))]/60">
                              {JSON.stringify(log.details).slice(0, 100)}
                              {JSON.stringify(log.details).length > 100 && '...'}
                            </p>
                          )}
                        </div>
                        <span className="text-sm text-[hsl(var(--super-admin-text))]/50 whitespace-nowrap">
                          {formatSmartDate(log.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-[hsl(var(--super-admin-text))]/60">No activity recorded yet</p>
                    <p className="text-sm text-[hsl(var(--super-admin-text))]/40 mt-2">
                      Admin actions like plan changes and suspensions will appear here
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage" className="space-y-6">
            <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-[hsl(var(--super-admin-text))]">Usage Monitoring</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-[hsl(var(--super-admin-text))]/70">Customers</span>
                      <span className="text-sm font-medium text-[hsl(var(--super-admin-text))]">
                        {((tenant.usage as Record<string, number>)?.customers ?? 0)} / {((tenant.limits as Record<string, number>)?.customers || 'Unlimited')}
                      </span>
                    </div>
                    {((tenant.limits as Record<string, number>)?.customers || -1) !== -1 && (
                      <Progress value={(((tenant.usage as Record<string, number>)?.customers ?? 0) / ((tenant.limits as Record<string, number>)?.customers || 1)) * 100} />
                    )}
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-[hsl(var(--super-admin-text))]/70">Products</span>
                      <span className="text-sm font-medium text-[hsl(var(--super-admin-text))]">
                        {((tenant.usage as Record<string, number>)?.products ?? 0)} / {((tenant.limits as Record<string, number>)?.products || 'Unlimited')}
                      </span>
                    </div>
                    {((tenant.limits as Record<string, number>)?.products || -1) !== -1 && (
                      <Progress value={(((tenant.usage as Record<string, number>)?.products ?? 0) / ((tenant.limits as Record<string, number>)?.products || 1)) * 100} />
                    )}
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-[hsl(var(--super-admin-text))]/70">Monthly Orders</span>
                      <span className="text-sm font-medium text-[hsl(var(--super-admin-text))]">
                        {tenant.monthly_orders ?? 0}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="support" className="space-y-6">
            <SupportTicketsTab tenantId={tenantId ?? ''} />
          </TabsContent>
        </Tabs>
      </div>

      <ConfirmDeleteDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        onConfirm={async () => {
          if (!tenant) return;

          try {
            // Update tenant subscription status
            const { error } = await supabase
              .from("tenants")
              .update({
                subscription_status: "cancelled",
                cancelled_at: new Date().toISOString(),
                status: "active", // Keep tenant active, just subscription cancelled
                updated_at: new Date().toISOString(),
              })
              .eq("id", tenant.id);

            if (error) throw error;

            // Log subscription event
            await supabase.from("subscription_events").insert({
              tenant_id: tenant.id,
              event_type: "cancelled",
              from_plan: tenant.subscription_plan,
              to_plan: null,
              amount: 0,
              event_data: {
                cancelled_by: "super_admin",
                cancelled_at: new Date().toISOString(),
              },
            });

            // Invalidate queries to refresh data
            queryClient.invalidateQueries({ queryKey: queryKeys.superAdminTenantDetail.tenant(tenantId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.superAdminTenantDetail.subscriptionPlan(tenant.subscription_plan) });

            toast.success('The subscription has been cancelled successfully. The tenant retains access until the end of the billing period.');
          } catch (error: unknown) {
            logger.error("Failed to cancel subscription", error, { component: "TenantDetailPage", tenantId: tenant?.id });
            toast.error(error instanceof Error ? error.message : 'Failed to cancel subscription');
          }
        }}
        itemName={tenant?.business_name}
        itemType="subscription"
        title="Cancel Subscription"
        description="Are you sure you want to cancel this subscription? This action cannot be undone. The tenant will retain access until the end of the billing period."
      />
    </div>
  );
}
