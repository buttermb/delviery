/**
 * Storefront Analytics Page
 * Displays aggregated metrics for the storefront
 */

import { CustomerRetentionChart } from '@/components/admin/analytics/CustomerRetentionChart';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function StorefrontAnalytics() {
  const { tenant } = useTenantAdminAuth();

  // Get the store ID for this tenant
  const { data: store, isLoading: storeLoading } = useQuery({
    queryKey: ['storefront-analytics-store', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return null;
      const { data } = await supabase
        .from('marketplace_profiles')
        .select('id')
        .eq('tenant_id', tenant.id)
        .maybeSingle();
      return data;
    },
    enabled: !!tenant?.id,
  });

  if (storeLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-[400px]" />
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="p-6">
        <p>No active storefront found.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Storefront Analytics</h2>
        <p className="text-muted-foreground">
          Insights into your customers and sales performance.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Customer Retention Chart */}
        <CustomerRetentionChart storeId={store.id} />

        {/* Placeholder for future charts */}
        <Card className="flex items-center justify-center p-6 border-dashed">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">More analytics coming soon...</p>
            <ul className="text-sm text-muted-foreground list-disc list-inside">
              <li>Sales by Category</li>
              <li>Average Order Value</li>
              <li>Conversion Rate</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}
