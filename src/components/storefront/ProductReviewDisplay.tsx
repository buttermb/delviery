/**
 * Storefront Product Review Display
 * Shows product reviews with star ratings, average rating, reviewer info
 */

import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { logger } from '@/lib/logger';

interface ProductReview {
  id: string;
  reviewer_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

interface ProductReviewDisplayProps {
  productId: string;
  tenantSlug: string;
}

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const iconSize = size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${iconSize} ${
            star <= rating
              ? 'fill-yellow-400 text-yellow-400'
              : star - 0.5 <= rating
                ? 'fill-yellow-400/50 text-yellow-400'
                : 'text-muted-foreground/30'
          }`}
        />
      ))}
    </div>
  );
}

function formatReviewDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ProductReviewDisplay({
  productId,
  tenantSlug,
}: ProductReviewDisplayProps) {
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: queryKeys.shopProducts.reviews(tenantSlug, productId),
    queryFn: async () => {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .maybeSingle();

      if (!tenant) return [];

      const { data, error } = await supabase
        .from('product_reviews')
        .select('id, reviewer_name, rating, comment, created_at')
        .eq('product_id', productId)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch product reviews', error);
        return [];
      }

      return data || [];
    },
    enabled: !!productId && !!tenantSlug,
  });

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading reviews...</div>;
  }

  if (reviews.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Star className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">No reviews yet</p>
        </CardContent>
      </Card>
    );
  }

  const averageRating =
    reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  const ratingCounts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
    percentage: (reviews.filter((r) => r.rating === star).length / reviews.length) * 100,
  }));

  return (
    <div className="space-y-6">
      {/* Average Rating Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Customer Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-8">
            <div className="text-center">
              <p className="text-4xl font-bold">{averageRating.toFixed(1)}</p>
              <StarRating rating={Math.round(averageRating)} size="lg" />
              <p className="text-sm text-muted-foreground mt-1">
                {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
              </p>
            </div>
            <div className="flex-1 space-y-2">
              {ratingCounts.map(({ star, count, percentage }) => (
                <div key={star} className="flex items-center gap-2 text-sm">
                  <span className="w-8 text-right text-muted-foreground">{star} star</span>
                  <Progress value={percentage} className="h-2 flex-1" />
                  <span className="w-8 text-muted-foreground">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual Reviews */}
      <div className="space-y-4">
        {reviews.map((review, index) => (
          <div key={review.id}>
            <div className="space-y-2 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                    {review.reviewer_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{review.reviewer_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatReviewDate(review.created_at)}
                    </p>
                  </div>
                </div>
                <StarRating rating={review.rating} />
              </div>
              {review.comment && (
                <p className="text-sm text-muted-foreground leading-relaxed pl-11">
                  {review.comment}
                </p>
              )}
            </div>
            {index < reviews.length - 1 && <Separator />}
          </div>
        ))}
      </div>
    </div>
  );
}
