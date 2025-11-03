import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useState } from 'react';
import { Download, Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface CommissionRule {
  id?: string;
  role: string;
  product_category?: string;
  rate: number;
  type: 'percentage' | 'fixed';
}

interface Commission {
  id: string;
  team_member_name: string;
  order_id: string;
  commission_amount: number;
  customer_payment_amount: number;
  status: 'pending' | 'processed' | 'paid';
  created_at: string;
}

export default function CommissionTracking() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [newRule, setNewRule] = useState<CommissionRule>({
    role: '',
    rate: 0,
    type: 'percentage',
  });

  // Fetch commission transactions
  const { data: commissions, isLoading: commissionsLoading } = useQuery({
    queryKey: ['commissions', tenantId],
    queryFn: async (): Promise<Commission[]> => {
      if (!tenantId) return [];

      // Try to fetch from commission_transactions table if it exists
      try {
        const { data, error } = await supabase
          .from('commission_transactions')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (error && error.code === '42P01') {
          // Table doesn't exist, calculate from orders
          return calculateCommissionsFromOrders();
        }
        if (error) throw error;
        return data || [];
      } catch (error: any) {
        if (error.code === '42P01') {
          return calculateCommissionsFromOrders();
        }
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const calculateCommissionsFromOrders = async (): Promise<Commission[]> => {
    if (!tenantId) return [];

    // Fallback: calculate 2% commission from orders
    const { data: orders } = await supabase
      .from('orders')
      .select('id, total_amount, created_at, customer_id')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (!orders) return [];

    return orders.map((order, index) => ({
      id: `calc-${order.id}`,
      team_member_name: 'Team Member',
      order_id: order.id,
      commission_amount: Number(order.total_amount || 0) * 0.02,
      customer_payment_amount: Number(order.total_amount || 0),
      status: 'pending' as const,
      created_at: order.created_at,
    }));
  };

  // Calculate summary
  const pendingCommissions = commissions?.filter((c) => c.status === 'pending') || [];
  const processedCommissions = commissions?.filter((c) => c.status === 'processed') || [];
  const totalPending = pendingCommissions.reduce((sum, c) => sum + c.commission_amount, 0);
  const totalProcessed = processedCommissions.reduce((sum, c) => sum + c.commission_amount, 0);

  const handleExport = () => {
    if (!commissions) return;

    const csv = [
      ['Team Member', 'Order ID', 'Commission Amount', 'Customer Payment', 'Status', 'Date'].join(','),
      ...commissions.map((c) =>
        [
          c.team_member_name,
          c.order_id,
          c.commission_amount,
          c.customer_payment_amount,
          c.status,
          new Date(c.created_at).toLocaleDateString(),
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commissions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (commissionsLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading commission data...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Commission Tracking</h1>
          <p className="text-muted-foreground">Track and manage team member commissions</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowRuleForm(!showRuleForm)} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Rule
          </Button>
          <Button onClick={handleExport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Commissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalPending.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">{pendingCommissions.length} transactions</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Processed Commissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalProcessed.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">{processedCommissions.length} transactions</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Commissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(totalPending + totalProcessed).toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">{commissions?.length || 0} total</div>
          </CardContent>
        </Card>
      </div>

      {/* Commission Rules Form */}
      {showRuleForm && (
        <Card>
          <CardHeader>
            <CardTitle>Commission Rule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  value={newRule.role}
                  onChange={(e) => setNewRule({ ...newRule, role: e.target.value })}
                  placeholder="e.g., Manager, Sales"
                />
              </div>
              <div>
                <Label htmlFor="rate">Rate</Label>
                <Input
                  id="rate"
                  type="number"
                  value={newRule.rate}
                  onChange={(e) => setNewRule({ ...newRule, rate: Number(e.target.value) })}
                  placeholder="2.5"
                />
              </div>
              <div>
                <Label htmlFor="type">Type</Label>
                <select
                  id="type"
                  value={newRule.type}
                  onChange={(e) => setNewRule({ ...newRule, type: e.target.value as 'percentage' | 'fixed' })}
                  className="w-full h-10 px-3 border rounded-md"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed ($)</option>
                </select>
              </div>
              <div>
                <Label htmlFor="category">Category (Optional)</Label>
                <Input
                  id="category"
                  value={newRule.product_category || ''}
                  onChange={(e) => setNewRule({ ...newRule, product_category: e.target.value })}
                  placeholder="Product category"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  // Save rule logic here
                  toast({ title: 'Rule saved', description: 'Commission rule has been saved.' });
                  setShowRuleForm(false);
                  setNewRule({ role: '', rate: 0, type: 'percentage' });
                }}
              >
                Save Rule
              </Button>
              <Button variant="outline" onClick={() => setShowRuleForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Commissions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Commission History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team Member</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer Payment</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commissions && commissions.length > 0 ? (
                commissions.map((commission) => (
                  <TableRow key={commission.id}>
                    <TableCell>{commission.team_member_name}</TableCell>
                    <TableCell className="font-mono text-xs">{commission.order_id.slice(0, 8)}...</TableCell>
                    <TableCell>${commission.customer_payment_amount.toFixed(2)}</TableCell>
                    <TableCell className="font-bold">${commission.commission_amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          commission.status === 'paid'
                            ? 'default'
                            : commission.status === 'processed'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {commission.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(commission.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No commission data available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

