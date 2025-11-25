import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';

export function StrategicDecisionsWidget() {
    const { tenant } = useTenantAdminAuth();
    const navigate = useNavigate();

    const { data: decisions, isLoading } = useQuery({
        queryKey: ['hotbox-strategic', tenant?.id],
        queryFn: async () => {
            if (!tenant?.id) return [];

            const items: Array<{
                id: string;
                emoji: string;
                title: string;
                description: string;
                priority: 'critical' | 'high' | 'medium';
                action: string;
            }> = [];

            // Check wholesale pipeline value
            const { data: wholesalePending } = await supabase
                .from('wholesale_orders')
                .select('total_amount')
                .eq('tenant_id', tenant.id)
                .eq('status', 'pending');

            const wholesalePipelineValue = wholesalePending?.reduce(
                (sum, o) => sum + Number(o.total_amount || 0), 0
            ) || 0;

            if (wholesalePipelineValue > 10000) {
                items.push({
                    id: 'wholesale-pipeline',
                    emoji: '💼',
                    title: 'High-Value Wholesale Pipeline',
                    description: `$${wholesalePipelineValue.toLocaleString()} in pending approvals`,
                    priority: wholesalePipelineValue > 50000 ? 'critical' : 'high',
                    action: '/admin/wholesale-orders',
                });
            }

            // Check inventory investment
            const { data: products } = await supabase
                .from('products')
                .select('price, stock_quantity')
                .eq('tenant_id', tenant.id)
                .gt('stock_quantity', 0);

            const inventoryValue = products?.reduce(
                (sum, p) => sum + (Number(p.price || 0) * Number(p.stock_quantity || 0)), 0
            ) || 0;

            if (inventoryValue > 50000) {
                items.push({
                    id: 'inventory-investment',
                    emoji: '📦',
                    title: 'Inventory Investment Review',
                    description: `$${inventoryValue.toLocaleString()} tied up in inventory`,
                    priority: inventoryValue > 100000 ? 'high' : 'medium',
                    action: '/admin/inventory-dashboard',
                });
            }

            // Check customer AR
            const { data: customerTabs } = await supabase
                .from('customers')
                .select('balance')
                .eq('tenant_id', tenant.id)
                .gt('balance', 0);

            const arOutstanding = customerTabs?.reduce(
                (sum, c) => sum + Number(c.balance || 0), 0
            ) || 0;

            if (arOutstanding > 5000) {
                items.push({
                    id: 'ar-collection',
                    emoji: '💳',
                    title: 'Accounts Receivable',
                    description: `$${arOutstanding.toLocaleString()} outstanding from customers`,
                    priority: arOutstanding > 20000 ? 'critical' : 'high',
                    action: '/admin/customer-tabs',
                });
            }

            // Check team growth
            const { count: teamSize } = await supabase
                .from('tenant_users')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenant.id)
                .eq('status', 'active');

            if ((teamSize || 0) >= 30) {
                items.push({
                    id: 'team-expansion',
                    emoji: '👥',
                    title: 'Team Scaling Review',
                    description: `${teamSize} team members - consider organizational structure`,
                    priority: 'medium',
                    action: '/admin/team',
                });
            }

            // Check month-end approaching
            const now = new Date();
            const daysUntilMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();

            if (daysUntilMonthEnd <= 5) {
                items.push({
                    id: 'month-close',
                    emoji: '📅',
                    title: 'Month-End Close',
                    description: `${daysUntilMonthEnd} days until month-end`,
                    priority: daysUntilMonthEnd <= 2 ? 'critical' : 'high',
                    action: '/admin/financial-center',
                });
            }

            // Always add expansion opportunity if profitable
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const { data: monthlyOrders } = await supabase
                .from('orders')
                .select('total_amount')
                .eq('tenant_id', tenant.id)
                .gte('created_at', monthStart.toISOString())
                .not('status', 'in', '("cancelled","rejected","refunded")');

            const monthlyRevenue = monthlyOrders?.reduce(
                (sum, o) => sum + Number(o.total_amount || 0), 0
            ) || 0;

            if (monthlyRevenue > 200000) {
                items.push({
                    id: 'expansion',
                    emoji: '🗺️',
                    title: 'Expansion Opportunity',
                    description: 'Revenue supports new market entry',
                    priority: 'medium',
                    action: '/admin/analytics',
                });
            }

            // Sort by priority
            const priorityOrder = { critical: 0, high: 1, medium: 2 };
            items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

            return items.slice(0, 4); // Max 4 items
        },
        enabled: !!tenant?.id,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    if (isLoading || !decisions || decisions.length === 0) return null;

    return (
        <Card className="border-yellow-500/50 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/30 dark:to-orange-950/30">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <span className="text-xl">🎯</span> STRATEGIC DECISIONS
                    <Badge variant="outline" className="text-xs ml-auto">
                        {decisions.length} items
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {decisions.map((decision) => (
                    <div
                        key={decision.id}
                        className="flex items-center justify-between p-3 bg-background rounded-lg border cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => navigate(decision.action)}
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{decision.emoji}</span>
                            <div>
                                <div className="font-medium">{decision.title}</div>
                                <div className="text-sm text-muted-foreground">{decision.description}</div>
                            </div>
                        </div>
                        <Badge
                            variant={
                                decision.priority === 'critical' ? 'destructive' :
                                    decision.priority === 'high' ? 'default' : 'secondary'
                            }
                        >
                            {decision.priority}
                        </Badge>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
