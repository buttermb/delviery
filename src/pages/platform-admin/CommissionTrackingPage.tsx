import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Activity, Users } from 'lucide-react';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { PageHeader } from '@/components/shared/PageHeader';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { queryKeys } from '@/lib/queryKeys';

export default function CommissionTrackingPage() {
    const { isPlatformAdmin } = usePlatformAdmin();

    const { data: metrics, isLoading } = useQuery({
        queryKey: queryKeys.superAdminTools.platformMetrics(),
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_platform_metrics');
            if (error) throw error;
            return data as {
                total_gmv: number;
                total_commission: number;
                active_vendors: number;
                active_orders: number;
            };
        },
        enabled: isPlatformAdmin,
    });

    if (isLoading) return <EnhancedLoadingState variant="table" message="Loading commissions..." />;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Revenue & Commissions"
                description="Platform-wide financial performance."
            />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Gross Merchandise Value</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(metrics?.total_gmv || 0)}</div>
                        <p className="text-xs text-muted-foreground">Lifetime volume</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Platform Revenue</CardTitle><DollarSign className="h-4 w-4 text-green-600" /></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{formatCurrency(metrics?.total_commission || 0)}</div>
                        <p className="text-xs text-muted-foreground">Total commissions</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Active Vendors</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics?.active_vendors || 0}</div>
                        <p className="text-xs text-muted-foreground">Generating sales</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Live Orders</CardTitle><Activity className="h-4 w-4 text-muted-foreground" /></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics?.active_orders || 0}</div>
                        <p className="text-xs text-muted-foreground">In progress</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
