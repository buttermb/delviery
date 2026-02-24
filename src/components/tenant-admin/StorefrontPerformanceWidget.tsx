/**
 * Storefront Performance Widget
 * Shows aggregate stats from all marketplace stores for this tenant
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Store, ShoppingCart, DollarSign, TrendingUp, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { useNavigate, useParams } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { queryKeys } from '@/lib/queryKeys';

export function StorefrontPerformanceWidget() {
    const { tenant } = useTenantAdminAuth();
    const { tenantSlug } = useParams<{ tenantSlug: string }>();
    const navigate = useNavigate();
    const tenantId = tenant?.id;

    const { data: performance, isLoading } = useQuery({
        queryKey: queryKeys.tenantWidgets.storefrontPerformance(tenantId),
        queryFn: async () => {
            if (!tenantId) return null;

            // Fetch stores
            const { data: stores, error: storesError } = await supabase
                .from('marketplace_stores')
                .select('id, store_name, is_active')
                .eq('tenant_id', tenantId);

            if (storesError) throw storesError;

            if (!stores || stores.length === 0) {
                return {
                    totalStores: 0,
                    activeStores: 0,
                    todayOrders: 0,
                    todayRevenue: 0,
                    weekOrders: 0,
                    weekRevenue: 0,
                };
            }

            const storeIds = stores.map((s) => s.id);
            const activeStores = stores.filter((s) => s.is_active).length;

            // Get today's date
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Get week start (7 days ago)
            const weekStart = new Date(today);
            weekStart.setDate(weekStart.getDate() - 7);

            // Fetch today's storefront orders
            const { data: todayOrders } = await supabase
                .from('storefront_orders')
                .select('total')
                .in('store_id', storeIds)
                .gte('created_at', today.toISOString());

            // Fetch this week's storefront orders
            const { data: weekOrders } = await supabase
                .from('storefront_orders')
                .select('total')
                .in('store_id', storeIds)
                .gte('created_at', weekStart.toISOString());

            const todayRevenue = (todayOrders || []).reduce(
                (sum, o) => sum + (Number(o.total) || 0),
                0
            );
            const weekRevenue = (weekOrders || []).reduce(
                (sum, o) => sum + (Number(o.total) || 0),
                0
            );

            return {
                totalStores: stores.length,
                activeStores,
                todayOrders: todayOrders?.length || 0,
                todayRevenue,
                weekOrders: weekOrders?.length || 0,
                weekRevenue,
            };
        },
        enabled: !!tenantId,
        refetchInterval: 60000, // Refresh every minute
    });

    if (isLoading) {
        return (
            <Card className="glass-card">
                <CardHeader>
                    <CardTitle>Storefront Performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                </CardContent>
            </Card>
        );
    }

    if (!performance || performance.totalStores === 0) {
        return (
            <Card className="glass-card">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Store className="h-5 w-5" />
                        Storefront
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                        You haven't set up a storefront yet.
                    </p>
                    <Button
                        variant="outline"
                        onClick={() => navigate(`/${tenantSlug}/admin/storefront`)}
                    >
                        Create Storefront
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="glass-card">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Store className="h-5 w-5" />
                        Storefront
                    </CardTitle>
                    <Badge variant="outline">
                        {performance.activeStores}/{performance.totalStores} Active
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Today's Stats */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <ShoppingCart className="h-3.5 w-3.5" />
                            <span>Today's Orders</span>
                        </div>
                        <div className="text-2xl font-bold">{performance.todayOrders}</div>
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <DollarSign className="h-3.5 w-3.5" />
                            <span>Today's Revenue</span>
                        </div>
                        <div className="text-2xl font-bold">
                            {formatCurrency(performance.todayRevenue)}
                        </div>
                    </div>
                </div>

                {/* Week Stats */}
                <div className="pt-2 border-t">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span>This Week</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span>{performance.weekOrders} orders</span>
                        <span className="font-medium">
                            {formatCurrency(performance.weekRevenue)}
                        </span>
                    </div>
                </div>

                {/* Quick Link */}
                <Button
                    variant="ghost"
                    className="w-full justify-between"
                    onClick={() => navigate(`/${tenantSlug}/admin/storefront`)}
                >
                    View Dashboard
                    <ArrowRight className="h-4 w-4" />
                </Button>
            </CardContent>
        </Card>
    );
}
