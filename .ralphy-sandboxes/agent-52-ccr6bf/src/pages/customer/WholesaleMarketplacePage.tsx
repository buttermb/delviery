import { logger } from '@/lib/logger';
/**
 * Wholesale Marketplace Page
 * B2B customers can browse and purchase from marketplace listings
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Package,
  Search,
  Filter,
  ShoppingCart,
  Star,
  Building2,
  Lock
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

type CustomerMode = 'retail' | 'wholesale';

export default function WholesaleMarketplacePage() {
  const { slug: _slug } = useParams<{ slug: string }>();
  const { customer, tenant } = useCustomerAuth();
  const { toast } = useToast();
  const _navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;
  const buyerTenantId = tenantId; // For B2B, the customer's tenant is the buyer
  const [searchQuery, setSearchQuery] = useState('');
  const [productTypeFilter, setProductTypeFilter] = useState<string>('all');
  const [strainTypeFilter, setStrainTypeFilter] = useState<string>('all');
  const [mode, setMode] = useReactState<CustomerMode>('wholesale');

  // Load saved mode preference
  useEffect(() => {
    try {
      const savedMode = safeStorage.getItem(STORAGE_KEYS.CUSTOMER_MODE as any) as CustomerMode | null;
      if (savedMode && (savedMode === 'retail' || savedMode === 'wholesale')) {
        setMode(savedMode);
      }
    } catch {
      // Ignore storage errors
    }
  }, [setMode]);

  // Fetch active marketplace listings
  const { data: listings = [], isLoading } = useQuery({
    queryKey: ['marketplace-listings-browse', productTypeFilter, strainTypeFilter],
    queryFn: async () => {
      let query = supabase
        .from('marketplace_listings')
        .select(`
          *,
          marketplace_profiles!inner (
            id,
            business_name,
            license_verified
          )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      // Apply filters
      if (productTypeFilter !== 'all') {
        query = query.eq('product_type', productTypeFilter);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to fetch marketplace listings', error, { component: 'WholesaleMarketplacePage' });
        throw error;
      }

      return data || [];
    },
  });

  // Filter listings by search query
  const filteredListings = listings.filter((listing: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      listing.product_name?.toLowerCase().includes(query) ||
      listing.description?.toLowerCase().includes(query) ||
      listing.marketplace_profiles?.business_name?.toLowerCase().includes(query)
    );
  });

  // Add to cart mutation
  const addToCartMutation = useMutation({
    mutationFn: async ({ listingId, quantity, unitPrice }: { listingId: string; quantity: number; unitPrice: number }) => {
      if (!buyerTenantId) {
        throw new Error('Tenant ID required');
      }

      // Check if item already in cart
      const { data: existing } = await supabase
        .from('marketplace_cart')
        .select('id, quantity')
        .eq('buyer_tenant_id', buyerTenantId)
        .eq('listing_id', listingId)
        .maybeSingle();

      if (existing) {
        // Update quantity
        const { error } = await supabase
          .from('marketplace_cart')
          .update({ quantity: (existing.quantity as number) + quantity })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Add new item
        const { error } = await supabase
          .from('marketplace_cart')
          .insert({
            buyer_tenant_id: buyerTenantId,
            buyer_user_id: customer?.id,
            listing_id: listingId,
            quantity,
            unit_price: unitPrice,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-cart', buyerTenantId] });
      toast({
        title: 'Added to Cart',
        description: 'Item added to wholesale cart',
      });
    },
    onError: (error: unknown) => {
      logger.error('Failed to add to cart', error, { component: 'WholesaleMarketplacePage' });
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add item to cart',
        variant: 'destructive',
      });
    },
  });

  const handleAddToCart = (listing: any) => {
    const quantity = 1; // Default quantity, could be made configurable
    const unitPrice = listing.base_price as number;
    
    addToCartMutation.mutate({
      listingId: listing.id,
      quantity,
      unitPrice,
    });
  };

  return (
    <div className="min-h-dvh bg-background pb-16 lg:pb-0">
      {/* Mode Banner */}
      <div className="bg-primary/5 border-b border-primary/20">
        <div className="container mx-auto px-4 py-4">
          <ModeBanner currentMode={mode} onModeChange={setMode} />
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Wholesale Marketplace
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse and purchase from verified wholesale suppliers
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search products, suppliers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={productTypeFilter} onValueChange={setProductTypeFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Product Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="flower">Flower</SelectItem>
                  <SelectItem value="concentrate">Concentrate</SelectItem>
                  <SelectItem value="edible">Edible</SelectItem>
                  <SelectItem value="vape">Vape</SelectItem>
                  <SelectItem value="topical">Topical</SelectItem>
                  <SelectItem value="tincture">Tincture</SelectItem>
                </SelectContent>
              </Select>
              <Select value={strainTypeFilter} onValueChange={setStrainTypeFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Strain Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Strains</SelectItem>
                  <SelectItem value="indica">Indica</SelectItem>
                  <SelectItem value="sativa">Sativa</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Listings Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filteredListings.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Listings Found</h3>
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? 'Try adjusting your search' : 'No active listings available'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredListings.map((listing: any) => {
              const profile = listing.marketplace_profiles;
              const hasLabResults = listing.lab_results && listing.lab_results_encrypted;

              return (
                <Card key={listing.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-1">{listing.product_name}</CardTitle>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="capitalize">{listing.product_type}</span>
                          {listing.strain_type && (
                            <>
                              <span>•</span>
                              <span className="capitalize">{listing.strain_type}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {hasLabResults && (
                        <Badge variant="outline" className="border-info/30 text-info">
                          <Lock className="h-3 w-3 mr-1" />
                          Lab Tested
                        </Badge>
                      )}
                    </div>
                    {profile && (
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{profile.business_name}</span>
                        {profile.verified_badge && (
                          <Badge variant="outline" className="border-success/30 text-success text-xs">
                            Verified
                          </Badge>
                        )}
                        {profile.average_rating > 0 && (
                          <div className="flex items-center gap-1 ml-auto">
                            <Star className="h-3 w-3 fill-warning text-warning" />
                            <span className="text-xs">{profile.average_rating.toFixed(1)}</span>
                            <span className="text-xs text-muted-foreground">
                              ({profile.total_reviews})
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Product Image */}
                    {listing.images && listing.images.length > 0 && (
                      <div className="aspect-square rounded-lg overflow-hidden border">
                        <img
                          src={listing.images[0]}
                          alt={listing.product_name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {/* Description */}
                    {listing.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {listing.description}
                      </p>
                    )}

                    {/* Pricing */}
                    <div className="space-y-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold">
                          {formatCurrency(listing.base_price as number || 0)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          / {listing.unit_type || 'lb'}
                        </span>
                      </div>
                      {listing.bulk_pricing && Array.isArray(listing.bulk_pricing) && listing.bulk_pricing.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          Bulk pricing available
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {listing.quantity_available} {listing.unit_type || 'lb'} available
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          // Navigate to listing detail page (if exists) or show details in modal
                          // For now, just show a toast with listing info
                          toast({
                            title: listing.product_name,
                            description: listing.description?.substring(0, 100) + '...',
                          });
                        }}
                      >
                        View Details
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={() => handleAddToCart(listing)}
                        disabled={addToCartMutation.isPending || (listing.quantity_available as number) <= 0}
                      >
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Add to Cart
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

