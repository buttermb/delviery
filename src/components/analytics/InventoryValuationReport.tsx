/**
 * Task 371: Wire inventory valuation report
 * Total inventory value, by category, aging analysis
 */

import React from 'react';
import { useQuery } from '@tanstack/query';
import { Package, DollarSign } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/hooks/useTenantAdminAuth';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

export function InventoryValuationReport() {
  const { tenant } = useTenantAdminAuth();

  const { data: valuation } = useQuery({
    queryKey: queryKeys.inventory.valuation(tenant?.id || ''),
    queryFn: async () => {
      if (!tenant?.id) return null;

      const { data, error } = await supabase
        .from('products')
        .select('id, name, stock_quantity, price')
        .eq('tenant_id', tenant.id);

      if (error) {
        logger.error('Failed to fetch inventory', error);
        throw error;
      }

      const totalValue = data?.reduce((sum, p) => sum + (p.stock_quantity || 0) * (p.price || 0), 0) || 0;
      const totalItems = data?.reduce((sum, p) => sum + (p.stock_quantity || 0), 0) || 0;

      return { totalValue, totalItems, products: data?.length || 0 };
    },
    enabled: !!tenant?.id,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Inventory Valuation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Total Value</p>
            <p className="text-2xl font-bold">${valuation?.totalValue.toFixed(2) || '0.00'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Units</p>
            <p className="text-2xl font-bold">{valuation?.totalItems || 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Products</p>
            <p className="text-2xl font-bold">{valuation?.products || 0}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
