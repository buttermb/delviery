import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { logger } from '@/lib/logger';

interface RealTimeStockStatusProps {
  productId: string;
  tenantId: string;
}

export function RealTimeStockStatus({ productId, tenantId }: RealTimeStockStatusProps) {
  const [stockLevel, setStockLevel] = useState<number>(0);

  const { data: product } = useQuery({
    queryKey: queryKeys.products.detail(tenantId, productId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('stock_quantity, low_stock_threshold')
        .eq('id', productId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!productId && !!tenantId,
  });

  useEffect(() => {
    if (!product) return;
    setStockLevel(product.stock_quantity as number || 0);

    const channel = supabase
      .channel(`product:${productId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
          filter: `id=eq.${productId}`,
        },
        (payload) => {
          const newData = payload.new as Record<string, unknown>;
          setStockLevel(newData.stock_quantity as number || 0);
          logger.info('Stock updated via realtime', { productId, newStock: newData.stock_quantity });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [productId, product]);

  const lowStockThreshold = (product?.low_stock_threshold as number) || 10;

  const getStockStatus = () => {
    if (stockLevel === 0) {
      return {
        label: 'Out of Stock',
        variant: 'destructive' as const,
        icon: <XCircle className="h-3 w-3" />,
      };
    }
    if (stockLevel <= lowStockThreshold) {
      return {
        label: `Low Stock (${stockLevel} left)`,
        variant: 'secondary' as const,
        icon: <AlertTriangle className="h-3 w-3" />,
      };
    }
    return {
      label: 'In Stock',
      variant: 'default' as const,
      icon: <CheckCircle className="h-3 w-3" />,
    };
  };

  const status = getStockStatus();

  return (
    <Badge variant={status.variant} className="flex items-center gap-1.5">
      {status.icon}
      {status.label}
    </Badge>
  );
}
