/**
 * Actionable Insights Component
 * Analyzes business data and provides actionable insights with direct action buttons
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAccount } from '@/contexts/AccountContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  TrendingDown, 
  Users, 
  Package, 
  DollarSign,
  ArrowRight,
  MessageSquare
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { subDays, startOfMonth } from 'date-fns';
import { SendSMS } from './SendSMS';
import { useState } from 'react';

interface Insight {
  type: 'warning' | 'opportunity' | 'alert';
  title: string;
  description: string;
  actions: Array<{
    label: string;
    action: () => void;
    variant?: 'default' | 'outline' | 'destructive';
  }>;
}

export function ActionableInsights() {
  const { account } = useAccount();
  const navigate = useNavigate();
  const [smsOpen, setSmsOpen] = useState<{ customerId?: string; phone?: string; name?: string } | null>(null);

  const { data: insights, isLoading } = useQuery({
    queryKey: ['actionable-insights', account?.id],
    queryFn: async (): Promise<Insight[]> => {
      if (!account?.id) return [];

      const insights: Insight[] = [];
      const today = new Date();
      const thisMonthStart = startOfMonth(today);
      const lastMonthStart = startOfMonth(subDays(thisMonthStart, 1));

      try {
        // 1. Check for revenue decline
        const [thisMonthOrders, lastMonthOrders] = await Promise.all([
          supabase
            .from('wholesale_orders')
            .select('total_amount')
            .eq('account_id', account.id)
            .gte('created_at', thisMonthStart.toISOString())
            .catch(() => ({ data: null, error: null })),
          
          supabase
            .from('wholesale_orders')
            .select('total_amount')
            .eq('account_id', account.id)
            .gte('created_at', lastMonthStart.toISOString())
            .lt('created_at', thisMonthStart.toISOString())
            .catch(() => ({ data: null, error: null })),
        ]);

        if (thisMonthOrders.data && lastMonthOrders.data) {
          const thisMonthRevenue = thisMonthOrders.data.reduce(
            (sum: number, o: any) => sum + Number(o.total_amount || 0), 0
          );
          const lastMonthRevenue = lastMonthOrders.data.reduce(
            (sum: number, o: any) => sum + Number(o.total_amount || 0), 0
          );

          if (lastMonthRevenue > 0 && thisMonthRevenue < lastMonthRevenue * 0.9) {
            const declinePercent = ((1 - thisMonthRevenue / lastMonthRevenue) * 100).toFixed(1);
            insights.push({
              type: 'warning',
              title: 'Revenue Declining',
              description: `Revenue is down ${declinePercent}% this month compared to last month.`,
              actions: [
                {
                  label: 'View Revenue Reports',
                  action: () => navigate('/admin/sales-dashboard'),
                },
                {
                  label: 'Analyze Orders',
                  action: () => navigate('/admin/orders'),
                },
              ],
            });
          }
        }

        // 2. Check for inactive customers (no orders in 30+ days)
        const thirtyDaysAgo = subDays(today, 30);
        const { data: allCustomers } = await supabase
          .from('wholesale_clients')
          .select('id, business_name, contact_name, phone, email')
          .eq('account_id', account.id)
          .eq('status', 'active')
          .catch(() => ({ data: null, error: null }));

        if (allCustomers && allCustomers.length > 0) {
          const customerIds = allCustomers.map((c: any) => c.id);
          
          const { data: recentOrders } = await supabase
            .from('wholesale_orders')
            .select('customer_id, created_at')
            .eq('account_id', account.id)
            .in('customer_id', customerIds)
            .gte('created_at', thirtyDaysAgo.toISOString())
            .catch(() => ({ data: null, error: null }));

          const activeCustomerIds = new Set(
            (recentOrders?.data || []).map((o: any) => o.customer_id)
          );
          
          const inactiveCustomers = allCustomers.filter(
            (c: any) => !activeCustomerIds.has(c.id)
          );

          if (inactiveCustomers.length > 0) {
            insights.push({
              type: 'opportunity',
              title: 'Inactive Customers',
              description: `${inactiveCustomers.length} customers haven't placed an order in 30+ days.`,
              actions: [
                {
                  label: 'View All Inactive',
                  action: () => navigate('/admin/wholesale-clients?filter=inactive'),
                },
                {
                  label: 'Send Re-engagement SMS',
                  action: () => {
                    if (inactiveCustomers[0]?.phone) {
                      setSmsOpen({
                        customerId: inactiveCustomers[0].id,
                        phone: inactiveCustomers[0].phone,
                        name: inactiveCustomers[0].business_name || inactiveCustomers[0].contact_name,
                      });
                    }
                  },
                },
              ],
            });
          }
        }

        // 3. Check for low inventory
        const { data: inventory } = await supabase
          .from('wholesale_inventory')
          .select('id, strain, weight_lbs, low_stock_threshold, quantity_lbs')
          .eq('account_id', account.id)
          .catch(() => ({ data: null, error: null }));

        if (inventory && inventory.length > 0) {
          const lowStock = inventory.filter((item: any) => {
            const current = Number(item.weight_lbs || item.quantity_lbs || 0);
            const threshold = Number(item.low_stock_threshold || 10);
            return current <= threshold;
          });

          if (lowStock.length > 0) {
            insights.push({
              type: 'alert',
              title: 'Low Inventory Alert',
              description: `${lowStock.length} product${lowStock.length === 1 ? '' : 's'} ${lowStock.length === 1 ? 'is' : 'are'} below reorder point.`,
              actions: [
                {
                  label: 'Review & Reorder',
                  action: () => navigate('/admin/big-plug-inventory'),
                  variant: 'destructive' as const,
                },
                {
                  label: 'View Stock Alerts',
                  action: () => navigate('/admin/stock-alerts'),
                },
              ],
            });
          }
        }

        // 4. Check for overdue payments
        const { data: overdueOrders } = await supabase
          .from('wholesale_orders')
          .select('id, order_number, total_amount, payment_due_date, due_date, customer:wholesale_clients(business_name, phone)')
          .eq('account_id', account.id)
          .or('payment_status.eq.fronted,payment_status.eq.partial,payment_status.eq.unpaid')
          .catch(() => ({ data: null, error: null }));

        if (overdueOrders && overdueOrders.length > 0) {
          const now = new Date();
          const overdue = overdueOrders.filter((order: any) => {
            const dueDate = order.payment_due_date || order.due_date;
            if (!dueDate) return false;
            return new Date(dueDate) < now;
          });

          if (overdue.length > 0) {
            const totalOverdue = overdue.reduce(
              (sum: number, o: any) => sum + Number(o.total_amount || 0), 0
            );

            insights.push({
              type: 'alert',
              title: 'Overdue Payments',
              description: `${overdue.length} order${overdue.length === 1 ? '' : 's'} with ${formatCurrency(totalOverdue)} in overdue payments.`,
              actions: [
                {
                  label: 'View Overdue Orders',
                  action: () => navigate('/admin/wholesale-orders?filter=overdue'),
                  variant: 'destructive' as const,
                },
                {
                  label: 'Fronted Inventory',
                  action: () => navigate('/admin/fronted-inventory'),
                },
              ],
            });
          }
        }

      } catch (error: any) {
        console.error('Error generating insights:', error);
      }

      return insights;
    },
    enabled: !!account?.id,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Actionable Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Analyzing data...</div>
        </CardContent>
      </Card>
    );
  }

  if (!insights || insights.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Actionable Insights
          </CardTitle>
          <CardDescription>Business intelligence and recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Badge variant="outline" className="text-green-600 border-green-600">
              All good! No action items at this time.
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Actionable Insights
          </CardTitle>
          <CardDescription>Business intelligence and recommendations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {insights.map((insight, index) => (
            <Alert
              key={index}
              variant={
                insight.type === 'alert' ? 'destructive' : 
                insight.type === 'warning' ? 'default' : 
                'default'
              }
              className={insight.type === 'opportunity' ? 'border-blue-500' : ''}
            >
              <div className="flex items-start gap-3">
                {insight.type === 'alert' && <AlertTriangle className="h-5 w-5 mt-0.5" />}
                {insight.type === 'warning' && <TrendingDown className="h-5 w-5 mt-0.5" />}
                {insight.type === 'opportunity' && <Users className="h-5 w-5 mt-0.5 text-blue-500" />}
                
                <div className="flex-1">
                  <AlertTitle>{insight.title}</AlertTitle>
                  <AlertDescription className="mt-2">
                    <p className="mb-3">{insight.description}</p>
                    <div className="flex gap-2 flex-wrap">
                      {insight.actions.map((action, actionIndex) => (
                        <Button
                          key={actionIndex}
                          size="sm"
                          variant={action.variant || 'outline'}
                          onClick={action.action}
                        >
                          {action.label}
                          <ArrowRight className="ml-2 h-3 w-3" />
                        </Button>
                      ))}
                    </div>
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          ))}
        </CardContent>
      </Card>

      {/* SMS Dialog for re-engagement */}
      {smsOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg max-w-md w-full max-h-[90vh] overflow-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">Send Re-engagement Message</h3>
              <Button variant="ghost" size="sm" onClick={() => setSmsOpen(null)}>
                ×
              </Button>
            </div>
            <div className="p-4">
              <SendSMS
                customerId={smsOpen.customerId}
                customerPhone={smsOpen.phone}
                customerName={smsOpen.name}
                onSent={() => setSmsOpen(null)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

