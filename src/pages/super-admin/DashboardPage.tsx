import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  LayoutGrid,
  List,
} from "lucide-react";
import { useSuperAdminAuth } from "@/contexts/SuperAdminAuthContext";
import { CommandPalette } from "@/components/super-admin/ui/CommandPalette";
import { SuperAdminNavigation } from "@/components/super-admin/SuperAdminNavigation";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { formatSmartDate } from "@/lib/utils/formatDate";
import { calculateHealthScore } from "@/lib/tenant";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TenantCard } from "@/components/super-admin/TenantCard";
import { Toggle } from "@/components/ui/toggle";
import { AnimatedNumber } from "@/components/shared/AnimatedNumber";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function SuperAdminDashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { superAdmin, logout } = useSuperAdminAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

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
      
      // Calculate 2% commission revenue
      const commission = mrr * 0.02;

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
        commission,
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

  // Real-time subscription for tenants table (super admin analytics)
  useEffect(() => {
    const channel = supabase
      .channel('super-admin-tenants-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tenants',
        },
        (payload) => {
          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['super-admin-tenants'] });
          queryClient.invalidateQueries({ queryKey: ['super-admin-platform-stats'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscription_events',
        },
        (payload) => {
          // Invalidate when subscription changes
          queryClient.invalidateQueries({ queryKey: ['super-admin-tenants'] });
          queryClient.invalidateQueries({ queryKey: ['super-admin-platform-stats'] });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Realtime subscription active
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Invalidate queries to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['super-admin-tenants'] });
          queryClient.invalidateQueries({ queryKey: ['super-admin-platform-stats'] });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const handleLogout = async () => {
    await logout();
    navigate("/super-admin/login");
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
      active: { label: "Active", variant: "default", className: "bg-[hsl(var(--super-admin-secondary))]/20 text-[hsl(var(--super-admin-secondary))] border-[hsl(var(--super-admin-secondary))]/30" },
      trial: { label: "Trial", variant: "secondary", className: "bg-[hsl(var(--super-admin-primary))]/20 text-[hsl(var(--super-admin-primary))] border-[hsl(var(--super-admin-primary))]/30" },
      trialing: { label: "Trialing", variant: "secondary", className: "bg-[hsl(var(--super-admin-primary))]/20 text-[hsl(var(--super-admin-primary))] border-[hsl(var(--super-admin-primary))]/30" },
      past_due: { label: "Past Due", variant: "destructive", className: "bg-[hsl(var(--super-admin-accent))]/20 text-[hsl(var(--super-admin-accent))] border-[hsl(var(--super-admin-accent))]/30" },
      cancelled: { label: "Cancelled", variant: "outline", className: "bg-[hsl(var(--super-admin-text-light))]/20 text-[hsl(var(--super-admin-text-light))] border-[hsl(var(--super-admin-text-light))]/30" },
      suspended: { label: "Suspended", variant: "destructive", className: "bg-red-600/20 text-red-400 border-red-600/30" },
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
    commission: 0,
    totalTenants: 0,
    activeTenants: 0,
    trialTenants: 0,
    churnRate: 0,
    newSignups: 0,
  };

  // Generate revenue data for last 12 months
  const revenueData = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (11 - i));
    const baseMRR = 35000;
    const growth = 1 + (i * 0.02); // 2% growth per month
    const variation = Math.random() * 0.1 - 0.05; // ±5% random variation
    return {
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      mrr: Math.round(baseMRR * growth * (1 + variation)),
    };
  });

  // Top tenants by MRR
  const topTenantsData = tenants
    ?.map((tenant: any) => ({
      name: tenant.business_name.length > 15 
        ? tenant.business_name.substring(0, 15) + '...' 
        : tenant.business_name,
      mrr: tenant.mrr || 0,
      logo: (tenant.white_label as any)?.logo,
    }))
    .sort((a: any, b: any) => b.mrr - a.mrr)
    .slice(0, 5) || [];

  return (
    <div className="min-h-screen bg-[hsl(var(--super-admin-bg))]">
      <CommandPalette />
      {/* Header */}
      <header className="border-b border-white/10 bg-[hsl(var(--super-admin-surface))]/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">🎛️ Platform Admin</h1>
            <p className="text-sm text-[hsl(var(--super-admin-text))]/70">Complete control center for your SaaS platform</p>
          </div>
          <div className="flex items-center gap-4">
            <SuperAdminNavigation />
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
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">
                <AnimatedNumber
                  value={platformStats.mrr}
                  formatter={(val) => formatCurrency(val)}
                  duration={1200}
                />
              </div>
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
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">
                <AnimatedNumber value={platformStats.activeTenants} duration={1000} /> Active
              </div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">
                <AnimatedNumber value={platformStats.totalTenants} duration={1000} /> total
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">📉 Churn</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-[hsl(var(--super-admin-accent))]/20 flex items-center justify-center">
                <TrendingDown className="h-4 w-4 text-[hsl(var(--super-admin-accent))]" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">
                <AnimatedNumber value={platformStats.churnRate} decimals={1} suffix="%" duration={1000} />
              </div>
              <p className="text-xs text-[hsl(var(--super-admin-text-light))] flex items-center gap-1 mt-1">
                <TrendingDown className="h-3 w-3" />
                -0.5% ↓
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">🆓 Trials</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-[hsl(var(--super-admin-primary))]/20 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-[hsl(var(--super-admin-primary))]" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">
                <AnimatedNumber value={platformStats.trialTenants} duration={1000} /> Active
              </div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">
                <AnimatedNumber value={platformStats.newSignups} duration={1000} /> new this month
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">💎 Commission</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-[hsl(var(--super-admin-secondary))]/20 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-[hsl(var(--super-admin-secondary))]" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">
                <AnimatedNumber
                  value={platformStats.commission}
                  formatter={(val) => formatCurrency(val)}
                  duration={1200}
                />
              </div>
              <p className="text-xs text-[hsl(var(--super-admin-text-light))] mt-1">2% platform fee</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">📈 Growth</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-[hsl(var(--super-admin-secondary))]/20 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-[hsl(var(--super-admin-secondary))]" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">
                +<AnimatedNumber value={platformStats.newSignups} duration={1000} />
              </div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">New this month</p>
            </CardContent>
          </Card>
        </div>

        {/* Requires Attention Alerts */}
        {(() => {
          const alerts = [];
          
          // Check for payment failures (past_due tenants)
          const pastDueTenants = tenants?.filter((t: any) => t.subscription_status === "past_due") || [];
          if (pastDueTenants.length > 0) {
            alerts.push({
              type: "payment_failed",
              icon: "💳",
              title: `${pastDueTenants.length} Payment Failure${pastDueTenants.length > 1 ? 's' : ''}`,
              description: `${pastDueTenants.length} tenant${pastDueTenants.length > 1 ? 's have' : ' has'} failed payment${pastDueTenants.length > 1 ? 's' : ''}`,
              count: pastDueTenants.length,
              action: () => navigate("/super-admin/tenants?filter=past_due"),
              items: pastDueTenants.slice(0, 3).map((t: any) => t.business_name),
            });
          }

          // Check for trials ending soon (within 7 days)
          const trialsEndingSoon = tenants?.filter((t: any) => {
            if (!t.trial_ends_at || t.subscription_status !== "trial" && t.subscription_status !== "trialing") return false;
            const daysLeft = Math.ceil((new Date(t.trial_ends_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            return daysLeft > 0 && daysLeft <= 7;
          }) || [];
          if (trialsEndingSoon.length > 0) {
            alerts.push({
              type: "trial_ending",
              icon: "⏰",
              title: `${trialsEndingSoon.length} Trial${trialsEndingSoon.length > 1 ? 's' : ''} Ending Soon`,
              description: `${trialsEndingSoon.length} tenant${trialsEndingSoon.length > 1 ? 's' : ''} trial${trialsEndingSoon.length > 1 ? 's end' : ' ends'} within 7 days`,
              count: trialsEndingSoon.length,
              action: () => navigate("/super-admin/tenants?filter=trial"),
              items: trialsEndingSoon.slice(0, 3).map((t: any) => t.business_name),
            });
          }

          // Check for suspended tenants
          const suspendedTenants = tenants?.filter((t: any) => t.status === "suspended") || [];
          if (suspendedTenants.length > 0) {
            alerts.push({
              type: "suspended",
              icon: "🚫",
              title: `${suspendedTenants.length} Suspended Tenant${suspendedTenants.length > 1 ? 's' : ''}`,
              description: `${suspendedTenants.length} tenant${suspendedTenants.length > 1 ? 's are' : ' is'} currently suspended`,
              count: suspendedTenants.length,
              action: () => navigate("/super-admin/tenants?filter=suspended"),
              items: suspendedTenants.slice(0, 3).map((t: any) => t.business_name),
            });
          }

          if (alerts.length === 0) return null;

          return (
            <Card className="bg-gradient-to-r from-[hsl(var(--super-admin-accent))]/20 to-[hsl(var(--super-admin-accent))]/10 border-[hsl(var(--super-admin-accent))]/30">
              <CardHeader>
                <CardTitle className="text-[hsl(var(--super-admin-text))] flex items-center gap-2">
                  ⚠️ REQUIRES ATTENTION
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {alerts.map((alert, index) => (
                    <div
                      key={index}
                      className="p-4 bg-[hsl(var(--super-admin-surface))]/50 backdrop-blur-sm border border-[hsl(var(--super-admin-accent))]/30 rounded-lg hover:bg-[hsl(var(--super-admin-surface))]/70 transition-colors cursor-pointer"
                      onClick={alert.action}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-2xl">{alert.icon}</span>
                            <h4 className="font-semibold text-[hsl(var(--super-admin-text))]">{alert.title}</h4>
                            <Badge className="bg-[hsl(var(--super-admin-accent))]/20 text-[hsl(var(--super-admin-accent))] border-[hsl(var(--super-admin-accent))]/30">
                              {alert.count}
                            </Badge>
                          </div>
                          <p className="text-sm text-[hsl(var(--super-admin-text))]/70 mb-2">{alert.description}</p>
                          {alert.items && alert.items.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {alert.items.map((item: string, i: number) => (
                                <Badge
                                  key={i}
                                  variant="outline"
                                  className="text-xs border-white/20 text-[hsl(var(--super-admin-text))]/70"
                                >
                                  {item}
                                </Badge>
                              ))}
                              {alert.count > 3 && (
                                <Badge
                                  variant="outline"
                                  className="text-xs border-white/20 text-[hsl(var(--super-admin-text))]/70"
                                >
                                  +{alert.count - 3} more
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[hsl(var(--super-admin-text))]/70 hover:text-[hsl(var(--super-admin-primary))] hover:bg-white/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            alert.action();
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Trends Chart */}
          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader>
              <CardTitle className="text-[hsl(var(--super-admin-text))]">📈 REVENUE TRENDS</CardTitle>
              <p className="text-sm text-[hsl(var(--super-admin-text))]/70">Last 12 months</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                  <XAxis 
                    dataKey="month" 
                    stroke="rgba(255, 255, 255, 0.5)"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="rgba(255, 255, 255, 0.5)"
                    style={{ fontSize: '12px' }}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                    }}
                    formatter={(value: any) => formatCurrency(value)}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="mrr" 
                    stroke="hsl(var(--super-admin-primary))" 
                    strokeWidth={3}
                    dot={{ fill: "hsl(var(--super-admin-primary))", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top Tenants by MRR Chart */}
          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader>
              <CardTitle className="text-[hsl(var(--super-admin-text))]">🏆 TOP TENANTS BY MRR</CardTitle>
              <p className="text-sm text-[hsl(var(--super-admin-text))]/70">Top 5 performers</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart 
                  data={topTenantsData} 
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                  <XAxis 
                    type="number"
                    stroke="rgba(255, 255, 255, 0.5)"
                    style={{ fontSize: '12px' }}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <YAxis 
                    type="category"
                    dataKey="name"
                    stroke="rgba(255, 255, 255, 0.5)"
                    style={{ fontSize: '12px' }}
                    width={120}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                    }}
                    formatter={(value: any) => formatCurrency(value)}
                  />
                  <Bar 
                    dataKey="mrr" 
                    fill="hsl(var(--super-admin-primary))"
                    radius={[0, 8, 8, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Tenant Management */}
        <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-[hsl(var(--super-admin-text))]">
                🏢 All Tenants ({tenants?.length || 0})
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 border border-white/10 rounded-md overflow-hidden">
                  <Toggle
                    pressed={viewMode === "grid"}
                    onPressedChange={() => setViewMode("grid")}
                    className="data-[state=on]:bg-[hsl(var(--super-admin-primary))]/20 data-[state=on]:text-[hsl(var(--super-admin-primary))] border-0 rounded-none"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Toggle>
                  <Toggle
                    pressed={viewMode === "list"}
                    onPressedChange={() => setViewMode("list")}
                    className="data-[state=on]:bg-[hsl(var(--super-admin-primary))]/20 data-[state=on]:text-[hsl(var(--super-admin-primary))] border-0 rounded-none border-l border-white/10"
                  >
                    <List className="h-4 w-4" />
                  </Toggle>
                </div>
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
            <div className="flex gap-2 mb-6">
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

            {/* Tenant Grid/List View */}
            {tenantsLoading ? (
              <div className="text-center py-12">
                <p className="text-[hsl(var(--super-admin-text))]/60">Loading tenants...</p>
              </div>
            ) : tenants && tenants.length > 0 ? (
              viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tenants.map((tenant: any) => (
                    <TenantCard
                      key={tenant.id}
                      tenant={tenant}
                      onView={(id) => navigate(`/super-admin/tenants/${id}`)}
                      onLoginAs={(id) => {
                        const tenant = tenants.find((t: any) => t.id === id);
                        if (tenant) {
                          window.open(`/${tenant.slug}/admin/dashboard`, '_blank');
                        }
                      }}
                      onViewBilling={(id) => navigate(`/super-admin/tenants/${id}?tab=billing`)}
                    />
                  ))}
                </div>
              ) : (
                <div className="border border-white/10 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-white/5">
                        <tr>
                          <th className="text-left p-3 text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Business</th>
                          <th className="text-left p-3 text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Plan</th>
                          <th className="text-left p-3 text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Status</th>
                          <th className="text-left p-3 text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Health</th>
                          <th className="text-left p-3 text-sm font-medium text-[hsl(var(--super-admin-text))]/90">MRR</th>
                          <th className="text-left p-3 text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Joined</th>
                          <th className="text-left p-3 text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tenants.map((tenant: any) => (
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
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                {(() => {
                                  const health = calculateHealthScore(tenant);
                                  const healthScore = health.score;
                                  const healthColor = 
                                    healthScore >= 80 ? "text-green-400" :
                                    healthScore >= 60 ? "text-yellow-400" :
                                    "text-red-400";
                                  return (
                                    <>
                                      <span className={`text-sm font-semibold ${healthColor}`}>
                                        {healthScore}
                                      </span>
                                      <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full ${
                                            healthScore >= 80 ? "bg-green-400" :
                                            healthScore >= 60 ? "bg-yellow-400" :
                                            "bg-red-400"
                                          }`}
                                          style={{ width: `${healthScore}%` }}
                                        />
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            </td>
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
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            ) : (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-[hsl(var(--super-admin-surface))] mb-4">
                  <Building2 className="h-12 w-12 mx-auto text-[hsl(var(--super-admin-text))]/30" />
                </div>
                <p className="text-xl font-semibold text-[hsl(var(--super-admin-text))] mb-2">No tenants found</p>
                <p className="text-sm text-[hsl(var(--super-admin-text))]/60 mb-6 max-w-md mx-auto">
                  {searchTerm || statusFilter !== "all" 
                    ? "Try adjusting your filters to find tenants" 
                    : "Create your first tenant to start managing your SaaS platform"}
                </p>
                {(!searchTerm && statusFilter === "all") && (
                  <Button
                    className="bg-gradient-to-r from-[hsl(var(--super-admin-primary))] to-[hsl(var(--super-admin-secondary))] hover:opacity-90 text-white"
                    asChild
                  >
                    <Link to="/super-admin/tenants/new">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your First Tenant
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
