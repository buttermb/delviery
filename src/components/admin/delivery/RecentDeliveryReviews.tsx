/**
 * RecentDeliveryReviews Component
 *
 * Shows recent customer delivery ratings on the admin delivery dashboard.
 * Highlights low ratings (<=2) for admin attention.
 */

import { Star, AlertTriangle, MessageSquare } from 'lucide-react';

import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useRecentDeliveryRatings } from '@/hooks/useDeliveryRatings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatSmartDate } from '@/lib/utils/formatDate';

function StarDisplay({ rating, size = 4 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-${size} h-${size}`}
          fill={star <= rating ? '#f59e0b' : 'none'}
          stroke={star <= rating ? '#f59e0b' : '#d1d5db'}
        />
      ))}
    </div>
  );
}

export function RecentDeliveryReviews() {
  const { tenant } = useTenantAdminAuth();
  const { data: ratings, isLoading, error } = useRecentDeliveryRatings(
    tenant?.id ?? null,
    10
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Recent Reviews
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-destructive text-sm">Failed to load reviews</p>
        </CardContent>
      </Card>
    );
  }

  const reviewList = ratings || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Recent Reviews
          {reviewList.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {reviewList.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {reviewList.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No delivery reviews yet
          </p>
        ) : (
          <div className="space-y-4">
            {reviewList.map((review) => (
              <div
                key={review.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  review.rating <= 2
                    ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950'
                    : 'border-border'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StarDisplay rating={review.rating} />
                    {review.rating <= 2 && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Low
                      </Badge>
                    )}
                  </div>

                  {review.comment && (
                    <p className="text-sm mt-1 text-muted-foreground line-clamp-2">
                      &ldquo;{review.comment}&rdquo;
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    {review.runner_name && (
                      <span>Runner: {review.runner_name}</span>
                    )}
                    <span>{formatSmartDate(review.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
