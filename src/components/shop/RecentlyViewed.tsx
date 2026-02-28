/**
 * Recently Viewed Products
 * Shows products the customer has recently viewed
 */

import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import ProductImage from '@/components/ProductImage';
import { queryKeys } from '@/lib/queryKeys';
import { STORAGE_KEYS } from '@/constants/storageKeys';

interface RecentlyViewedProps {
  storeId: string;
  currentProductId?: string;
  primaryColor: string;
  maxItems?: number;
}

interface Product {
  product_id: string;
  name: string;
  display_price: number;
  image_url: string | null;
}

export function RecentlyViewed({
  storeId,
  currentProductId,
  primaryColor,
  maxItems = 6,
}: RecentlyViewedProps) {
  const { storeSlug } = useParams<{ storeSlug: string }>();

  // Get recently viewed product IDs from localStorage
  const recentIds = useMemo(() => {
    const saved = localStorage.getItem(`${STORAGE_KEYS.SHOP_RECENTLY_VIEWED_PREFIX}${storeId}`);
    if (saved) {
      try {
        return JSON.parse(saved)
          .filter((id: string) => id !== currentProductId)
          .slice(0, maxItems);
      } catch {
        return [];
      }
    }
    return [];
  }, [storeId, currentProductId, maxItems]);

  // Fetch product details
  const { data: products = [] } = useQuery({
    queryKey: queryKeys.recentlyViewed.byStoreIds(storeId, recentIds),
    queryFn: async () => {
      if (recentIds.length === 0) return [];

      const { data, error } = await supabase
        .rpc('get_marketplace_products', { p_store_id: storeId });

      if (error) throw error;
      
      // Filter and order by recently viewed
      const productMap = new Map((data as unknown as Product[]).map((p) => [p.product_id, p]));
      return recentIds
        .map((id: string) => productMap.get(id))
        .filter(Boolean) as Product[];
    },
    enabled: recentIds.length > 0,
  });

  if (products.length === 0) return null;

  return (
    <div className="py-8">
      <h2 className="text-xl font-bold mb-4">Recently Viewed</h2>
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-4 pb-4">
          {products.map((product) => (
            <Link
              key={product.product_id}
              to={`/shop/${storeSlug}/products/${product.product_id}`}
              className="flex-shrink-0 w-40"
            >
              <Card className="overflow-hidden hover:shadow-md transition-shadow">
                <div className="aspect-square bg-muted">
                  <ProductImage
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full"
                  />
                </div>
                <CardContent className="p-3">
                  <p className="text-sm font-medium truncate">{product.name}</p>
                  <p className="text-sm font-bold" style={{ color: primaryColor }}>
                    {formatCurrency(product.display_price)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

// Helper function to track recently viewed
export function trackRecentlyViewed(storeId: string, productId: string) {
  const key = `${STORAGE_KEYS.SHOP_RECENTLY_VIEWED_PREFIX}${storeId}`;
  const saved = localStorage.getItem(key);
  let recent: string[] = [];

  if (saved) {
    try {
      recent = JSON.parse(saved);
    } catch {
      // Invalid data
    }
  }

  // Add to front, remove duplicates, limit to 20
  recent = [productId, ...recent.filter((id) => id !== productId)].slice(0, 20);
  localStorage.setItem(key, JSON.stringify(recent));
}

export default RecentlyViewed;



