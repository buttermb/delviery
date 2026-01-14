import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from "@/components/ui/skeleton";

interface SalesByCategoryChartProps {
    storeId?: string;
    className?: string;
}

interface CategorySales {
    name: string;
    value: number;
    color: string;
}

// Color palette for categories
const COLORS = [
    '#10b981', // Emerald
    '#3b82f6', // Blue  
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#84cc16', // Lime
];

export function SalesByCategoryChart({ storeId, className }: SalesByCategoryChartProps) {
    const { data: salesData, isLoading, error } = useQuery({
        queryKey: ['sales-by-category', storeId],
        queryFn: async (): Promise<CategorySales[]> => {
            if (!storeId) return [];

            // Get orders for this store
            const { data: orders, error: ordersError } = await supabase
                .from('storefront_orders')
                .select('id')
                .eq('store_id', storeId);

            if (ordersError || !orders?.length) {
                console.warn('No orders found for category analysis:', ordersError);
                return [];
            }

            const orderIds = orders.map(o => o.id);

            // Get order items with product category info
            const { data: items, error: itemsError } = await supabase
                .from('storefront_order_items')
                .select(`
                    quantity,
                    unit_price,
                    products:product_id (
                        category
                    )
                `)
                .in('order_id', orderIds);

            if (itemsError || !items?.length) {
                console.warn('No order items found:', itemsError);
                return [];
            }

            // Aggregate sales by category
            const categoryMap = new Map<string, number>();
            items.forEach((item: any) => {
                const category = item.products?.category || 'Uncategorized';
                const revenue = (item.quantity || 1) * (item.unit_price || 0);
                categoryMap.set(category, (categoryMap.get(category) || 0) + revenue);
            });

            // Convert to array and sort by value
            const result: CategorySales[] = Array.from(categoryMap.entries())
                .map(([name, value], index) => ({
                    name,
                    value: Math.round(value * 100) / 100,
                    color: COLORS[index % COLORS.length],
                }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 8); // Top 8 categories

            return result;
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

    if (error || !salesData?.length) {
        return (
            <Card className={className}>
                <CardHeader>
                    <CardTitle>Sales by Category</CardTitle>
                    <CardDescription>Revenue breakdown by product category</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center items-center h-[300px] text-muted-foreground">
                    No sales data available
                </CardContent>
            </Card>
        );
    }

    const totalRevenue = salesData.reduce((sum, cat) => sum + cat.value, 0);

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>Sales by Category</CardTitle>
                <CardDescription>
                    Total: <span className="font-semibold text-foreground">${totalRevenue.toLocaleString()}</span>
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={salesData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={2}
                                dataKey="value"
                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                labelLine={false}
                            >
                                {salesData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--card))',
                                    borderColor: 'hsl(var(--border))',
                                    borderRadius: '8px'
                                }}
                                itemStyle={{ color: 'hsl(var(--foreground))' }}
                            />
                            <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
