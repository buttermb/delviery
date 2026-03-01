/**
 * ReviewSubmissionForm Component
 * Customer form for submitting product reviews
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeFormInput, sanitizeTextareaInput } from '@/lib/utils/sanitize';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StarRating } from './StarRating';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import { queryKeys } from '@/lib/queryKeys';

const reviewSchema = z.object({
  rating: z.number().min(1).max(5),
  title: z.string().max(100).optional().or(z.literal("")),
  content: z.string().min(1, "Please write your review before submitting.").max(1000),
});

type ReviewFormValues = z.infer<typeof reviewSchema>;

interface ReviewSubmissionFormProps {
  productId: string;
  productName: string;
  storeId: string;
  tenantId: string;
  onSuccess?: () => void;
}

export function ReviewSubmissionForm({
  productId,
  productName,
  storeId,
  tenantId,
  onSuccess,
}: ReviewSubmissionFormProps) {
  const queryClient = useQueryClient();

  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: 5,
      title: '',
      content: '',
    },
  });

  const submitReviewMutation = useMutation({
    mutationFn: async (values: ReviewFormValues) => {
      const { data: { user } } = await supabase.auth.getUser();

      const reviewData = {
        product_id: productId,
        store_id: storeId,
        tenant_id: tenantId,
        customer_id: user?.id || null,
        customer_name: sanitizeFormInput(user?.user_metadata?.full_name || 'Anonymous', 100),
        rating: values.rating,
        title: values.title?.trim() ? sanitizeFormInput(values.title, 100) : null,
        content: sanitizeTextareaInput(values.content, 1000),
        status: 'pending',
      };

      const { error } = await supabase
        .from('product_reviews')
        .insert(reviewData);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.byProduct(productId) });
      toast.success('Your review has been submitted for moderation.');
      form.reset({ rating: 5, title: '', content: '' });
      onSuccess?.();
    },
    onError: (error) => {
      logger.error('Failed to submit review', error);
      toast.error('Failed to submit review', { description: humanizeError(error) });
    },
  });

  const onSubmit = (values: ReviewFormValues) => {
    submitReviewMutation.mutate(values);
  };

  const watchContent = form.watch('content');
  const watchTitle = form.watch('title');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Write a Review</CardTitle>
        <CardDescription>
          Share your experience with {productName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="rating"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Your Rating</FormLabel>
                  <FormControl>
                    <StarRating
                      value={field.value}
                      onChange={field.onChange}
                      size="lg"
                      showValue
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Review Title <span className="text-muted-foreground">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Great product!"
                      maxLength={100}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {(watchTitle || '').length}/100 characters
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Your Review</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Tell us what you think..."
                      rows={5}
                      maxLength={1000}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {(watchContent || '').length}/1000 characters
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={submitReviewMutation.isPending || !(watchContent || '').trim()}
              className="w-full"
            >
              {submitReviewMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Submit Review
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Your review will be posted after moderation
            </p>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
