import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from "@/components/ui/skeleton";
import { logger } from '@/lib/logger';

interface CustomerRetentionChartProps {
    storeId?: string;
    className?: string;
}

interface CustomerAnalytics {
    new_customers: number;
    returning_customers: number;
    total_customers: number;
}

export function CustomerRetentionChart({ storeId, className }: CustomerRetentionChartProps) {
    const { data: analytics, isLoading, error } = useQuery({
        queryKey: ['customer-retention', storeId],
        queryFn: async (): Promise<CustomerAnalytics | null> => {
            if (!storeId) return null;

            // Calculate customer metrics from storefront_orders table
            const { data: orders, error } = await supabase
                .from('storefront_orders')
                .select('customer_email')
                .eq('store_id', storeId);

            if (error || !orders) {
                logger.warn('Failed to fetch orders for analytics', error);
                return null;
            }

            // Count unique customers and their order frequency
            const customerOrderCounts = new Map<string, number>();
            orders.forEach(order => {
                const email = order.customer_email;
                if (email) {
                    customerOrderCounts.set(email, (customerOrderCounts.get(email) || 0) + 1);
                }
            });

            let newCustomers = 0;
            let returningCustomers = 0;

            customerOrderCounts.forEach((count) => {
                if (count === 1) {
                    newCustomers++;
                } else {
                    returningCustomers++;
                }
            });

            return {
                new_customers: newCustomers,
                returning_customers: returningCustomers,
                total_customers: customerOrderCounts.size,
            };
        },
        enabled: !!storeId,
    });

    if (isLoading) {
        return (
            <Card className={className}>
                <CardHeader>
                    <Skeleton className="h-6 w-48 mb-2" />
                    <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent className="flex justify-center items-center h-[300px]">
                    <Skeleton className="h-48 w-48 rounded-full" />
                </CardContent>
            </Card>
        );
    }

    if (error || !analytics || analytics.total_customers === 0) {
        return (
            <Card className={className}>
                <CardHeader>
                    <CardTitle>Customer Retention</CardTitle>
                    <CardDescription>New vs Returning Customers</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center items-center h-[300px] text-muted-foreground">
                    No customer data available
                </CardContent>
            </Card>
        );
    }

    const data = [
        { name: 'New Customers', value: analytics.new_customers, color: '#10b981' }, // Emerald 500
        { name: 'Returning Customers', value: analytics.returning_customers, color: '#3b82f6' }, // Blue 500
    ];

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>Customer Retention</CardTitle>
                <CardDescription>
                    Total Customers: <span className="font-semibold text-foreground">{analytics.total_customers}</span>
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                itemStyle={{ color: 'hsl(var(--foreground))' }}
                            />
                            <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-8 mt-4">
                    <div className="text-center">
                        <p className="text-sm text-muted-foreground">New</p>
                        <p className="text-2xl font-bold text-emerald-500">{analytics.new_customers}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-sm text-muted-foreground">Returning</p>
                        <p className="text-2xl font-bold text-blue-500">{analytics.returning_customers}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
