import { logger } from '@/lib/logger';
/**
 * Public Listing Detail Page
 * View marketplace listing details without login
 */

import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Package,
  Building2,
  Lock,
  ArrowLeft,
  LogIn,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { SEOHead } from '@/components/SEOHead';
import { queryKeys } from '@/lib/queryKeys';

export default function PublicListingDetailPage() {
  const { listingId } = useParams<{ listingId: string }>();
  const navigate = useNavigate();

  // Fetch listing details
  const { data: listing, isLoading } = useQuery({
    queryKey: queryKeys.marketplaceListings.publicDetail(listingId),
    queryFn: async () => {
      if (!listingId) return null;

      const { data, error} = await supabase
        .from('marketplace_listings')
        .select(`
          *,
          marketplace_profiles!inner (
            id,
            business_name,
            business_description,
            license_verified
          )
        `)
        .eq('id', listingId)
        .eq('status', 'active')
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch listing', error, { component: 'PublicListingDetailPage' });
        throw error;
      }

      return data;
    },
    enabled: !!listingId,
  });

  const handleSignUpPrompt = () => {
    navigate(`/signup?redirect=/marketplace/listings/${listingId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-dvh bg-background">
        <div className="container mx-auto px-4 py-12">
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Listing Not Found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  This listing doesn't exist or is no longer available.
                </p>
                <Button onClick={() => navigate('/marketplace')} variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Marketplace
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <SEOHead
        title={`${listing.product_name} - Wholesale Marketplace`}
        description={listing.description || `Browse ${listing.product_name} from ${listing.marketplace_profiles?.business_name} on the FloraIQ wholesale marketplace.`}
        type="website"
      />

      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate('/marketplace')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Marketplace
            </Button>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Product Images */}
            {listing.images && listing.images.length > 0 && (
              <Card>
                <CardContent className="p-0">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2 aspect-square">
                      <img
                        src={listing.images[0]}
                        alt={listing.product_name}
                        className="w-full h-full object-cover rounded-t-lg"
                      />
                    </div>
                    {listing.images.slice(1, 5).map((image: string, idx: number) => (
                      <div key={idx} className="aspect-square">
                        <img
                          src={image}
                          alt={`${listing.product_name} ${idx + 2}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Product Details */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-2xl">{listing.product_name}</CardTitle>
                  {listing.marketplace_profiles?.license_verified && (
                    <Badge className="bg-green-500 text-white">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Verified License
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {listing.description && (
                  <div>
                    <h3 className="font-semibold mb-2">Description</h3>
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {listing.description}
                    </p>
                  </div>
                )}

                {/* Product Info */}
                <div className="grid grid-cols-2 gap-4">
                  {listing.product_type && (
                    <div>
                      <p className="text-sm text-muted-foreground">Product Type</p>
                      <p className="font-medium">{listing.product_type}</p>
                    </div>
                  )}
                  {listing.unit_of_measure && (
                    <div>
                      <p className="text-sm text-muted-foreground">Unit</p>
                      <p className="font-medium">{listing.unit_of_measure}</p>
                    </div>
                  )}
                  {listing.quantity_available !== undefined && (
                    <div>
                      <p className="text-sm text-muted-foreground">Available</p>
                      <p className="font-medium">{listing.quantity_available} {listing.unit_of_measure}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Seller Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Supplier Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-1">
                    {listing.marketplace_profiles?.business_name}
                  </h3>
                  {listing.marketplace_profiles?.business_description && (
                    <p className="text-sm text-muted-foreground">
                      {listing.marketplace_profiles.business_description}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Pricing Card */}
            <Card className="sticky top-20">
              <CardHeader>
                <CardTitle>Pricing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Base Price</p>
                  <p className="text-3xl font-bold">
                    {formatCurrency(listing.base_price as number || 0)}
                  </p>
                  {listing.unit_of_measure && (
                    <p className="text-sm text-muted-foreground">
                      per {listing.unit_of_measure}
                    </p>
                  )}
                </div>

                <div className="pt-4 space-y-2">
                  <Button
                    className="w-full"
                    onClick={handleSignUpPrompt}
                    size="lg"
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    Sign Up to Purchase
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    asChild
                  >
                    <Link to="/login">
                      <LogIn className="h-4 w-4 mr-2" />
                      Sign In to Buy
                    </Link>
                  </Button>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground text-center">
                    Verified business license required for wholesale purchases
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

