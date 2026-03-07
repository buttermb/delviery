/**
 * AI Suggestion Banner
 * Shows AI-powered suggestions based on sales data
 * Dismissible via localStorage
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, X, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { queryKeys } from '@/lib/queryKeys';

const DISMISS_KEY = 'floraiq_ai_suggestion_dismissed';

export function AISuggestionBanner() {
  const { tenant } = useTenantAdminAuth();
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === 'true'
  );

  const { data: staleCount } = useQuery({
    queryKey: [...queryKeys.dashboard.stats(tenant?.id), 'stale-products'],
    queryFn: async () => {
      if (!tenant?.id) return 0;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Count active products with no orders in last 30 days
      const { data: activeProducts } = await supabase
        .from('products')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('status', 'active');

      if (!activeProducts || activeProducts.length === 0) return 0;

      const productIds = activeProducts.map(p => p.id);

      // Find products that DO have recent orders
      const { data: soldItems } = await supabase
        .from('order_items')
        .select('product_id')
        .in('product_id', productIds)
        .gte('created_at', thirtyDaysAgo.toISOString());

      const soldProductIds = new Set(soldItems?.map(i => i.product_id) ?? []);
      const staleProducts = productIds.filter(id => !soldProductIds.has(id));

      return staleProducts.length;
    },
    enabled: !!tenant?.id && !dismissed,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (dismissed || !staleCount || staleCount === 0) return null;

  return (
    <Card className="border-amber-200/50 bg-amber-50/50 dark:border-amber-800/50 dark:bg-amber-950/20">
      <CardContent className="py-4 flex items-start gap-3">
        <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {staleCount} {staleCount === 1 ? 'product hasn\'t' : 'products haven\'t'} sold in 30 days — consider a promotion or bundle.
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            AI suggestion based on your sales data
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-xs text-amber-700 hover:text-amber-900 dark:text-amber-400"
          onClick={() => navigate(`/${tenantSlug}/admin/inventory-hub`)}
        >
          View products
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, 'true');
            setDismissed(true);
          }}
          aria-label="Dismiss suggestion"
        >
          <X className="h-3 w-3" />
        </Button>
      </CardContent>
    </Card>
  );
}
