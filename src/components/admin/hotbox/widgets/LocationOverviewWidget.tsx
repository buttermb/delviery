import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';

export function LocationOverviewWidget() {
    const { tenant } = useTenantAdminAuth();

    const { data: locations, isLoading } = useQuery({
        queryKey: queryKeys.hotbox.locations(tenant?.id),
        queryFn: async () => {
            if (!tenant?.id) return [];

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Try to fetch locations from locations table
            const { data: locs } = await supabase
                .from('locations')
                .select('id, name, address')
                .eq('tenant_id', tenant.id)
                .limit(10);

            // If no locations table or empty, create a default "Main" location
            const locationList = locs && locs.length > 0
                ? locs
                : [{ id: 'main', name: 'Main', address: null }];

            // For each location, calculate metrics
            const locationsWithMetrics = await Promise.all(
                locationList.map(async (loc) => {
                    // Get today's orders and revenue
                    const { data: orders } = await supabase
                        .from('orders')
                        .select('total_amount')
                        .eq('tenant_id', tenant.id)
                        .gte('created_at', today.toISOString())
                        .not('status', 'in', '("cancelled","rejected","refunded")');

                    const todayRevenue = orders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
                    const orderCount = orders?.length || 0;

                    // Estimate margin (simplified 25%)
                    const margin = todayRevenue > 0 ? 25 : 0;

                    // Check for issues (out of stock products)
                    const { count: outOfStock } = await supabase
                        .from('products')
                        .select('*', { count: 'exact', head: true })
                        .eq('tenant_id', tenant.id)
                        .lte('stock_quantity', 0)
                        .eq('status', 'active');

                    // Check for low stock
                    const { count: lowStock } = await supabase
                        .from('products')
                        .select('*', { count: 'exact', head: true })
                        .eq('tenant_id', tenant.id)
                        .gt('stock_quantity', 0)
                        .lt('stock_quantity', 10)
                        .eq('status', 'active');

                    const issues = (outOfStock || 0) + Math.floor((lowStock || 0) / 5);

                    return {
                        id: loc.id,
                        name: loc.name,
                        revenue: Math.round(todayRevenue / Math.max(1, locationList.length)), // Split evenly for now
                        margin,
                        orders: Math.round(orderCount / Math.max(1, locationList.length)),
                        issues: Math.min(issues, 5), // Cap at 5 for display
                    };
                })
            );

            return locationsWithMetrics;
        },
        enabled: !!tenant?.id,
        staleTime: 60 * 1000, // 1 minute
    });

    if (isLoading) {
        return (
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-medium flex items-center gap-2">
                        NETWORK OVERVIEW
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                        Loading locations...
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Always show the widget - the query creates a "Main" location if none exist
    const displayLocations = locations && locations.length > 0 ? locations : [];
    const totalRevenue = displayLocations.reduce((sum, loc) => sum + loc.revenue, 0);
    const totalOrders = displayLocations.reduce((sum, loc) => sum + loc.orders, 0);

    if (displayLocations.length === 0) {
        return (
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-medium flex items-center gap-2">
                        NETWORK OVERVIEW
                        <Badge variant="outline" className="text-xs ml-auto">
                            $0 • 0 orders
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-6">
                        <p className="text-muted-foreground mb-3">No location data yet</p>
                        <p className="text-sm text-muted-foreground">
                            Location metrics will appear once you have orders
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                    NETWORK OVERVIEW
                    <Badge variant="outline" className="text-xs ml-auto">
                        ${totalRevenue.toLocaleString()} • {totalOrders} orders
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th scope="col" className="text-left py-2 font-medium">Location</th>
                                <th scope="col" className="text-right py-2 font-medium">Today</th>
                                <th scope="col" className="text-right py-2 font-medium">Margin</th>
                                <th scope="col" className="text-right py-2 font-medium">Orders</th>
                                <th scope="col" className="text-right py-2 font-medium">Issues</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayLocations.map((loc) => (
                                <tr key={loc.id} className="border-b last:border-0">
                                    <td className="py-2 font-medium">{loc.name}</td>
                                    <td className="text-right py-2">${loc.revenue.toLocaleString()}</td>
                                    <td className="text-right py-2">{loc.margin}%</td>
                                    <td className="text-right py-2">{loc.orders}</td>
                                    <td className="text-right py-2">
                                        {loc.issues === 0 ? (
                                            <span className="text-green-500">0 OK</span>
                                        ) : loc.issues <= 2 ? (
                                            <span className="text-yellow-500">{loc.issues} warn</span>
                                        ) : (
                                            <span className="text-red-500">{loc.issues} alert</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
