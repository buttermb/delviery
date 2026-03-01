import { logger } from '@/lib/logger';
/**
 * Marketplace Listing Detail Page
 * View detailed information about a marketplace listing
 */

import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Package,
  Edit,
  ArrowLeft,
  Eye,
  EyeOff,
  Package2,
  Lock,
  Calendar,
  TrendingUp
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { MarketplaceListing } from '@/types/marketplace-extended';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { queryKeys } from '@/lib/queryKeys';

// Type helper to avoid excessive deep instantiation
const asListing = (data: unknown): MarketplaceListing => data as MarketplaceListing;

export default function ListingDetailPage() {
  const { listingId } = useParams<{ listingId: string }>();
  const { tenant } = useTenantAdminAuth();
  const navigate = useNavigate();
  // Fetch listing details
  const { data: listing, isLoading } = useQuery<MarketplaceListing | null>({
    queryKey: queryKeys.marketplaceListings.detailPage(listingId),
    queryFn: async (): Promise<MarketplaceListing | null> => {
      if (!listingId) return null;

      const { data, error } = await supabase
        .from('marketplace_listings')
        .select('id, tenant_id, product_name, description, product_type, strain_type, base_price, unit_type, quantity_available, min_order_quantity, max_order_quantity, bulk_pricing, images, tags, lab_results, lab_results_encrypted, status, visibility, views, orders_count, favorites_count, created_at, published_at, updated_at, slug')
        .eq('id', listingId)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch listing', error, { component: 'ListingDetailPage', listingId });
        throw error;
      }

      return asListing(data);
    },
    enabled: !!listingId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Listing Not Found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                The listing you're looking for doesn't exist or has been removed.
              </p>
              <Button onClick={() => navigate(`/${tenant?.slug}/admin/marketplace/listings`)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Listings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-success/20 text-success border-success/30">
            <Eye className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case 'draft':
        return <Badge variant="outline">Draft</Badge>;
      case 'pending':
        return (
          <Badge className="bg-warning/20 text-warning border-warning/30">
            Pending
          </Badge>
        );
      case 'paused':
        return (
          <Badge className="bg-muted/20 text-muted-foreground border-muted/30">
            Paused
          </Badge>
        );
      case 'sold_out':
        return (
          <Badge variant="outline" className="border-destructive/30 text-destructive">
            Sold Out
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getVisibilityBadge = (visibility: string) => {
    switch (visibility) {
      case 'public':
        return <Badge variant="outline">Public</Badge>;
      case 'verified_only':
        return <Badge variant="outline" className="border-info/30 text-info">Verified Only</Badge>;
      case 'private':
        return (
          <Badge variant="outline" className="border-muted/30 text-muted-foreground">
            <EyeOff className="h-3 w-3 mr-1" />
            Private
          </Badge>
        );
      default:
        return <Badge variant="outline">{visibility}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/${tenant?.slug}/admin/marketplace/listings`)}
            aria-label="Back to listings"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="h-6 w-6" />
              {listing.product_name}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Listing Details
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(listing.status || 'draft')}
          {getVisibilityBadge(listing.visibility || 'public')}
          <Button
            onClick={() => navigate(`/${tenant?.slug}/admin/marketplace/listings/${listing.id}/edit`)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Images */}
          {listing.images && listing.images.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Product Images</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {listing.images.map((image: string, index: number) => (
                    <div key={index} className="relative aspect-square">
                      <img
                        src={image}
                        alt={`${listing.product_name} ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg border"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{listing.description || 'No description provided'}</p>
            </CardContent>
          </Card>

          {/* Lab Results */}
          {listing.lab_results && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Lab Results
                  {listing.lab_results_encrypted && (
                    <Badge variant="outline" className="ml-2">
                      Encrypted
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {listing.lab_results_encrypted ? (
                  <Alert>
                    <Lock className="h-4 w-4" />
                    <AlertDescription>
                      Lab results are encrypted for security. Decryption requires the encryption key.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-2">
                    {listing.lab_results.thc_percentage !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">THC:</span>
                        <span className="text-sm font-medium">{listing.lab_results.thc_percentage}%</span>
                      </div>
                    )}
                    {listing.lab_results.cbd_percentage !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">CBD:</span>
                        <span className="text-sm font-medium">{listing.lab_results.cbd_percentage}%</span>
                      </div>
                    )}
                    {listing.lab_results.batch_number && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Batch Number:</span>
                        <span className="text-sm font-medium">{listing.lab_results.batch_number}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tags */}
          {listing.tags && listing.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {listing.tags.map((tag: string, index: number) => (
                    <Badge key={index} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Pricing & Inventory */}
          <Card>
            <CardHeader>
              <CardTitle>Pricing & Inventory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Base Price</span>
                  <span className="text-2xl font-bold">
                    {formatCurrency(listing.base_price as number ?? 0)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  per {listing.unit_type || 'unit'}
                </div>
              </div>

              <div className="pt-4 border-t space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Quantity Available</span>
                  <span className="text-sm font-medium">
                    {listing.quantity_available} {listing.unit_type || 'lb'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Min Order</span>
                  <span className="text-sm font-medium">{listing.min_order_quantity || 1}</span>
                </div>
                {listing.max_order_quantity && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Max Order</span>
                    <span className="text-sm font-medium">{listing.max_order_quantity}</span>
                  </div>
                )}
              </div>

              {/* Bulk Pricing */}
              {listing.bulk_pricing && Array.isArray(listing.bulk_pricing) && listing.bulk_pricing.length > 0 && (
                <div className="pt-4 border-t">
                  <div className="text-sm font-medium mb-2">Bulk Pricing</div>
                  <div className="space-y-2">
                    {listing.bulk_pricing.map((tier, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {tier.min_quantity}+ units:
                        </span>
                        <span className="font-medium">
                          {formatCurrency(tier.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Product Details */}
          <Card>
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Product Type</div>
                <div className="text-sm font-medium capitalize">{listing.product_type || '—'}</div>
              </div>
              {listing.strain_type && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Strain Type</div>
                  <div className="text-sm font-medium capitalize">{listing.strain_type}</div>
                </div>
              )}
              <div>
                <div className="text-xs text-muted-foreground mb-1">Unit Type</div>
                <div className="text-sm font-medium">{listing.unit_type || 'lb'}</div>
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Views</span>
                </div>
                <span className="text-sm font-medium">{listing.views ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Orders</span>
                </div>
                <span className="text-sm font-medium">{listing.orders_count ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Favorites</span>
                </div>
                <span className="text-sm font-medium">{listing.favorites_count ?? 0}</span>
              </div>
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Created:</span>
                <span className="font-medium">{formatSmartDate(listing.created_at as string)}</span>
              </div>
              {listing.published_at && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Published:</span>
                  <span className="font-medium">{formatSmartDate(listing.published_at as string)}</span>
                </div>
              )}
              {listing.updated_at && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Updated:</span>
                  <span className="font-medium">{formatSmartDate(listing.updated_at as string)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

