/**
 * RecentSalesPanel Component
 * 
 * Displays recent POS transactions with quick reprint/view options.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Receipt, Clock, Eye, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface RecentSale {
    id: string;
    transaction_number: string;
    total_amount: number;
    payment_method: string;
    created_at: string;
    items: any[];
}

interface RecentSalesPanelProps {
    tenantId: string | undefined;
    onVoid?: (saleId: string) => void;
    onReprint?: (sale: RecentSale) => void;
}

export function RecentSalesPanel({
    tenantId,
    onVoid,
    onReprint,
}: RecentSalesPanelProps) {
    const { toast } = useToast();
    const [sales, setSales] = useState<RecentSale[]>([]);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        if (!tenantId) return;
        loadRecentSales();
    }, [tenantId]);

    const loadRecentSales = async () => {
        if (!tenantId) return;

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('pos_transactions')
                .select('id, transaction_number, total_amount, payment_method, created_at, items')
                .eq('tenant_id', tenantId)
                .eq('status', 'completed')
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;
            setSales(data || []);
        } catch (error) {
            console.error('Failed to load recent sales', error);
        } finally {
            setLoading(false);
        }
    };

    if (sales.length === 0) {
        return null;
    }

    const displaySales = expanded ? sales : sales.slice(0, 3);

    return (
        <Card className="flex-shrink-0">
            <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Receipt className="h-4 w-4" />
                        Recent Sales
                    </CardTitle>
                    {sales.length > 3 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => setExpanded(!expanded)}
                        >
                            {expanded ? 'Show Less' : `+${sales.length - 3} more`}
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className={expanded ? "max-h-60" : "max-h-32"}>
                    <div className="px-4 pb-3 space-y-2">
                        {displaySales.map((sale) => {
                            const itemCount = Array.isArray(sale.items)
                                ? sale.items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0)
                                : 0;

                            return (
                                <div
                                    key={sale.id}
                                    className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-sm font-medium">
                                                {sale.transaction_number}
                                            </span>
                                            <Badge variant="outline" className="text-xs capitalize">
                                                {sale.payment_method}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Clock className="h-3 w-3" />
                                            {formatDistanceToNow(new Date(sale.created_at), { addSuffix: true })}
                                            <span>· {itemCount} items</span>
                                        </div>
                                    </div>
                                    <span className="font-bold text-sm">
                                        ${sale.total_amount.toFixed(2)}
                                    </span>
                                    {onReprint && (
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8"
                                            onClick={() => onReprint(sale)}
                                            title="Reprint receipt"
                                        >
                                            <Receipt className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}

export default RecentSalesPanel;
