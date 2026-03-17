import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { Badge } from '@/components/ui/badge';

interface PriceHistoryEntry {
  date: string;
  price: number;
  change_percent: number;
}

interface WholesalePricingHistoryChartProps {
  productId: string;
}

export function WholesalePricingHistoryChart({ productId }: WholesalePricingHistoryChartProps) {
  const { tenant } = useTenantAdminAuth();

  const { data: history } = useQuery({
    queryKey: queryKeys.wholesalePricingHistory.byProduct(productId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_price_history')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as PriceHistoryEntry[];
    },
    enabled: !!productId && !!tenant?.id,
  });

  const currentPrice = history?.[0]?.price || 0;
  const previousPrice = history?.[1]?.price || 0;
  const priceChange = currentPrice - previousPrice;
  const priceChangePercent = previousPrice > 0 ? (priceChange / previousPrice) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pricing History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Current Price</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold">${currentPrice.toFixed(2)}</span>
              {priceChange !== 0 && (
                <Badge variant={priceChange > 0 ? 'destructive' : 'default'}>
                  {priceChange > 0 ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  )}
                  {Math.abs(priceChangePercent).toFixed(1)}%
                </Badge>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {history?.map((entry, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {new Date(entry.date).toLocaleDateString()}
                </span>
                <span className="font-mono">${entry.price.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
