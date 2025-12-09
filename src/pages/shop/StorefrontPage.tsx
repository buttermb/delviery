/**
 * Storefront Page
 * Customer-facing store homepage
 */

import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useShop } from './ShopLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, Package, Truck, Shield, Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';

interface ProductWithSettings {
  product_id: string;
  name: string;
  description: string | null;
  short_description: string | null;
  category: string | null;
  price: number;
  display_price: number;
  compare_at_price: number | null;
  image_url: string | null;
  images: string[];
  in_stock: boolean;
  is_featured: boolean;
  marketplace_category_name: string | null;
}

export default function StorefrontPage() {
  const { storeSlug } = useParams();
  const { store, isLoading: storeLoading } = useShop();

  // Fetch products
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['shop-products', store?.id],
    queryFn: async () => {
      if (!store?.id) return [];

      const { data, error } = await supabase
        .rpc('get_marketplace_products', { p_store_id: store.id });

      if (error) throw error;
      return data as ProductWithSettings[];
    },
    enabled: !!store?.id,
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['shop-categories', store?.id],
    queryFn: async () => {
      if (!store?.id) return [];

      const { data, error } = await supabase
        .from('marketplace_categories')
        .select('*')
        .eq('store_id', store.id)
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      return data;
    },
    enabled: !!store?.id,
  });

  // Get featured products
  const featuredProducts = useMemo(() => {
    return products.filter((p) => p.is_featured).slice(0, 4);
  }, [products]);

  // Group products by category
  const productsByCategory = useMemo(() => {
    const grouped: Record<string, ProductWithSettings[]> = {};
    products.forEach((product) => {
      const cat = product.marketplace_category_name || product.category || 'Other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(product);
    });
    return grouped;
  }, [products]);

  const isLoading = storeLoading || productsLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-64 w-full mb-8 rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!store) return null;

  return (
    <div>
      {/* Hero Banner */}
      {store.banner_url ? (
        <div
          className="h-64 md:h-96 bg-cover bg-center flex items-center"
          style={{ backgroundImage: `url(${store.banner_url})` }}
        >
          <div className="container mx-auto px-4">
            <div className="max-w-xl bg-white/90 backdrop-blur p-6 rounded-lg">
              <h1 className="text-3xl md:text-4xl font-bold mb-2">{store.store_name}</h1>
              {store.tagline && (
                <p className="text-lg text-muted-foreground mb-4">{store.tagline}</p>
              )}
              <Link to={`/shop/${storeSlug}/products`}>
                <Button style={{ backgroundColor: store.primary_color }}>
                  Shop Now
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="py-16 md:py-24"
          style={{ backgroundColor: `${store.primary_color}10` }}
        >
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-3xl md:text-5xl font-bold mb-4">{store.store_name}</h1>
            {store.tagline && (
              <p className="text-xl text-muted-foreground mb-6">{store.tagline}</p>
            )}
            <Link to={`/shop/${storeSlug}/products`}>
              <Button size="lg" style={{ backgroundColor: store.primary_color }}>
                Browse Products
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-12">
        {/* Categories */}
        {categories.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6">Shop by Category</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  to={`/shop/${storeSlug}/products?category=${category.slug}`}
                >
                  <Card className="hover:shadow-lg transition-shadow overflow-hidden group">
                    {category.image_url ? (
                      <div
                        className="h-32 bg-cover bg-center group-hover:scale-105 transition-transform"
                        style={{ backgroundImage: `url(${category.image_url})` }}
                      />
                    ) : (
                      <div
                        className="h-32 flex items-center justify-center"
                        style={{ backgroundColor: `${store.primary_color}15` }}
                      >
                        <Package
                          className="w-12 h-12"
                          style={{ color: store.primary_color }}
                        />
                      </div>
                    )}
                    <CardContent className="p-4">
                      <p className="font-medium text-center">{category.name}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Featured Products */}
        {featuredProducts.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Featured Products</h2>
              <Link
                to={`/shop/${storeSlug}/products`}
                className="text-sm font-medium hover:underline"
                style={{ color: store.primary_color }}
              >
                View All
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {featuredProducts.map((product) => (
                <ProductCard
                  key={product.product_id}
                  product={product}
                  storeSlug={storeSlug!}
                  primaryColor={store.primary_color}
                />
              ))}
            </div>
          </section>
        )}

        {/* All Products by Category */}
        {Object.entries(productsByCategory)
          .slice(0, 3)
          .map(([category, categoryProducts]) => (
            <section key={category} className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">{category}</h2>
                <Link
                  to={`/shop/${storeSlug}/products?category=${encodeURIComponent(category)}`}
                  className="text-sm font-medium hover:underline"
                  style={{ color: store.primary_color }}
                >
                  View All
                </Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {categoryProducts.slice(0, 4).map((product) => (
                  <ProductCard
                    key={product.product_id}
                    product={product}
                    storeSlug={storeSlug!}
                    primaryColor={store.primary_color}
                  />
                ))}
              </div>
            </section>
          ))}

        {/* Trust Badges */}
        <section className="py-12 border-t">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex items-center gap-4 justify-center md:justify-start">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${store.primary_color}15` }}
              >
                <Truck className="w-6 h-6" style={{ color: store.primary_color }} />
              </div>
              <div>
                <p className="font-semibold">Fast Delivery</p>
                <p className="text-sm text-muted-foreground">Quick and reliable</p>
              </div>
            </div>
            <div className="flex items-center gap-4 justify-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${store.primary_color}15` }}
              >
                <Shield className="w-6 h-6" style={{ color: store.primary_color }} />
              </div>
              <div>
                <p className="font-semibold">Secure Payment</p>
                <p className="text-sm text-muted-foreground">Safe transactions</p>
              </div>
            </div>
            <div className="flex items-center gap-4 justify-center md:justify-end">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${store.primary_color}15` }}
              >
                <Clock className="w-6 h-6" style={{ color: store.primary_color }} />
              </div>
              <div>
                <p className="font-semibold">Customer Support</p>
                <p className="text-sm text-muted-foreground">We're here to help</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// Product Card Component
function ProductCard({
  product,
  storeSlug,
  primaryColor,
}: {
  product: ProductWithSettings;
  storeSlug: string;
  primaryColor: string;
}) {
  const hasDiscount = product.compare_at_price && product.compare_at_price > product.display_price;
  const discountPercent = hasDiscount
    ? Math.round((1 - product.display_price / product.compare_at_price!) * 100)
    : 0;

  return (
    <Link to={`/shop/${storeSlug}/products/${product.product_id}`}>
      <Card className="group hover:shadow-lg transition-all overflow-hidden h-full">
        <div className="aspect-square relative overflow-hidden bg-muted">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-16 h-16 text-muted-foreground" />
            </div>
          )}
          {hasDiscount && (
            <Badge
              className="absolute top-2 left-2"
              style={{ backgroundColor: primaryColor }}
            >
              -{discountPercent}%
            </Badge>
          )}
          {!product.in_stock && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Badge variant="secondary">Out of Stock</Badge>
            </div>
          )}
        </div>
        <CardContent className="p-4">
          <h3 className="font-medium line-clamp-2 mb-1 group-hover:text-primary transition-colors">
            {product.name}
          </h3>
          <div className="flex items-center gap-2">
            <span className="font-bold" style={{ color: primaryColor }}>
              {formatCurrency(product.display_price)}
            </span>
            {hasDiscount && (
              <span className="text-sm text-muted-foreground line-through">
                {formatCurrency(product.compare_at_price!)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}




