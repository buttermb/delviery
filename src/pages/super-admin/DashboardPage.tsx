import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
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
  Settings,
  Filter,
  Download,
  MoreVertical,
  AlertCircle,
} from "lucide-react";
import { useSuperAdminAuth } from "@/contexts/SuperAdminAuthContext";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { formatSmartDate } from "@/lib/utils/formatDate";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
      active: { label: "Active", variant: "default", className: "bg-green-500/20 text-green-400 border-green-500/30" },
      trial: { label: "Trial", variant: "secondary", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
      trialing: { label: "Trialing", variant: "secondary", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
      past_due: { label: "Past Due", variant: "destructive", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
      cancelled: { label: "Cancelled", variant: "outline", className: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
      suspended: { label: "Suspended", variant: "destructive", className: "bg-red-500/20 text-red-400 border-red-500/30" },
    };

    const config = statusConfig[status] || { label: status.toUpperCase(), variant: "outline", className: "" };

    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
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
    <div className="min-h-screen bg-[hsl(var(--super-admin-bg))]">
      {/* Header */}
      <header className="border-b border-white/10 bg-[hsl(var(--super-admin-surface))]/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">🎛️ Platform Admin</h1>
            <p className="text-sm text-[hsl(var(--super-admin-text))]/70">Complete control center for your SaaS platform</p>
          </div>
          <div className="flex items-center gap-4">
            {superAdmin && (
              <div className="text-sm text-[hsl(var(--super-admin-text))]/70">
                {superAdmin.email}
              </div>
            )}
            <Button variant="ghost" asChild className="text-[hsl(var(--super-admin-text))]/90 hover:text-[hsl(var(--super-admin-text))] hover:bg-white/10">
              <Link to="/super-admin/settings">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Link>
            </Button>
            <Button variant="outline" onClick={handleLogout} className="border-white/10 text-[hsl(var(--super-admin-text))] hover:bg-white/10">
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-6 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">💰 MRR</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-[hsl(var(--super-admin-primary))]/20 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-[hsl(var(--super-admin-primary))]" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">{formatCurrency(platformStats.mrr)}</div>
              <p className="text-xs text-green-400 flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3" />
                +15% ↑
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">🏢 Tenants</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-[hsl(var(--super-admin-primary))]/20 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-[hsl(var(--super-admin-primary))]" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">{platformStats.activeTenants} Active</div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">
                {platformStats.totalTenants} total
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">📉 Churn</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <TrendingDown className="h-4 w-4 text-yellow-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">{platformStats.churnRate.toFixed(1)}%</div>
              <p className="text-xs text-green-400 flex items-center gap-1 mt-1">
                <TrendingDown className="h-3 w-3" />
                -0.5% ↓
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">🆓 Trials</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">{platformStats.trialTenants} Active</div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">
                {platformStats.newSignups} new this month
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">💳 Revenue</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-[hsl(var(--super-admin-primary))]/20 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-[hsl(var(--super-admin-primary))]" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">{formatCurrency(platformStats.arr / 1000)}k ARR</div>
              <p className="text-xs text-green-400 mt-1">+18% YoY</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">📈 Growth</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">+{platformStats.newSignups}</div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">New this month</p>
            </CardContent>
          </Card>
        </div>

        {/* Tenant Management */}
        <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-[hsl(var(--super-admin-text))]">🏢 All Tenants</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/10 text-[hsl(var(--super-admin-text))] hover:bg-white/10"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button
                  className="bg-gradient-to-r from-[hsl(var(--super-admin-primary))] to-[hsl(var(--super-admin-secondary))] hover:opacity-90 text-white"
                  asChild
                >
                  <Link to="/super-admin/tenants/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Tenant
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex gap-2 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[hsl(var(--super-admin-text))]/50" />
                <Input
                  placeholder="Search tenants..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-[hsl(var(--super-admin-bg))]/50 border-white/10 text-[hsl(var(--super-admin-text))] placeholder:text-[hsl(var(--super-admin-text))]/50"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-white/10 rounded-md bg-[hsl(var(--super-admin-bg))]/50 text-[hsl(var(--super-admin-text))]"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="past_due">Past Due</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Tenant Table */}
            <div className="border border-white/10 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Business</th>
                      <th className="text-left p-3 text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Plan</th>
                      <th className="text-left p-3 text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Status</th>
                      <th className="text-left p-3 text-sm font-medium text-[hsl(var(--super-admin-text))]/90">MRR</th>
                      <th className="text-left p-3 text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Joined</th>
                      <th className="text-left p-3 text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenantsLoading ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-[hsl(var(--super-admin-text))]/60">
                          Loading tenants...
                        </td>
                      </tr>
                    ) : tenants && tenants.length > 0 ? (
                      tenants.map((tenant: any) => (
                        <tr
                          key={tenant.id}
                          className="border-t border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                          onClick={() => navigate(`/super-admin/tenants/${tenant.id}`)}
                        >
                          <td className="p-3">
                            <div className="font-medium text-[hsl(var(--super-admin-text))]">{tenant.business_name}</div>
                            <div className="text-sm text-[hsl(var(--super-admin-text))]/60">{tenant.slug}</div>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="border-[hsl(var(--super-admin-primary))]/30 text-[hsl(var(--super-admin-primary))]">
                              {tenant.subscription_plan}
                            </Badge>
                          </td>
                          <td className="p-3">{getStatusBadge(tenant.subscription_status)}</td>
                          <td className="p-3 text-[hsl(var(--super-admin-text))]">{formatCurrency(tenant.mrr || 0)}</td>
                          <td className="p-3 text-sm text-[hsl(var(--super-admin-text))]/60">
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
                                className="hover:bg-white/10 text-[hsl(var(--super-admin-text))]"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(`/${tenant.slug}/admin/dashboard`, '_blank');
                                }}
                                className="hover:bg-white/10 text-[hsl(var(--super-admin-text))]"
                              >
                                <LogIn className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-[hsl(var(--super-admin-text))]/60">
                          No tenants found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
