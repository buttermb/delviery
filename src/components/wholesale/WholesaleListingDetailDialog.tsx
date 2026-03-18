/**
 * WholesaleListingDetailDialog
 * Shows full details of a marketplace listing in a dialog.
 * Used from the WholesaleMarketplacePage when clicking "View Details".
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Package,
  Building2,
  ShoppingCart,
  Lock,
  Star,
  CheckCircle2,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';

interface MarketplaceProfile {
  id: string;
  business_name: string;
  license_verified: boolean;
  verified_badge?: boolean;
  average_rating?: number;
  total_reviews?: number;
}

interface MarketplaceListing {
  id: string;
  product_name: string;
  description: string | null;
  product_type: string | null;
  strain_type: string | null;
  thc_content: number | null;
  cbd_content: number | null;
  base_price: number | null;
  unit_type: string | null;
  unit_of_measure: string | null;
  quantity_available: number | null;
  images: string[] | null;
  lab_results: string | null;
  lab_results_encrypted: string | null;
  bulk_pricing: unknown[] | null;
  available_states: string[] | null;
  marketplace_profiles: MarketplaceProfile | null;
}

interface WholesaleListingDetailDialogProps {
  listing: MarketplaceListing;
  open: boolean;
  onClose: () => void;
  onAddToCart: () => void;
  isAddingToCart: boolean;
}

export function WholesaleListingDetailDialog({
  listing,
  open,
  onClose,
  onAddToCart,
  isAddingToCart,
}: WholesaleListingDetailDialogProps) {
  const profile = listing.marketplace_profiles;
  const hasLabResults = listing.lab_results && listing.lab_results_encrypted;
  const isOutOfStock = (listing.quantity_available as number) <= 0;
  const unit = listing.unit_type || listing.unit_of_measure || 'lb';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-2xl">{listing.product_name}</DialogTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                {listing.product_type && (
                  <span className="capitalize">{listing.product_type}</span>
                )}
                {listing.strain_type && (
                  <>
                    <span>·</span>
                    <span className="capitalize">{listing.strain_type}</span>
                  </>
                )}
              </div>
            </div>
            {hasLabResults && (
              <Badge variant="outline" className="border-info/30 text-info shrink-0">
                <Lock className="h-3 w-3 mr-1" />
                Lab Tested
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Image gallery */}
          {listing.images && listing.images.length > 0 ? (
            <div className="space-y-2">
              <div className="aspect-video relative bg-muted rounded-lg overflow-hidden">
                <img
                  src={listing.images[0]}
                  alt={listing.product_name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {isOutOfStock && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <Badge variant="secondary" className="text-lg">Out of Stock</Badge>
                  </div>
                )}
              </div>
              {listing.images.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {listing.images.slice(1, 5).map((image, idx) => (
                    <div key={`img-${idx}`} className="aspect-square rounded-md overflow-hidden border">
                      <img
                        src={image}
                        alt={`${listing.product_name} ${idx + 2}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
              <Package className="h-20 w-20 text-muted-foreground" />
            </div>
          )}

          {/* Pricing */}
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">
              {formatCurrency(listing.base_price as number ?? 0)}
            </span>
            <span className="text-sm text-muted-foreground">/ {unit}</span>
          </div>

          {listing.bulk_pricing && Array.isArray(listing.bulk_pricing) && listing.bulk_pricing.length > 0 && (
            <Badge variant="outline">Bulk pricing available</Badge>
          )}

          <div className="text-sm text-muted-foreground">
            {listing.quantity_available} {unit} available
          </div>

          <Separator />

          {/* THC / CBD */}
          {(listing.thc_content || listing.cbd_content) && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {listing.thc_content != null && (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="text-xs text-muted-foreground mb-1">THC</div>
                    <div className="text-xl font-bold text-primary">
                      {listing.thc_content}%
                    </div>
                  </div>
                )}
                {listing.cbd_content != null && (
                  <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
                    <div className="text-xs text-muted-foreground mb-1">CBD</div>
                    <div className="text-xl font-bold text-accent-foreground">
                      {listing.cbd_content}%
                    </div>
                  </div>
                )}
              </div>
              <Separator />
            </>
          )}

          {/* Description */}
          {listing.description && (
            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {listing.description}
              </p>
            </div>
          )}

          {/* Available states */}
          {listing.available_states && listing.available_states.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Available States</h3>
              <div className="flex flex-wrap gap-2">
                {listing.available_states.map((state) => (
                  <Badge key={state} variant="outline">{state}</Badge>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Supplier info */}
          {profile && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Supplier
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{profile.business_name}</span>
                {profile.license_verified && (
                  <Badge className="bg-green-500 text-white">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Verified License
                  </Badge>
                )}
                {profile.verified_badge && (
                  <Badge variant="outline" className="border-success/30 text-success text-xs">
                    Verified
                  </Badge>
                )}
                {profile.average_rating != null && profile.average_rating > 0 && (
                  <div className="flex items-center gap-1 ml-auto">
                    <Star className="h-3 w-3 fill-warning text-warning" />
                    <span className="text-sm">{profile.average_rating.toFixed(1)}</span>
                    <span className="text-xs text-muted-foreground">
                      ({profile.total_reviews ?? 0})
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={onAddToCart}
            disabled={isAddingToCart || isOutOfStock}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
