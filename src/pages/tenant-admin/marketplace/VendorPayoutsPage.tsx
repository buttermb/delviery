import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Wallet, TrendingUp, History } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { queryKeys } from '@/lib/queryKeys';

interface MarketplacePayout {
    id: string;
    status: string;
    amount: number;
    created_at: string;
    reference_id?: string;
    method?: string;
}

interface MarketplaceOrder {
    total_amount: number;
    platform_fee: number;
    status: string;
    payout_id: string | null;
}

export default function VendorPayoutsPage() {
    const { tenant } = useTenantAdminAuth();

    // Fetch Payouts History
    const { data: payouts = [], isLoading: isLoadingPayouts } = useQuery({
        queryKey: queryKeys.marketplace.payouts.list(tenant?.id),
        queryFn: async () => {
            if (!tenant?.id) return [];
            const { data, error } = await supabase
                .from('marketplace_payouts')
                .select('*')
                .eq('seller_tenant_id', tenant.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data ?? []) as MarketplacePayout[];
        },
        enabled: !!tenant?.id,
    });

    // Calculate Available Balance (Orders delivered but not yet paid out)
    const { data: balanceData, isLoading: isLoadingBalance } = useQuery({
        queryKey: queryKeys.marketplace.balance(tenant?.id),
        queryFn: async () => {
            if (!tenant?.id) return { pending: 0, available: 0 };

            // Orders that are complete but not paid out
            const { data: orders, error } = await supabase
                .from('marketplace_orders')
                .select('total_amount, platform_fee, status, payout_id')
                .eq('seller_tenant_id', tenant.id)
                .is('payout_id', null)
                .neq('status', 'cancelled')
                .neq('status', 'rejected');

            if (error) throw error;

            let pending = 0;
            let available = 0;

            (orders as MarketplaceOrder[] | null)?.forEach((order: MarketplaceOrder) => {
                const netAmount = (order.total_amount ?? 0) - (order.platform_fee ?? 0);
                if (order.status === 'delivered') {
                    available += netAmount;
                } else {
                    pending += netAmount;
                }
            });

            return { pending, available };
        },
        enabled: !!tenant?.id,
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed': return <Badge className="bg-green-100 text-green-800">Paid</Badge>;
            case 'processing': return <Badge className="bg-blue-100 text-blue-800">Processing</Badge>;
            case 'failed': return <Badge variant="destructive">Failed</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    if (isLoadingPayouts || isLoadingBalance) {
        return (
            <div className="flex h-dvh items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Financials & Payouts"
                description="Track your earnings and payout history."
            />

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Available for Payout</CardTitle>
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(balanceData?.available ?? 0)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Funds from delivered orders
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Clearance</CardTitle>
                        <History className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(balanceData?.pending ?? 0)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Orders in progress
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Withdrawn</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(payouts.filter((p: MarketplacePayout) => p.status === 'completed').reduce((acc: number, curr: MarketplacePayout) => acc + curr.amount, 0))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Lifetime earnings paid out
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="history">
                <TabsList>
                    <TabsTrigger value="history">Payout History</TabsTrigger>
                </TabsList>
                <TabsContent value="history" className="space-y-4">
                    <Card>
                        <CardHeader><CardTitle>Recent Payouts</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Reference</TableHead>
                                        <TableHead>Method</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {payouts.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                No payouts found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        payouts.map((payout: MarketplacePayout) => (
                                            <TableRow key={payout.id}>
                                                <TableCell>{formatSmartDate(payout.created_at)}</TableCell>
                                                <TableCell className="font-mono text-xs">{payout.reference_id || '-'}</TableCell>
                                                <TableCell className="capitalize">{payout.method || 'Manual'}</TableCell>
                                                <TableCell>{getStatusBadge(payout.status)}</TableCell>
                                                <TableCell className="text-right font-medium">{formatCurrency(payout.amount)}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <div className="text-center text-sm text-muted-foreground pt-4">
                Payouts are processed weekly. Need help? <span className="underline cursor-default">Contact Support</span>.
            </div>
        </div>
    );
}
