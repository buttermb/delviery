/**
 * Review Submission Form
 * Allows customers to leave product reviews
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeFormInput, sanitizeEmail, sanitizeTextareaInput } from '@/lib/utils/sanitize';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Star, Loader2, CheckCircle, PenLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

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

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [customerName, setCustomerName] = useState(defaultName ?? '');
  const [customerEmail, setCustomerEmail] = useState(defaultEmail ?? '');

  // Submit review mutation
  const submitReviewMutation = useMutation({
    mutationFn: async () => {
      if (rating === 0) {
        throw new Error('Please select a rating');
      }

      const { error } = await supabase
        .from('marketplace_reviews')
        .insert({
          store_id: storeId,
          product_id: productId,
          customer_id: customerId,
          customer_name: sanitizeFormInput(customerName, 100) || 'Anonymous',
          customer_email: customerEmail ? sanitizeEmail(customerEmail) : null,
          rating,
          title: title ? sanitizeFormInput(title, 100) : null,
          comment: comment ? sanitizeTextareaInput(comment, 1000) : null,
          is_verified_purchase: !!customerId, // Verified if logged in
          is_approved: false, // Requires moderation
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Review submitted!', {
        description: 'Thank you for your feedback. Your review will appear after moderation.',
      });
      setIsOpen(false);
      // Reset form
      setRating(0);
      setTitle('');
      setComment('');
      // Invalidate reviews query
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.byStoreProduct(storeId, productId) });
    },
    onError: (error) => {
      logger.error('Failed to submit review', error, { component: 'ReviewForm' });
      toast.error('Failed to submit review', {
        description: 'Please try again later.',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitReviewMutation.mutate();
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

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Star Rating */}
          <div className="space-y-2">
            <Label>Your Rating *</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={cn(
                      'w-8 h-8 transition-colors',
                      (hoverRating || rating) >= star
                        ? 'fill-warning text-warning'
                        : 'fill-muted text-muted-foreground'
                    )}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-sm text-muted-foreground">
                {rating === 1 && 'Poor'}
                {rating === 2 && 'Fair'}
                {rating === 3 && 'Good'}
                {rating === 4 && 'Very Good'}
                {rating === 5 && 'Excellent'}
              </p>
            )}
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="reviewer-name">Your Name</Label>
            <Input
              id="reviewer-name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="John Doe (or leave blank for Anonymous)"
            />
          </div>

          {/* Email (optional) */}
          <div className="space-y-2">
            <Label htmlFor="reviewer-email">Email (optional)</Label>
            <Input
              id="reviewer-email"
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="john@example.com"
            />
            <p className="text-xs text-muted-foreground">
              Your email won't be displayed publicly
            </p>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="review-title">Review Title</Label>
            <Input
              id="review-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Summarize your experience"
              maxLength={100}
            />
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <Label htmlFor="review-comment">Your Review</Label>
            <Textarea
              id="review-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell others what you liked or didn't like about this product..."
              rows={4}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground text-right">
              {comment.length}/1000
            </p>
          </div>

          {/* Submit Button */}
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
              disabled={submitReviewMutation.isPending || rating === 0}
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
      </DialogContent>
    </Dialog>
  );
}

export default ReviewForm;



