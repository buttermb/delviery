/**
 * Super Admin Dashboard
 * Platform management for SAAS owners
 */

import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/shared/DataTable';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  TrendingUp,
  Users,
  DollarSign,
  AlertTriangle,
  Activity,
  Search,
  Eye,
  MoreVertical,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { calculateHealthScore } from '@/lib/tenant';
import { useState } from 'react';

export default function SuperAdminDashboard() {
  const { toast } = useToast();
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Platform Stats
  const { data: platformStats } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: async () => {
      // Get all tenants (super admin bypasses RLS)
      const { data: tenants } = await supabase.from('tenants').select('*');

      const totalTenants = tenants?.length || 0;
      const activeTrials = tenants?.filter((t) => t.subscription_status === 'trial').length || 0;
      const activeSubscriptions = tenants?.filter((t) => t.subscription_status === 'active').length || 0;
      
      // Calculate MRR
      const mrr = tenants?.reduce((sum, tenant) => {
        const prices: Record<string, number> = {
          starter: 99,
          professional: 299,
          enterprise: 799,
        };
        if (tenant.subscription_status === 'active') {
          return sum + (prices[tenant.subscription_plan as string] || 0);
        }
        return sum;
      }, 0) || 0;

      // Calculate growth (new tenants this month)
      const thisMonth = new Date();
      thisMonth.setDate(1);
      const newThisMonth = tenants?.filter(
        (t) => new Date(t.created_at) >= thisMonth
      ).length || 0;

      // Calculate churn (cancelled this month)
      const churnedThisMonth = tenants?.filter(
        (t) => t.subscription_status === 'cancelled' &&
          t.cancelled_at &&
          new Date(t.cancelled_at) >= thisMonth
      ).length || 0;

      const churnRate = totalTenants > 0 ? (churnedThisMonth / totalTenants) * 100 : 0;

      return {
        totalTenants,
        activeTrials,
        activeSubscriptions,
        mrr,
        newThisMonth,
        churnRate,
      };
    },
  });

  // All Tenants
  const { data: tenants, isLoading } = useQuery({
    queryKey: ['all-tenants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data.map((tenant) => ({
        ...tenant,
        healthScore: calculateHealthScore(tenant as any),
      }));
    },
  });

  // Feature Flags
  const { data: featureFlags } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: async () => {
      const { data, error } = await supabase.from('feature_flags').select('*');
      if (error) throw error;
      return data;
    },
  });

  const filteredTenants = tenants?.filter((tenant) =>
    tenant.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tenant.owner_email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleViewTenant = (tenant: any) => {
    setSelectedTenant(tenant);
    setViewDialogOpen(true);
  };

  const handleLoginAsTenant = async (tenant: any) => {
    // TODO: Implement "login as tenant" functionality
    toast({
      title: 'Login as Tenant',
      description: `Would login as ${tenant.business_name}`,
    });
  };

  const handleSuspendTenant = async (tenant: any) => {
    if (!confirm(`Suspend ${tenant.business_name}?`)) return;

    try {
      await supabase
        .from('tenants')
        .update({
          status: 'suspended',
          suspended_reason: 'Suspended by admin',
        })
        .eq('id', tenant.id);

      toast({
        title: 'Tenant Suspended',
        description: `${tenant.business_name} has been suspended`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const columns = [
    {
      accessorKey: 'business_name',
      header: 'Business',
      cell: ({ row }: any) => (
        <div>
          <div className="font-medium">{row.original.business_name}</div>
          <div className="text-sm text-muted-foreground">{row.original.owner_email}</div>
        </div>
      ),
    },
    {
      accessorKey: 'subscription_plan',
      header: 'Plan',
      cell: ({ row }: any) => (
        <Badge variant="outline">
          {row.original.subscription_plan.toUpperCase()}
        </Badge>
      ),
    },
    {
      accessorKey: 'subscription_status',
      header: 'Status',
      cell: ({ row }: any) => {
        const status = row.original.subscription_status;
        const variant =
          status === 'active' ? 'default' :
          status === 'trial' ? 'secondary' :
          status === 'past_due' ? 'destructive' : 'outline';
        return <Badge variant={variant}>{status.replace('_', ' ')}</Badge>;
      },
    },
    {
      accessorKey: 'mrr',
      header: 'MRR',
      cell: ({ row }: any) => {
        const prices: Record<string, number> = {
          starter: 99,
          professional: 299,
          enterprise: 799,
        };
        const mrr = prices[row.original.subscription_plan] || 0;
        return formatCurrency(mrr);
      },
    },
    {
      accessorKey: 'healthScore',
      header: 'Health',
      cell: ({ row }: any) => {
        const { score } = row.original.healthScore || { score: 100 };
        const color =
          score >= 80 ? 'text-emerald-500' :
          score >= 60 ? 'text-yellow-500' : 'text-red-500';
        return (
          <div className="flex items-center gap-2">
            <span className={`font-semibold ${color}`}>{score}</span>
            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${
                  score >= 80 ? 'bg-emerald-500' :
                  score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'created_at',
      header: 'Joined',
      cell: ({ row }: any) => formatSmartDate(row.original.created_at),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleViewTenant(row.original)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleLoginAsTenant(row.original)}
          >
            Login As
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSuspendTenant(row.original)}
          >
            Suspend
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">🎛️ Platform Admin</h1>
          <p className="text-muted-foreground">Manage all tenants and platform operations</p>
        </div>
      </div>

      {/* Platform Stats */}
      {platformStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <Badge variant="secondary">Total</Badge>
            </div>
            <div className="text-3xl font-bold">{platformStats.totalTenants}</div>
            <div className="text-sm text-muted-foreground">Tenants</div>
            <div className="mt-2 text-sm text-emerald-600">
              +{platformStats.newThisMonth} this month
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <Badge variant="secondary">MRR</Badge>
            </div>
            <div className="text-3xl font-bold">
              {formatCurrency(platformStats.mrr)}
            </div>
            <div className="text-sm text-muted-foreground">Monthly Recurring Revenue</div>
            <div className="mt-2 text-sm text-emerald-600">
              <TrendingUp className="h-3 w-3 inline mr-1" />
              Growing
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              <Badge variant={platformStats.churnRate > 5 ? 'destructive' : 'secondary'}>
                Churn
              </Badge>
            </div>
            <div className="text-3xl font-bold">
              {platformStats.churnRate.toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">Churn Rate</div>
            <div className="mt-2 text-sm text-muted-foreground">
              Target: &lt;5%
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <Badge variant="secondary">Trials</Badge>
            </div>
            <div className="text-3xl font-bold">{platformStats.activeTrials}</div>
            <div className="text-sm text-muted-foreground">Active Trials</div>
            <div className="mt-2 text-sm text-muted-foreground">
              {platformStats.activeSubscriptions} active subscriptions
            </div>
          </Card>
        </div>
      )}

      {/* Tenants Table */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">All Tenants</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tenants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredTenants || []}
          loading={isLoading}
          emptyMessage="No tenants found"
        />
      </Card>

      {/* Feature Flags */}
      {featureFlags && featureFlags.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Feature Flags</h2>
          <div className="space-y-3">
            {featureFlags.map((flag: any) => (
              <div key={flag.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">{flag.name}</div>
                  <div className="text-sm text-muted-foreground">{flag.description}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Enabled for: {flag.enabled_for_plans?.join(', ') || 'none'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Rollout: {flag.rollout_percentage}%</Label>
                  <input
                    type="checkbox"
                    checked={flag.enabled}
                    onChange={() => {
                      // TODO: Toggle feature flag
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tenant Detail Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTenant?.business_name}</DialogTitle>
            <DialogDescription>Tenant Details</DialogDescription>
          </DialogHeader>
          {selectedTenant && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Business Name</Label>
                  <p className="font-medium">{selectedTenant.business_name}</p>
                </div>
                <div>
                  <Label>Owner</Label>
                  <p className="font-medium">{selectedTenant.owner_name}</p>
                </div>
                <div>
                  <Label>Email</Label>
                  <p className="font-medium">{selectedTenant.owner_email}</p>
                </div>
                <div>
                  <Label>Phone</Label>
                  <p className="font-medium">{selectedTenant.phone || '—'}</p>
                </div>
                <div>
                  <Label>Plan</Label>
                  <Badge>{selectedTenant.subscription_plan}</Badge>
                </div>
                <div>
                  <Label>Status</Label>
                  <Badge variant={
                    selectedTenant.subscription_status === 'active' ? 'default' :
                    selectedTenant.subscription_status === 'trial' ? 'secondary' : 'destructive'
                  }>
                    {selectedTenant.subscription_status}
                  </Badge>
                </div>
                <div>
                  <Label>Created</Label>
                  <p className="text-sm">{formatSmartDate(selectedTenant.created_at)}</p>
                </div>
                <div>
                  <Label>Last Activity</Label>
                  <p className="text-sm">
                    {selectedTenant.last_activity_at
                      ? formatSmartDate(selectedTenant.last_activity_at)
                      : 'Never'}
                  </p>
                </div>
              </div>

              <div>
                <Label>Usage</Label>
                <div className="mt-2 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Customers:</span>
                    <span>
                      {selectedTenant.usage?.customers || 0} /{' '}
                      {selectedTenant.limits?.customers === -1
                        ? '∞'
                        : selectedTenant.limits?.customers || 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Menus:</span>
                    <span>
                      {selectedTenant.usage?.menus || 0} /{' '}
                      {selectedTenant.limits?.menus === -1 ? '∞' : selectedTenant.limits?.menus || 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Products:</span>
                    <span>
                      {selectedTenant.usage?.products || 0} /{' '}
                      {selectedTenant.limits?.products === -1
                        ? '∞'
                        : selectedTenant.limits?.products || 0}
                    </span>
                  </div>
                </div>
              </div>

              {selectedTenant.healthScore && (
                <div>
                  <Label>Health Score</Label>
                  <div className="mt-2">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl font-bold">
                        {selectedTenant.healthScore.score}
                      </span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            selectedTenant.healthScore.score >= 80
                              ? 'bg-emerald-500'
                              : selectedTenant.healthScore.score >= 60
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${selectedTenant.healthScore.score}%` }}
                        />
                      </div>
                    </div>
                    {selectedTenant.healthScore.reasons.length > 0 && (
                      <div className="text-sm text-muted-foreground">
                        {selectedTenant.healthScore.reasons.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

