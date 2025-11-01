import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  Building2, 
  TrendingDown, 
  TrendingUp,
  Search,
  Eye,
  LogIn,
  Plus,
  ArrowRight,
  Settings
} from "lucide-react";
import { useSuperAdminAuth } from "@/contexts/SuperAdminAuthContext";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { formatSmartDate } from "@/lib/utils/formatDate";
import { Link } from "react-router-dom";

export default function SuperAdminDashboardPage() {
  const navigate = useNavigate();
  const { superAdmin, logout } = useSuperAdminAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch platform stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["super-admin-platform-stats"],
    queryFn: async () => {
      const { data: tenants } = await supabase
        .from("tenants")
        .select("subscription_plan, subscription_status, mrr, created_at");

      if (!tenants) return null;

      const active = tenants.filter((t) => t.subscription_status === "active");
      const trials = tenants.filter((t) => t.subscription_status === "trial" || t.subscription_status === "trialing");
      
      const mrr = tenants.reduce((sum, t) => sum + (Number(t.mrr) || 0), 0);
      const arr = mrr * 12;

      // Calculate churn rate (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentCancelled = tenants.filter(
        (t) => t.subscription_status === "cancelled" && new Date(t.created_at || 0) > thirtyDaysAgo
      );
      const churnRate = active.length > 0 ? (recentCancelled.length / active.length) * 100 : 0;

      // Calculate new signups (last 30 days)
      const newSignups = tenants.filter(
        (t) => new Date(t.created_at || 0) > thirtyDaysAgo
      ).length;

      return {
        mrr,
        arr,
        totalTenants: tenants.length,
        activeTenants: active.length,
        trialTenants: trials.length,
        churnRate,
        newSignups,
      };
    },
  });

  // Fetch all tenants
  const { data: tenants, isLoading: tenantsLoading } = useQuery({
    queryKey: ["super-admin-tenants", searchTerm, statusFilter],
    queryFn: async () => {
      let query = supabase.from("tenants").select("*");

      if (searchTerm) {
        query = query.or(`business_name.ilike.%${searchTerm}%,slug.ilike.%${searchTerm}%,owner_email.ilike.%${searchTerm}%`);
      }

      if (statusFilter !== "all") {
        query = query.eq("subscription_status", statusFilter);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const handleLogout = async () => {
    await logout();
    navigate("/super-admin/login");
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      trial: "secondary",
      trialing: "secondary",
      past_due: "destructive",
      cancelled: "outline",
      suspended: "destructive",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const platformStats = stats || {
    mrr: 0,
    arr: 0,
    totalTenants: 0,
    activeTenants: 0,
    trialTenants: 0,
    churnRate: 0,
    newSignups: 0,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">🎛️ Platform Admin</h1>
            <p className="text-sm text-muted-foreground">Complete control center for your SaaS platform</p>
          </div>
          <div className="flex items-center gap-4">
            {superAdmin && (
              <div className="text-sm text-muted-foreground">
                {superAdmin.email}
              </div>
            )}
            <Button variant="ghost" asChild>
              <Link to="/super-admin/settings">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Link>
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-6 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">💰 MRR</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(platformStats.mrr)}</div>
              <p className="text-xs text-green-600 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                +15% ↑
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">🏢 Tenants</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{platformStats.activeTenants} Active</div>
              <p className="text-xs text-muted-foreground">
                {platformStats.totalTenants} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">📉 Churn</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{platformStats.churnRate.toFixed(1)}%</div>
              <p className="text-xs text-green-600 flex items-center gap-1">
                <TrendingDown className="h-3 w-3" />
                -0.5% ↓
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">🆓 Trials</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{platformStats.trialTenants} Active</div>
              <p className="text-xs text-muted-foreground">
                {platformStats.newSignups} new this month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">💳 Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(platformStats.arr / 1000)}k ARR</div>
              <p className="text-xs text-green-600">+18% YoY</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">📈 Growth</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">+{platformStats.newSignups}</div>
              <p className="text-xs text-muted-foreground">New this month</p>
            </CardContent>
          </Card>
        </div>

        {/* Tenant Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>🏢 All Tenants</CardTitle>
              <Button asChild>
                <Link to="/super-admin/tenants/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Tenant
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex gap-2 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tenants..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="past_due">Past Due</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Tenant Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium">Business</th>
                    <th className="text-left p-3 text-sm font-medium">Plan</th>
                    <th className="text-left p-3 text-sm font-medium">Status</th>
                    <th className="text-left p-3 text-sm font-medium">MRR</th>
                    <th className="text-left p-3 text-sm font-medium">Joined</th>
                    <th className="text-left p-3 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tenantsLoading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        Loading tenants...
                      </td>
                    </tr>
                  ) : tenants && tenants.length > 0 ? (
                    tenants.map((tenant: any) => (
                      <tr
                        key={tenant.id}
                        className="border-t hover:bg-muted/50 cursor-pointer"
                        onClick={() => navigate(`/super-admin/tenants/${tenant.id}`)}
                      >
                        <td className="p-3">
                          <div className="font-medium">{tenant.business_name}</div>
                          <div className="text-sm text-muted-foreground">{tenant.slug}</div>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline">{tenant.subscription_plan}</Badge>
                        </td>
                        <td className="p-3">{getStatusBadge(tenant.subscription_status)}</td>
                        <td className="p-3">{formatCurrency(tenant.mrr || 0)}</td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {formatSmartDate(tenant.created_at)}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/super-admin/tenants/${tenant.id}`, { replace: false });
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Login as tenant functionality
                                window.open(`/${tenant.slug}/admin/dashboard`, '_blank');
                              }}
                            >
                              <LogIn className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        No tenants found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

