import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Building2, 
  DollarSign,
  Users,
  Package,
  Settings,
  AlertTriangle,
  ArrowLeft,
  LogIn,
  Play,
  Pause,
  Trash2
} from "lucide-react";
import { useSuperAdminAuth } from "@/contexts/SuperAdminAuthContext";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { formatSmartDate } from "@/lib/utils/formatDate";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { FeatureList } from "@/components/admin/FeatureList";

export default function TenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const { superAdmin } = useSuperAdminAuth();
  const queryClient = useQueryClient();

  // Fetch tenant details
  const { data: tenant, isLoading } = useQuery({
    queryKey: ["super-admin-tenant", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", tenantId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Fetch subscription plan
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

  // Fetch recent invoices
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

  // Fetch tenant users
  const { data: tenantUsers } = useQuery({
    queryKey: ["tenant-users", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data } = await supabase
        .from("tenant_users")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      return data || [];
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
      queryClient.invalidateQueries({ queryKey: ["super-admin-tenant", tenantId] });
      toast({
        title: "Success",
        description: `Tenant ${suspendMutation.variables ? "suspended" : "activated"}`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
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
      queryClient.invalidateQueries({ queryKey: ["super-admin-tenant", tenantId] });
      toast({
        title: "Plan Changed",
        description: "Subscription plan updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--super-admin-bg))]">
        <p className="text-[hsl(var(--super-admin-text))]/70">Loading tenant details...</p>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--super-admin-bg))]">
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
    const statusConfig: Record<string, { label: string; className: string }> = {
      active: { label: "Active", className: "bg-green-500/20 text-green-400 border-green-500/30" },
      suspended: { label: "Suspended", className: "bg-red-500/20 text-red-400 border-red-500/30" },
      cancelled: { label: "Cancelled", className: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
    };

    const config = statusConfig[status] || { label: status.toUpperCase(), className: "" };

    return (
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const getSubscriptionStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      active: { label: "Active", className: "bg-green-500/20 text-green-400 border-green-500/30" },
      trial: { label: "Trial", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
      trialing: { label: "Trialing", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
      past_due: { label: "Past Due", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
      cancelled: { label: "Cancelled", className: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
    };

    const config = statusConfig[status] || { label: status.replace("_", " ").toUpperCase(), className: "" };

    return (
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--super-admin-bg))]">
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
                window.open(`/${tenant.slug}/admin/dashboard`, '_blank');
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
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60">{formatCurrency(tenant.mrr || 0)}/month</p>
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
              <p className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">{formatCurrency(tenant.mrr || 0)}</p>
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
          <TabsList className="bg-[hsl(var(--super-admin-surface))]/80 border-white/10">
            <TabsTrigger value="overview" className="data-[state=active]:bg-white/10 data-[state=active]:text-[hsl(var(--super-admin-text))] text-[hsl(var(--super-admin-text))]/70">Overview</TabsTrigger>
            <TabsTrigger value="features" className="data-[state=active]:bg-white/10 data-[state=active]:text-[hsl(var(--super-admin-text))] text-[hsl(var(--super-admin-text))]/70">Features</TabsTrigger>
            <TabsTrigger value="billing" className="data-[state=active]:bg-white/10 data-[state=active]:text-[hsl(var(--super-admin-text))] text-[hsl(var(--super-admin-text))]/70">Billing</TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-white/10 data-[state=active]:text-[hsl(var(--super-admin-text))] text-[hsl(var(--super-admin-text))]/70">Users</TabsTrigger>
            <TabsTrigger value="activity" className="data-[state=active]:bg-white/10 data-[state=active]:text-[hsl(var(--super-admin-text))] text-[hsl(var(--super-admin-text))]/70">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
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
                    <p className="text-base text-[hsl(var(--super-admin-text))]">{tenant.phone || "N/A"}</p>
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
                  {Object.entries((tenant.usage as any) || {}).map(([key, value]: [string, any]) => {
                    const limit = (tenant.limits as any)?.[key] || 0;
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
                  <FeatureList features={(tenant.features as any) || {}} tenantId={tenantId} readOnly={false} />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="billing" className="space-y-4">
            <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-[hsl(var(--super-admin-text))]">Current Plan</CardTitle>
                  <div className="flex gap-2">
                    <select
                      value={tenant.subscription_plan}
                      onChange={(e) => changePlanMutation.mutate(e.target.value)}
                      className="px-3 py-2 border border-white/10 rounded-md bg-[hsl(var(--super-admin-bg))]/50 text-[hsl(var(--super-admin-text))]"
                      disabled={changePlanMutation.isPending}
                    >
                      <option value="starter">Starter</option>
                      <option value="professional">Professional</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {plan && (
                  <div>
                    <p className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">{formatCurrency(plan.price_monthly)}/month</p>
                    <p className="text-sm text-[hsl(var(--super-admin-text))]/70 mt-1">{plan.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-[hsl(var(--super-admin-text))]">Recent Invoices</CardTitle>
              </CardHeader>
              <CardContent>
                {invoices && invoices.length > 0 ? (
                  <div className="space-y-2">
                    {invoices.map((invoice: any) => (
                      <div key={invoice.id} className="flex items-center justify-between p-3 border border-white/10 rounded-lg hover:bg-white/5 transition-colors">
                        <div>
                          <p className="font-medium text-[hsl(var(--super-admin-text))]">{invoice.invoice_number}</p>
                          <p className="text-sm text-[hsl(var(--super-admin-text))]/60">
                            {formatSmartDate(invoice.issue_date)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-[hsl(var(--super-admin-text))]">{formatCurrency(invoice.total || 0)}</p>
                          <Badge variant={invoice.status === "paid" ? "default" : "outline"} className="mt-1">
                            {invoice.status.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-[hsl(var(--super-admin-text))]/60 py-8">No invoices yet</p>
                )}
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
                    {tenantUsers.map((user: any) => (
                      <div key={user.id} className="flex items-center justify-between p-3 border border-white/10 rounded-lg hover:bg-white/5 transition-colors">
                        <div>
                          <p className="font-medium text-[hsl(var(--super-admin-text))]">{user.email}</p>
                          <p className="text-sm text-[hsl(var(--super-admin-text))]/60">{user.name || "No name"}</p>
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
                <p className="text-center text-[hsl(var(--super-admin-text))]/60 py-8">
                  Activity log coming soon
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
