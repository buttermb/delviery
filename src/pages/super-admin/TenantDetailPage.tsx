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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading tenant details...</p>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Tenant not found</p>
            <Button variant="outline" className="w-full mt-4" onClick={() => navigate("/super-admin/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      suspended: "destructive",
      cancelled: "outline",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const getSubscriptionStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      trial: "secondary",
      trialing: "secondary",
      past_due: "destructive",
      cancelled: "outline",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {status.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => navigate("/super-admin/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-3xl font-bold mt-2">{tenant.business_name}</h1>
            <p className="text-muted-foreground">{tenant.slug}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                window.open(`/${tenant.slug}/admin/dashboard`, '_blank');
              }}
            >
              <LogIn className="h-4 w-4 mr-2" />
              Login as Tenant
            </Button>
            {tenant.status === "active" ? (
              <Button
                variant="destructive"
                onClick={() => suspendMutation.mutate(true)}
                disabled={suspendMutation.isPending}
              >
                <Pause className="h-4 w-4 mr-2" />
                Suspend
              </Button>
            ) : (
              <Button
                variant="default"
                onClick={() => suspendMutation.mutate(false)}
                disabled={suspendMutation.isPending}
              >
                <Play className="h-4 w-4 mr-2" />
                Activate
              </Button>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold capitalize">{tenant.subscription_plan}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(tenant.mrr || 0)}/month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
            </CardHeader>
            <CardContent>
              {getStatusBadge(tenant.status)}
              <div className="mt-2">
                {getSubscriptionStatusBadge(tenant.subscription_status)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">MRR</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(tenant.mrr || 0)}</p>
              <p className="text-xs text-muted-foreground">Monthly recurring</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Created</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium">{formatSmartDate(tenant.created_at)}</p>
              <p className="text-xs text-muted-foreground">Member since</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Business Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Owner Email</p>
                    <p className="text-base">{tenant.owner_email}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Owner Name</p>
                    <p className="text-base">{tenant.owner_name || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Phone</p>
                    <p className="text-base">{tenant.phone || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Stripe Customer ID</p>
                    <p className="text-base font-mono text-sm">{tenant.stripe_customer_id || "Not set"}</p>
                  </div>
                </div>

                {tenant.trial_ends_at && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-500 rounded-lg">
                    <p className="text-sm">
                      <strong>⏰ Trial ends:</strong> {formatSmartDate(tenant.trial_ends_at)}
                    </p>
                  </div>
                )}

                {plan && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Plan Features</p>
                    <div className="flex flex-wrap gap-2">
                      {plan.features && Array.isArray(plan.features) && plan.features.map((feature: string, index: number) => (
                        <Badge key={index} variant="outline">{feature.replace(/_/g, " ")}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(tenant.usage || {}).map(([key, value]: [string, any]) => {
                    const limit = tenant.limits?.[key] || 0;
                    const percentage = limit > 0 ? (Number(value) / limit) * 100 : 0;
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="capitalize">{key.replace(/_/g, " ")}</span>
                          <span>{Number(value).toLocaleString()} / {limit === -1 ? "Unlimited" : limit.toLocaleString()}</span>
                        </div>
                        {limit !== -1 && (
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full"
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
            {tenantId && <FeatureList tenantId={tenantId} readOnly={false} features={{}} />}
          </TabsContent>

          <TabsContent value="billing" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Current Plan</CardTitle>
                  <div className="flex gap-2">
                    <select
                      value={tenant.subscription_plan}
                      onChange={(e) => changePlanMutation.mutate(e.target.value)}
                      className="px-3 py-2 border rounded-md"
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
                    <p className="text-2xl font-bold">{formatCurrency(plan.price_monthly)}/month</p>
                    <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Invoices</CardTitle>
              </CardHeader>
              <CardContent>
                {invoices && invoices.length > 0 ? (
                  <div className="space-y-2">
                    {invoices.map((invoice: any) => (
                      <div key={invoice.id} className="flex items-center justify-between p-3 border rounded-lg">
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
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No invoices yet</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Team Members</CardTitle>
              </CardHeader>
              <CardContent>
                {tenantUsers && tenantUsers.length > 0 ? (
                  <div className="space-y-2">
                    {tenantUsers.map((user: any) => (
                      <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{user.email}</p>
                          <p className="text-sm text-muted-foreground">{user.name || "No name"}</p>
                        </div>
                        <Badge variant="outline">{user.role}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No team members</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>Recent Admin Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground py-8">
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

