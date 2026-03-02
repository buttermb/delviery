/**
 * Review Submission Form
 * Allows customers to leave product reviews
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeFormInput, sanitizeEmail, sanitizeTextareaInput } from '@/lib/utils/sanitize';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { toast } from 'sonner';
import { Star, Loader2, CheckCircle, PenLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

const reviewSchema = z.object({
  rating: z.number().min(1, "Please select a rating").max(5),
  customerName: z.string().max(100).optional().or(z.literal("")),
  customerEmail: z.string().email("Invalid email").max(255).optional().or(z.literal("")),
  title: z.string().max(100).optional().or(z.literal("")),
  comment: z.string().max(1000).optional().or(z.literal("")),
});

type ReviewFormValues = z.infer<typeof reviewSchema>;

interface ReviewFormProps {
  storeId: string;
  productId: string;
  productName: string;
  primaryColor: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
}

export function ReviewForm({
  storeId,
  productId,
  productName,
  primaryColor,
  customerId,
  customerName: defaultName,
  customerEmail: defaultEmail,
}: ReviewFormProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);

  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: 0,
      customerName: defaultName ?? '',
      customerEmail: defaultEmail ?? '',
      title: '',
      comment: '',
    },
  });

  const watchRating = form.watch('rating');

  const submitReviewMutation = useMutation({
    mutationFn: async (values: ReviewFormValues) => {
      const { error } = await supabase
        .from('marketplace_reviews')
        .insert({
          store_id: storeId,
          product_id: productId,
          customer_id: customerId,
          customer_name: sanitizeFormInput(values.customerName || '', 100) || 'Anonymous',
          customer_email: values.customerEmail ? sanitizeEmail(values.customerEmail) : null,
          rating: values.rating,
          title: values.title ? sanitizeFormInput(values.title, 100) : null,
          comment: values.comment ? sanitizeTextareaInput(values.comment, 1000) : null,
          is_verified_purchase: !!customerId,
          is_approved: false,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Review submitted!', {
        description: 'Thank you for your feedback. Your review will appear after moderation.',
      });
      setIsOpen(false);
      form.reset({ rating: 0, customerName: defaultName ?? '', customerEmail: defaultEmail ?? '', title: '', comment: '' });
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.byStoreProduct(storeId, productId) });
    },
    onError: (error) => {
      logger.error('Failed to submit review', error, { component: 'ReviewForm' });
      toast.error('Failed to submit review', {
        description: 'Please try again later.',
      });
    },
  });

  const onSubmit = (values: ReviewFormValues) => {
    submitReviewMutation.mutate(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <PenLine className="w-4 h-4" />
          Write a Review
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Write a Review</DialogTitle>
          <DialogDescription>
            Share your thoughts about {productName}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <FormField
              control={form.control}
              name="rating"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Rating *</FormLabel>
                  <FormControl>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => field.onChange(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="p-1 transition-transform hover:scale-110"
                        >
                          <Star
                            className={cn(
                              'w-8 h-8 transition-colors',
                              (hoverRating || field.value) >= star
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'fill-muted text-muted-foreground'
                            )}
                          />
                        </button>
                      ))}
                    </div>
                  </FormControl>
                  {watchRating > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {watchRating === 1 && 'Poor'}
                      {watchRating === 2 && 'Fair'}
                      {watchRating === 3 && 'Good'}
                      {watchRating === 4 && 'Very Good'}
                      {watchRating === 5 && 'Excellent'}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="customerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="John Doe (or leave blank for Anonymous)"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="customerEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (optional)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="john@example.com"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Your email won't be displayed publicly
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Review Title</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Summarize your experience"
                      maxLength={100}
                    />
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
                  <FormLabel>Your Review</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Tell others what you liked or didn't like about this product..."
                      rows={4}
                      maxLength={1000}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground text-right">
                    {(field.value || '').length}/1000
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                style={{ backgroundColor: primaryColor }}
                disabled={submitReviewMutation.isPending || watchRating === 0}
              >
                {submitReviewMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Submit Review
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default ReviewForm;