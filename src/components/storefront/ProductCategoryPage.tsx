import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/formatters';
import { Skeleton } from '@/components/ui/skeleton';

interface ProductCategoryPageProps {
  tenantSlug: string;
  categoryId?: string;
  categoryName?: string;
}

export function ProductCategoryPage({ tenantSlug, categoryId, categoryName }: ProductCategoryPageProps) {
  const { data: products = [], isLoading } = useQuery({
    queryKey: queryKeys.shopProducts.list(tenantSlug),
    queryFn: async () => {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .maybeSingle();

      if (!tenant) return [];

      let query = supabase
        .from('products')
        .select('id, name, price, image_url, category, stock_quantity, active')
        .eq('tenant_id', tenant.id)
        .eq('active', true);

      if (categoryName) {
        query = query.eq('category', categoryName);
      }

      const { data, error } = await query.order('name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantSlug,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-48 w-full mb-3" />
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </Card>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No products found in this category</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {categoryName && (
        <div>
          <h1 className="text-3xl font-bold">{categoryName}</h1>
          <p className="text-muted-foreground mt-1">{products.length} products</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {products.map((product: Record<string, unknown>) => (
          <Card key={product.id as string} className="p-4 hover:shadow-lg transition-shadow cursor-pointer">
            {product.image_url && (
              <img
                src={product.image_url as string}
                alt={product.name as string}
                className="w-full h-48 object-cover rounded-lg mb-3"
              />
            )}
            <h3 className="font-semibold mb-2">{product.name as string}</h3>
            <div className="flex items-center justify-between">
              <p className="text-lg font-bold text-emerald-600">
                {formatCurrency(product.price as number)}
              </p>
              {(product.stock_quantity as number) > 0 ? (
                <Badge variant="default">In Stock</Badge>
              ) : (
                <Badge variant="secondary">Out of Stock</Badge>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
