/**
 * Product Tabs
 * Description, reviews, and related products sections
 */

import { Link } from 'react-router-dom';

import type { ProductDetails, ProductReview } from '@/pages/shop/product-detail/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReviewForm } from '@/components/shop/ReviewForm';
import { RecentlyViewedSection } from '@/components/shop/RecentlyViewedSection';
import {
  Star,
  Package,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { sanitizeHtml } from '@/lib/utils/sanitize';
import { cn } from '@/lib/utils';

interface ProductTabsProps {
  product: ProductDetails;
  reviews: ProductReview[];
  averageRating: number;
  relatedProducts: ProductDetails[];
  storeId: string;
  storeSlug: string;
  primaryColor: string;
  isLuxuryTheme: boolean;
}

export function ProductTabs({
  product,
  reviews,
  averageRating,
  relatedProducts,
  storeId,
  storeSlug,
  primaryColor,
  isLuxuryTheme,
}: ProductTabsProps) {
  return (
    <div className="mt-12 sm:mt-24 space-y-12 sm:space-y-24">
      {/* Description & Reviews Tabs */}
      <div className={`rounded-2xl sm:rounded-3xl p-4 sm:p-8 lg:p-12 ${isLuxuryTheme ? 'bg-white/5 border border-white/10 backdrop-blur-md' : 'bg-card border'}`}>
        <Tabs defaultValue="description" className="w-full">
          <TabsList className="w-full justify-start bg-transparent border-b border-white/10 p-0 h-auto mb-6 sm:mb-8">
            <TabsTrigger
              value="description"
              className="text-sm sm:text-lg px-4 sm:px-8 py-3 sm:py-4 rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-400 transition-all"
            >
              Description
            </TabsTrigger>
            <TabsTrigger
              value="reviews"
              className="text-sm sm:text-lg px-4 sm:px-8 py-3 sm:py-4 rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-400 transition-all"
            >
              Reviews ({reviews.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="description" className="mt-0">
            <div className={`prose max-w-none ${isLuxuryTheme ? 'prose-invert prose-p:text-white/70 prose-headings:text-white' : ''}`}>
              {product.description ? (
                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }} />
              ) : (
                <p className="text-white/50">No description available for this product.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="reviews" className="mt-0">
            <ReviewsSection
              reviews={reviews}
              averageRating={averageRating}
              storeId={storeId}
              productId={product.product_id}
              productName={product.name}
              primaryColor={primaryColor}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <RelatedProductsGrid
          products={relatedProducts}
          storeSlug={storeSlug}
        />
      )}

      {/* Recently Viewed */}
      <RecentlyViewedSection
        currentProductId={product.product_id}
        className="py-12 border-t border-white/5"
      />
    </div>
  );
}

/** Reviews section with rating summary and individual reviews */
function ReviewsSection({
  reviews,
  averageRating,
  storeId,
  productId,
  productName,
  primaryColor,
}: {
  reviews: ProductReview[];
  averageRating: number;
  storeId: string;
  productId: string;
  productName: string;
  primaryColor: string;
}) {
  if (reviews.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
          <Star className="w-8 h-8 text-white/20" />
        </div>
        <p className="text-xl font-medium text-white mb-2">No reviews yet</p>
        <p className="text-white/50 mb-8">Be the first to share your experience with this product.</p>
        <ReviewForm
          storeId={storeId}
          productId={productId}
          productName={productName}
          primaryColor={primaryColor}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
      <div>
        {/* Rating Summary */}
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 mb-8 sm:mb-12 bg-white/5 p-4 sm:p-8 rounded-2xl border border-white/5">
          <div className="text-center">
            <span className="text-4xl sm:text-6xl font-light text-white block">{averageRating.toFixed(1)}</span>
            <div className="flex justify-center mt-2">
              {renderStars(averageRating, 'w-5 h-5')}
            </div>
            <span className="text-sm text-white/40 mt-2 block">{reviews.length} ratings</span>
          </div>
          <div className="hidden sm:block h-20 w-px bg-white/10" />
          <Separator className="sm:hidden bg-white/10" />
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-xl sm:text-2xl font-light text-white mb-2">Customer Reviews</h3>
            <p className="text-white/60 mb-4 sm:mb-6">95% of customers recommended this product</p>
            <ReviewForm
              storeId={storeId}
              productId={productId}
              productName={productName}
              primaryColor={primaryColor}
            />
          </div>
        </div>

        {/* Recent Reviews */}
        <div className="space-y-6">
          {reviews.map((review) => (
            <div key={review.id} className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/5 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/20 to-purple-500/20 flex items-center justify-center text-white font-medium">
                    {review.customer_name?.[0] || 'A'}
                  </div>
                  <div>
                    <p className="font-medium text-white">
                      {review.customer_name || 'Anonymous'}
                    </p>
                    <div className="flex items-center gap-2">
                      {renderStars(review.rating, 'w-3 h-3')}
                      {review.is_verified_purchase && (
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-0 text-[10px] h-5 px-1.5">
                          Verified
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-white/30">
                  {formatSmartDate(review.created_at)}
                </span>
              </div>
              {review.title && (
                <p className="font-medium text-white/90 mb-2">{review.title}</p>
              )}
              <p className="text-white/60 leading-relaxed">{review.comment}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Render star rating icons */
function renderStars(rating: number, size = 'w-4 h-4') {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            size,
            star <= rating
              ? 'fill-yellow-400 text-yellow-400'
              : 'fill-muted text-muted'
          )}
        />
      ))}
    </div>
  );
}

/** Related products grid with horizontal scroll on mobile */
function RelatedProductsGrid({
  products,
  storeSlug,
}: {
  products: ProductDetails[];
  storeSlug: string;
}) {
  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <h2 className="text-2xl sm:text-3xl font-light text-white">You May Also Like</h2>
        <Link to={`/shop/${storeSlug}/products`} className="text-sm sm:text-base text-white/50 hover:text-white transition-colors">
          View All
        </Link>
      </div>
      <div className="flex overflow-x-auto gap-4 snap-x snap-mandatory pb-4 scrollbar-hide sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-6 sm:overflow-visible sm:pb-0">
        {products.map((relatedProduct) => (
          <Link
            key={relatedProduct.product_id}
            to={`/shop/${storeSlug}/products/${relatedProduct.product_id}`}
            className="flex-shrink-0 w-[65vw] snap-start sm:w-auto"
          >
            <div className="group relative rounded-2xl overflow-hidden bg-white/5 border border-white/5 hover:border-emerald-500/50 transition-all duration-300 h-full hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-900/20">
              <div className="aspect-[4/5] relative overflow-hidden">
                {relatedProduct.image_url ? (
                  <img
                    src={relatedProduct.image_url}
                    alt={relatedProduct.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 grayscale-[0.2] group-hover:grayscale-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-white/5">
                    <Package className="w-12 h-12 text-white/10" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 pointer-events-none" />
                <div className="absolute bottom-4 left-4 right-4 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                  <Button size="sm" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white border-0 shadow-lg shadow-emerald-900/50">
                    View Details
                  </Button>
                </div>
              </div>
              <div className="p-3 sm:p-5">
                <h3 className="font-medium text-sm sm:text-base text-white line-clamp-1 mb-1 group-hover:text-emerald-400 transition-colors">
                  {relatedProduct.name}
                </h3>
                <div className="flex items-center justify-between">
                  <span className="text-white/60 text-xs sm:text-sm">{relatedProduct.category}</span>
                  <span className="font-bold text-sm sm:text-base text-emerald-400">
                    {formatCurrency(relatedProduct.display_price)}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
