/**
 * ReviewSubmissionForm Component
 * Customer form for submitting product reviews
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeFormInput, sanitizeTextareaInput } from '@/lib/utils/sanitize';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StarRating } from './StarRating';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { Loader2 } from 'lucide-react';
import { queryKeys } from '@/lib/queryKeys';

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
    const [rating, setRating] = useState(5);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');

    const submitReviewMutation = useMutation({
        mutationFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();

            const reviewData = {
                product_id: productId,
                store_id: storeId,
                tenant_id: tenantId,
                customer_id: user?.id || null,
                customer_name: sanitizeFormInput(user?.user_metadata?.full_name || 'Anonymous', 100),
                rating,
                title: title.trim() ? sanitizeFormInput(title, 100) : null,
                content: sanitizeTextareaInput(content, 1000),
                status: 'pending', // All reviews start as pending
            };

            const { error } = await supabase
                .from('product_reviews')
                .insert(reviewData);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.reviews.byProduct(productId) });
            toast.success('Your review has been submitted for moderation.');
            // Reset form
            setRating(5);
            setTitle('');
            setContent('');
            onSuccess?.();
        },
        onError: (error) => {
            logger.error('Failed to submit review', error);
            toast.error('Failed to submit review. Please try again later.');
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!content.trim()) {
            toast.error('Please write your review before submitting.');
            return;
        }

        submitReviewMutation.mutate();
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Write a Review</CardTitle>
                <CardDescription>
                    Share your experience with {productName}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Rating */}
                    <div className="space-y-2">
                        <Label>Your Rating *</Label>
                        <StarRating
                            value={rating}
                            onChange={setRating}
                            size="lg"
                            showValue
                        />
                    </div>

                    {/* Title */}
                    <div className="space-y-2">
                        <Label htmlFor="review-title">
                            Review Title <span className="text-muted-foreground">(optional)</span>
                        </Label>
                        <Input
                            id="review-title"
                            placeholder="Great product!"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={100}
                        />
                        <p className="text-xs text-muted-foreground">
                            {title.length}/100 characters
                        </p>
                    </div>

                    {/* Content */}
                    <div className="space-y-2">
                        <Label htmlFor="review-content">Your Review *</Label>
                        <Textarea
                            id="review-content"
                            placeholder="Tell us what you think..."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            rows={5}
                            maxLength={1000}
                            required
                        />
                        <p className="text-xs text-muted-foreground">
                            {content.length}/1000 characters
                        </p>
                    </div>

                    {/* Submit Button */}
                    <Button
                        type="submit"
                        disabled={submitReviewMutation.isPending || !content.trim()}
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
            </CardContent>
        </Card>
    );
}
