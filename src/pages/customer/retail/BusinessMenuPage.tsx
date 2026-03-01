import { logger } from '@/lib/logger';
/**
 * Business Menu Page
 * Customers can browse products from a specific business
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Store,
  Search,
  Filter,
  ShoppingCart,
  Package,
  ArrowLeft
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ModeBanner } from '@/components/customer/ModeSwitcher';
import { useState as useReactState, useEffect } from 'react';
import { STORAGE_KEYS, safeStorage } from '@/constants/storageKeys';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGuestCart } from '@/hooks/useGuestCart';
import { SEOHead } from '@/components/SEOHead';
import { queryKeys } from '@/lib/queryKeys';

type CustomerMode = 'retail' | 'wholesale';

export default function BusinessMenuPage() {
  const { slug, businessSlug } = useParams<{ slug?: string; businessSlug?: string }>();
  const { tenant: _tenant } = useCustomerAuth();
  // Use businessSlug if provided (from route), otherwise use slug (current tenant)
  const targetBusinessSlug = businessSlug || slug;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [mode, setMode] = useReactState<CustomerMode>('retail');
  const [user, setUser] = useState<User | null>(null);
  const { addToGuestCart } = useGuestCart();

  // Load saved mode preference
  useEffect(() => {
    try {
      const savedMode = safeStorage.getItem(STORAGE_KEYS.CUSTOMER_MODE) as CustomerMode | null;
      if (savedMode && (savedMode === 'retail' || savedMode === 'wholesale')) {
        setMode(savedMode);
      }
    } catch {
      // Ignore storage errors
    }
  }, [setMode]);

  // Get current user session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  // Fetch business/tenant info
  const { data: business } = useQuery({
    queryKey: queryKeys.retailBusinesses.detail(targetBusinessSlug),
    queryFn: async () => {
      if (!targetBusinessSlug) return null;

      const { data, error } = await supabase
        .from('tenants')
        .select('id, business_name, slug, white_label(*)')
        .eq('slug', targetBusinessSlug)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch business', error, { component: 'BusinessMenuPage' });
        throw error;
      }

      return data;
    },
    enabled: !!targetBusinessSlug,
  });

  const businessId = business?.id;

  // Fetch products
  const { data: products = [], isLoading } = useQuery({
    queryKey: queryKeys.retailBusinesses.products(businessId, categoryFilter),
    queryFn: async () => {
      if (!businessId) return [];

      let query = supabase
        .from('products')
        .select('id, name, description, price, unit, image_url, category, quantity_available, is_active, tenant_id')
        .eq('tenant_id', businessId)
        .eq('is_active', true)
        .order('name');

      // Filter by category if selected
      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to fetch products', error, { component: 'BusinessMenuPage' });
        throw error;
      }

      return data ?? [];
    },
    enabled: !!businessId,
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.retailBusinesses.categories(businessId),
    queryFn: async () => {
      if (!businessId) return [];

      const { data, error } = await supabase
        .from('products')
        .select('category')
        .eq('tenant_id', businessId)
        .eq('is_active', true)
        .not('category', 'is', null);

      if (error) {
        logger.error('Failed to fetch categories', error, { component: 'BusinessMenuPage' });
        throw error;
      }

      // Get unique categories
      const uniqueCategories = Array.from(new Set((data ?? []).map((p) => p.category).filter(Boolean)));
      return uniqueCategories;
    },
    enabled: !!businessId,
  });

  // Filter products by search query
  const filteredProducts = products.filter((product) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      product.name?.toLowerCase().includes(query) ||
      product.description?.toLowerCase().includes(query) ||
      product.category?.toLowerCase().includes(query)
    );
  });

  // Add to cart mutation (supports both authenticated and guest users)
  const addToCartMutation = useMutation({
    mutationFn: async ({ productId, quantity }: { productId: string; quantity: number }) => {
      if (!user) {
        // Guest user - use guest cart
        addToGuestCart(productId, quantity, 'default'); // Default weight for retail products
        return;
      }

      // Authenticated user - use database cart
      // Check if item already in cart
      const { data: existing } = await supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('user_id', user.id)
        .eq('product_id', productId)
        .maybeSingle();

      if (existing) {
        // Update quantity
        const { error } = await supabase
          .from('cart_items')
          .update({ quantity: (existing.quantity as number) + quantity })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Add new item
        const { error } = await supabase
          .from('cart_items')
          .insert({
            user_id: user.id,
            product_id: productId,
            quantity,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: queryKeys.cart.user(user?.id) });
      }
      toast.success('Added to Cart', {
        description: user ? 'Item added to your cart' : 'Item added to cart. Sign in to save your cart.',
      });
    },
    onError: (error: unknown) => {
      logger.error('Failed to add to cart', error, { component: 'BusinessMenuPage' });
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to add item to cart',
      });
    },
  });

  if (!business) {
    return (
      <div className="min-h-dvh bg-background pb-16 lg:pb-0">
        <SEOHead
          title="Business Not Found - FloraIQ"
          description="The business you're looking for doesn't exist."
        />
        <div className="bg-primary/5 border-b border-primary/20">
          <div className="container mx-auto px-4 py-4">
            <ModeBanner currentMode={mode} onModeChange={setMode} />
          </div>
        </div>
        <div className="container mx-auto px-4 py-6">
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Store className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Business Not Found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  The business you're looking for doesn't exist.
                </p>
                <Button onClick={() => navigate(`/${slug}/shop/retail/businesses`)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Businesses
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-16 lg:pb-0">
      <SEOHead
        title={business ? `${business.business_name} - Products & Menu` : 'Business Menu - FloraIQ'}
        description={business ? `Browse products from ${business.business_name}. Shop cannabis products with secure checkout and fast delivery.` : 'Browse business products and menu items.'}
        type="website"
      />
      {/* Mode Banner */}
      <div className="bg-primary/5 border-b border-primary/20">
        <div className="container mx-auto px-4 py-4">
          <ModeBanner currentMode={mode} onModeChange={setMode} />
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/${slug}/shop/retail/businesses`)}
            aria-label="Back to businesses"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Store className="h-6 w-6" />
              {business.business_name}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Browse our menu
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate(`/${slug}/shop/cart`)}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            View Cart
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    aria-label="Search products"
                  />
                </div>
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category: string) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Products Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Products Found</h3>
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? 'Try adjusting your search' : 'No products available'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <Card key={product.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  {product.image_url && (
                    <div className="aspect-square rounded-lg overflow-hidden mb-4">
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <CardTitle className="text-lg mb-1">{product.name}</CardTitle>
                  {product.category && (
                    <Badge variant="outline" className="text-xs">
                      {product.category}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {product.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {product.description}
                    </p>
                  )}

                  {/* Pricing */}
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">
                      {formatCurrency(product.price as number ?? 0)}
                    </span>
                    {product.unit && (
                      <span className="text-sm text-muted-foreground">
                        / {product.unit}
                      </span>
                    )}
                  </div>

                  {/* Stock Status */}
                  {product.quantity_available !== undefined && (
                    <div className="text-xs text-muted-foreground">
                      {Number(product.quantity_available) > 0 ? (
                        <span className="text-success">In Stock</span>
                      ) : (
                        <span className="text-destructive">Out of Stock</span>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <Button
                    className="w-full"
                    onClick={() => addToCartMutation.mutate({ productId: product.id, quantity: 1 })}
                    disabled={addToCartMutation.isPending || (product.quantity_available !== undefined && Number(product.quantity_available) <= 0)}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    {addToCartMutation.isPending ? 'Adding...' : 'Add to Cart'}
                  </Button>
                  {!user && (
                    <p className="text-xs text-muted-foreground text-center mt-1">
                      Sign in to save your cart
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

