/**
 * DeliveryRatingForm Component
 *
 * Customer-facing star rating form shown on the order tracking page
 * after delivery is completed. Allows 1-5 star rating + optional comment.
 */

import { useState } from 'react';
import { Star, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useExistingRating, useSubmitDeliveryRating } from '@/hooks/useDeliveryRatings';
import { logger } from '@/lib/logger';
import type { CreateDeliveryRatingInput } from '@/types/deliveryRating';

const UNSELECTED_STAR_COLOR = 'hsl(var(--border))';

const ratingSchema = z.object({
  rating: z.number().min(1, 'Please select a rating').max(5),
  comment: z.string().max(500).optional().or(z.literal('')),
});

type RatingFormValues = z.infer<typeof ratingSchema>;

interface DeliveryRatingFormProps {
  tenantId: string;
  orderId: string;
  trackingToken: string;
  deliveryId?: string;
  runnerId?: string;
  customerId?: string;
  primaryColor?: string;
}

export function DeliveryRatingForm({
  tenantId,
  orderId,
  trackingToken,
  deliveryId,
  runnerId,
  customerId,
  primaryColor = '#16a34a',
}: DeliveryRatingFormProps) {
  const [hoveredRating, setHoveredRating] = useState(0);

  const { data: existingRating, isLoading: checkingExisting } =
    useExistingRating(trackingToken);
  const submitMutation = useSubmitDeliveryRating();

  const form = useForm<RatingFormValues>({
    resolver: zodResolver(ratingSchema),
    defaultValues: {
      rating: 0,
      comment: '',
    },
  });

  const watchRating = form.watch('rating');

  const onSubmit = (values: RatingFormValues) => {
    const input: CreateDeliveryRatingInput = {
      tenant_id: tenantId,
      order_id: orderId,
      delivery_id: deliveryId,
      runner_id: runnerId,
      customer_id: customerId,
      tracking_token: trackingToken,
      rating: values.rating,
      comment: values.comment?.trim() || undefined,
    };

    submitMutation.mutate(input, {
      onSuccess: () => {
        logger.info('[DeliveryRatingForm] Rating submitted', {
          orderId,
          rating: values.rating,
        });
      },
    });
  };

  // Already rated
  if (existingRating) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Rating</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-1 mb-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className="w-6 h-6"
                fill={star <= existingRating.rating ? primaryColor : 'none'}
                stroke={star <= existingRating.rating ? primaryColor : UNSELECTED_STAR_COLOR}
              />
            ))}
          </div>
          {existingRating.comment && (
            <p className="text-sm text-muted-foreground mt-2">
              &ldquo;{existingRating.comment}&rdquo;
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Thank you for your feedback!
          </p>
        </CardContent>
      </Card>
    );
  }

  if (checkingExisting) return null;

  // Success state after submitting
  if (submitMutation.isSuccess) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <div className="flex justify-center gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className="w-6 h-6"
                fill={star <= watchRating ? primaryColor : 'none'}
                stroke={star <= watchRating ? primaryColor : UNSELECTED_STAR_COLOR}
              />
            ))}
          </div>
          <p className="font-medium">Thank you for your feedback!</p>
          <p className="text-sm text-muted-foreground mt-1">
            Your rating helps us improve our delivery service.
          </p>
        </CardContent>
      </Card>
    );
  }

  const displayRating = hoveredRating || watchRating;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Rate Your Delivery</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="rating"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => field.onChange(star)}
                          onMouseEnter={() => setHoveredRating(star)}
                          onMouseLeave={() => setHoveredRating(0)}
                          className="transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                          aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                        >
                          <Star
                            className="w-8 h-8 transition-colors"
                            fill={star <= displayRating ? primaryColor : 'none'}
                            stroke={star <= displayRating ? primaryColor : UNSELECTED_STAR_COLOR}
                          />
                        </button>
                      ))}
                      {watchRating > 0 && (
                        <span className="text-sm text-muted-foreground ml-2">
                          {watchRating}/5
                        </span>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Tell us about your delivery experience (optional)"
                      rows={3}
                      maxLength={500}
                      aria-label="Delivery experience comment"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={watchRating === 0 || submitMutation.isPending}
              className="w-full"
              style={{ backgroundColor: primaryColor }}
            >
              {submitMutation.isPending ? 'Submitting...' : 'Submit Rating'}
            </Button>

            {submitMutation.isError && (
              <p className="text-sm text-destructive">
                Failed to submit rating. Please try again.
              </p>
            )}
            {submitMutation.isError && (
              <p className="text-sm text-destructive">
                Failed to submit rating. Please try again.
              </p>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
