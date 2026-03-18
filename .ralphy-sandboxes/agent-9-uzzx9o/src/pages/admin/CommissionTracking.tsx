import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DollarSign, Calendar, Download, Loader2,
  CheckCircle2, Clock, Percent
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { handleError } from '@/utils/errorHandling/handlers';
import { isPostgrestError } from '@/utils/errorHandling/typeGuards';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import { logger } from '@/lib/logger';
import { formatCurrency, formatSmartDate } from '@/lib/formatters';
import { queryKeys } from '@/lib/queryKeys';

interface CommissionRecord {
  id: string;
  amount: number;
  order_id: string | null;
  created_at: string;
  status: string;
  tenant_id?: string;
}

interface OrderRecord {
  id: string;
  total: string | number;
  created_at: string;
  tenant_id: string;
}

export default function CommissionTracking() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [isExporting, setIsExporting] = useState(false);

  const { data: commissions, isLoading } = useQuery({
    queryKey: queryKeys.commissionTracking.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        // Try to get from commission_transactions table first
        const { data, error } = await supabase
          .from('commission_transactions')
          .select('id, amount, order_id, created_at, status, tenant_id')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (error && error.code === '42P01') {
          // Table doesn't exist, calculate from orders
          const { data: orders, error: orderError } = await supabase
            .from('orders')
            .select('id, total, created_at, tenant_id')
            .eq('tenant_id', tenantId);

          if (orderError && orderError.code === '42P01') return [];
          if (orderError) throw orderError;

          // Calculate commissions from orders (2% default)
          return (orders ?? []).map((order: OrderRecord) => ({
            id: order.id,
            amount: parseFloat(String(order.total ?? 0)) * 0.02,
            order_id: order.id,
            created_at: order.created_at,
            status: 'pending'
          }));
        }
        if (error) throw error;
        return data ?? [];
      } catch (error) {
        if (isPostgrestError(error) && error.code === '42P01') return [];
        handleError(error, { component: 'CommissionTracking', toastTitle: 'Failed to load commissions' });
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  // Toggle commission status
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const { error } = await supabase
        .from('commission_transactions')
        .update({ status: newStatus })
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.commissionTracking.byTenant(tenantId) });
      showSuccessToast('Status Updated');
    },
    onError: (error) => {
      logger.error('Failed to update status', error, { component: 'CommissionTracking' });
      showErrorToast('Failed to update status');
    }
  });

  const handleToggleStatus = (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
    toggleStatusMutation.mutate({ id, newStatus });
  };

  // Export to CSV
  const handleExportCSV = async () => {
    if (!commissions || commissions.length === 0) {
      showErrorToast('No data to export');
      return;
    }

    setIsExporting(true);
    try {
      const csvRows = [
        ['Order ID', 'Amount', 'Status', 'Date'].join(','),
        ...commissions.map((c: CommissionRecord) => [
          c.order_id || 'N/A',
          formatCurrency(c.amount ?? 0),
          c.status || 'pending',
          formatSmartDate(c.created_at)
        ].join(','))
      ];

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `commissions-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();

      showSuccessToast('Export Complete', 'CSV file downloaded');
    } catch (error) {
      logger.error('Export failed', error, { component: 'CommissionTracking' });
      showErrorToast('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <EnhancedLoadingState variant="card" count={3} />
      </div>
    );
  }

  const totalCommissions = commissions?.reduce((sum: number, c: CommissionRecord) => sum + (c.amount ?? 0), 0) ?? 0;
  const pendingCommissions = commissions?.filter((c: CommissionRecord) => c.status !== 'paid').reduce((sum: number, c: CommissionRecord) => sum + (c.amount ?? 0), 0) ?? 0;
  const paidCommissions = commissions?.filter((c: CommissionRecord) => c.status === 'paid').reduce((sum: number, c: CommissionRecord) => sum + (c.amount ?? 0), 0) ?? 0;
  const commissionCount = commissions?.length ?? 0;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Percent className="h-8 w-8 text-emerald-500" />
            Commission Tracking
          </h1>
          <p className="text-muted-foreground">Track and manage sales commissions</p>
        </div>
        <Button
          variant="outline"
          onClick={handleExportCSV}
          disabled={isExporting || !commissions?.length}
          className="gap-2"
        >
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-background border-emerald-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Commissions</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(totalCommissions)}</div>
            <p className="text-xs text-muted-foreground mt-1">{commissionCount} transactions</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500/10 to-background border-yellow-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{formatCurrency(pendingCommissions)}</div>
            <p className="text-xs text-muted-foreground mt-1">awaiting payout</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-background border-green-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Out</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(paidCommissions)}</div>
            <p className="text-xs text-muted-foreground mt-1">completed</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-background border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commission Rate</CardTitle>
            <Percent className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">2%</div>
            <p className="text-xs text-muted-foreground mt-1">per order</p>
          </CardContent>
        </Card>
      </div>

      {/* Commissions List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Commissions</CardTitle>
              <CardDescription>Click the toggle to mark as paid/pending</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {commissions && commissions.length > 0 ? (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {commissions.slice(0, 20).map((commission: CommissionRecord) => (
                <div
                  key={commission.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">Order #{commission.order_id?.slice(0, 8) || 'N/A'}</div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <Calendar className="h-3 w-3" />
                      {formatSmartDate(commission.created_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-lg font-bold text-emerald-600">
                      {formatCurrency(commission.amount ?? 0)}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Switch
                          checked={commission.status === 'paid'}
                          onCheckedChange={() => handleToggleStatus(commission.id, commission.status)}
                          disabled={toggleStatusMutation.isPending}
                        />
                        {toggleStatusMutation.isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                      </div>
                      <Badge
                        variant={commission.status === 'paid' ? 'default' : 'secondary'}
                        className={commission.status === 'paid'
                          ? 'bg-green-500/10 text-green-600 border-green-500/20'
                          : 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
                        }
                      >
                        {commission.status === 'paid' ? (
                          <><CheckCircle2 className="h-3 w-3 mr-1" /> Paid</>
                        ) : (
                          <><Clock className="h-3 w-3 mr-1" /> Pending</>
                        )}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EnhancedEmptyState type="generic" compact
              icon={DollarSign}
              title="No Commissions Yet"
              description="Commission data will appear here once orders are processed."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
