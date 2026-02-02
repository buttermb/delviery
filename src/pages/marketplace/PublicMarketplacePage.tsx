// @ts-nocheck
import { logger } from '@/lib/logger';
// @ts-nocheck
/**
 * Public Marketplace Page
 * Browse wholesale marketplace without login
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import Package from "lucide-react/dist/esm/icons/package";
import Search from "lucide-react/dist/esm/icons/search";
import Filter from "lucide-react/dist/esm/icons/filter";
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import Star from "lucide-react/dist/esm/icons/star";
import Building2 from "lucide-react/dist/esm/icons/building-2";
import Lock from "lucide-react/dist/esm/icons/lock";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import LogIn from "lucide-react/dist/esm/icons/log-in";
import { formatCurrency } from '@/lib/utils/formatCurrency';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SEOHead } from '@/components/SEOHead';

export default function PublicMarketplacePage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [productTypeFilter, setProductTypeFilter] = useState<string>('all');
  const [strainTypeFilter, setStrainTypeFilter] = useState<string>('all');

  // Fetch active marketplace listings (public)
  const { data: listings = [], isLoading } = useQuery({
    queryKey: ['marketplace-listings-public', productTypeFilter, strainTypeFilter],
    queryFn: async () => {
      let query = supabase
        .from('marketplace_listings')
        .select(`
          *,
          marketplace_profiles!inner (
            id,
            business_name,
            verified_badge,
            average_rating,
            total_reviews
          )
        `)
        .eq('status', 'active')
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(50); // Limit for public view

      // Apply filters
      if (productTypeFilter !== 'all') {
        query = query.eq('product_type', productTypeFilter);
      }
      if (strainTypeFilter !== 'all') {
        query = query.eq('strain_type', strainTypeFilter);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to fetch marketplace listings', error, { component: 'PublicMarketplacePage' });
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

  const handleViewListing = (listingId: string) => {
    // Navigate to public listing detail
    navigate(`/marketplace/listings/${listingId}`);
  };

  const handleSignUpPrompt = () => {
    // Navigate to signup with redirect back to marketplace
    navigate('/signup?redirect=/marketplace');
  };

  return (
    <div className="min-h-dvh bg-background">
      <SEOHead
        title="Wholesale Cannabis Marketplace - FloraIQ"
        description="Browse wholesale cannabis products from verified suppliers. Find premium products, compare prices, and connect with licensed distributors."
        type="website"
      />

      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Building2 className="h-6 w-6 text-primary" />
                Wholesale Marketplace
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Browse products from verified suppliers
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" asChild>
                <Link to="/login">
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign In
                </Link>
              </Button>
              <Button onClick={handleSignUpPrompt}>
                Get Started
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Search and Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products, suppliers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
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

        {/* Sign Up Banner */}
        <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between flex-col sm:flex-row gap-4">
              <div>
                <h3 className="font-semibold text-lg mb-1">Ready to Purchase?</h3>
                <p className="text-sm text-muted-foreground">
                  Sign up to access wholesale pricing, place orders, and connect with suppliers
                </p>
              </div>
              <Button onClick={handleSignUpPrompt} size="lg">
                Create Account
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
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
                <h3 className="text-lg font-semibold mb-2">No Products Found</h3>
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? 'Try adjusting your search' : 'No products available at this time'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredListings.map((listing: any) => (
              <Card key={listing.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  {listing.images && listing.images.length > 0 && (
                    <div className="aspect-square rounded-lg overflow-hidden mb-4">
                      <img
                        src={listing.images[0]}
                        alt={listing.product_name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-2">
                    <CardTitle className="text-lg">{listing.product_name}</CardTitle>
                    {listing.marketplace_profiles?.verified_badge && (
                      <Badge className="bg-green-500 text-white">
                        <Star className="h-3 w-3 mr-1" />
                        Verified
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    <span>{listing.marketplace_profiles?.business_name}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {listing.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {listing.description}
                    </p>
                  )}

                  {/* Pricing */}
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">
                      {formatCurrency(listing.base_price as number || 0)}
                    </span>
                    {listing.unit_type && (
                      <span className="text-sm text-muted-foreground">
                        / {listing.unit_type}
                      </span>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex flex-wrap gap-2">
                    {listing.product_type && (
                      <Badge variant="outline" className="text-xs">
                        {listing.product_type}
                      </Badge>
                    )}
                    {listing.strain_type && (
                      <Badge variant="outline" className="text-xs">
                        {listing.strain_type}
                      </Badge>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleViewListing(listing.id)}
                    >
                      View Details
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleSignUpPrompt}
                    >
                      <Lock className="h-4 w-4 mr-2" />
                      Sign Up to Buy
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

