/**
 * Storefront Funnel Analytics
 * Visual sales funnel showing conversion rates
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { logger } from '@/lib/logger';
import { ArrowDown, Eye, Package, ShoppingCart, CreditCard, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/queryKeys';

interface StorefrontFunnelProps {
  storeId: string;
  primaryColor?: string;
}

interface FunnelData {
  page_views: number;
  product_views: number;
  add_to_cart: number;
  checkout_starts: number;
  purchases: number;
  conversion_rate: number;
}

export function StorefrontFunnel({ storeId, primaryColor = '#6366f1' }: StorefrontFunnelProps) {
  const { data: funnel, isLoading } = useQuery({
    queryKey: queryKeys.storefrontFunnel.byStore(storeId),
    queryFn: async (): Promise<FunnelData | null> => {
      try {
        const { data, error } = await supabase
          .rpc('get_marketplace_funnel' as any, { p_store_id: storeId });

        // Function doesn't exist yet - return placeholder data
        if (error) {
          if (error.code === 'PGRST202' || error.message?.includes('does not exist')) {
            return null;
          }
          logger.warn('Funnel query error', error);
          return null;
        }
        return data?.[0] as FunnelData | null;
      } catch {
        return null;
      }
    },
    enabled: !!storeId,
    refetchInterval: 60000, // Refresh every minute
    retry: false,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const stages = [
    {
      name: 'Page Views',
      value: funnel?.page_views || 0,
      icon: Eye,
      description: 'Total store visits',
    },
    {
      name: 'Product Views',
      value: funnel?.product_views || 0,
      icon: Package,
      description: 'Products viewed',
    },
    {
      name: 'Add to Cart',
      value: funnel?.add_to_cart || 0,
      icon: ShoppingCart,
      description: 'Items added to cart',
    },
    {
      name: 'Checkout Started',
      value: funnel?.checkout_starts || 0,
      icon: CreditCard,
      description: 'Began checkout',
    },
    {
      name: 'Purchases',
      value: funnel?.purchases || 0,
      icon: CheckCircle,
      description: 'Completed orders',
    },
  ];

  // Calculate max value for bar widths
  const maxValue = Math.max(...stages.map((s) => s.value), 1);

  // Calculate drop-off rates
  const getDropOffRate = (currentIndex: number) => {
    if (currentIndex === 0) return null;
    const prev = stages[currentIndex - 1].value;
    const curr = stages[currentIndex].value;
    if (prev === 0) return 0;
    return Math.round(((prev - curr) / prev) * 100);
  };

  // Calculate conversion rate between stages
  const getConversionRate = (currentIndex: number) => {
    if (currentIndex === 0) return 100;
    const prev = stages[currentIndex - 1].value;
    const curr = stages[currentIndex].value;
    if (prev === 0) return 0;
    return Math.round((curr / prev) * 100);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales Funnel</CardTitle>
        <CardDescription>
          Last 30 days • {funnel?.conversion_rate || 0}% overall conversion rate
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            const width = maxValue > 0 ? (stage.value / maxValue) * 100 : 0;
            const dropOff = getDropOffRate(index);
            const conversionRate = getConversionRate(index);

            return (
              <div key={stage.name}>
                {/* Drop-off indicator */}
                {index > 0 && (
                  <div className="flex items-center justify-center py-1 text-xs text-muted-foreground">
                    <ArrowDown className="w-3 h-3 mr-1" />
                    <span>
                      {conversionRate}% converted
                      {dropOff !== null && dropOff > 0 && (
                        <span className="text-destructive ml-2">(-{dropOff}% drop-off)</span>
                      )}
                    </span>
                  </div>
                )}

                {/* Stage bar */}
                <div
                  className={cn(
                    'relative h-16 rounded-lg overflow-hidden transition-all w-full',
                    index === stages.length - 1 ? 'bg-success/10' : 'bg-muted'
                  )}
                >
                  {/* Visual width indicator bar */}
                  <div
                    className={cn(
                      'absolute inset-y-0 left-0 opacity-20 transition-all',
                      index === stages.length - 1 ? 'bg-success' : ''
                    )}
                    style={{
                      width: `${Math.max(width, 5)}%`,
                      backgroundColor: index < stages.length - 1 ? primaryColor : undefined,
                    }}
                  />
                  {/* Content - always full width */}
                  <div className="absolute inset-0 flex items-center px-4">
                    <Icon
                      className={cn(
                        'w-5 h-5 mr-3 flex-shrink-0',
                        index === stages.length - 1 ? 'text-success' : ''
                      )}
                      style={{
                        color: index < stages.length - 1 ? primaryColor : undefined,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{stage.name}</p>
                      <p className="text-xs text-muted-foreground">{stage.description}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p
                        className={cn(
                          'text-xl font-bold',
                          index === stages.length - 1 ? 'text-success' : ''
                        )}
                        style={{
                          color: index < stages.length - 1 ? primaryColor : undefined,
                        }}
                      >
                        {stage.value.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t">
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: primaryColor }}>
              {funnel?.conversion_rate || 0}%
            </p>
            <p className="text-xs text-muted-foreground">Overall Conversion</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">
              {stages[0].value > 0
                ? Math.round((stages[2].value / stages[0].value) * 100)
                : 0}%
            </p>
            <p className="text-xs text-muted-foreground">Cart Rate</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">
              {stages[3].value > 0
                ? Math.round((stages[4].value / stages[3].value) * 100)
                : 0}%
            </p>
            <p className="text-xs text-muted-foreground">Checkout Success</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default StorefrontFunnel;




