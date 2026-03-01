/**
 * ReviewModerationQueue Component
 * Admin interface for moderating pending reviews
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ReviewCard, type ProductReview } from './ReviewCard';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import { Search, Filter } from 'lucide-react';
import { queryKeys } from '@/lib/queryKeys';

interface ReviewModerationQueueProps {
    tenantId: string;
    storeId?: string;
}

export function ReviewModerationQueue({ tenantId, storeId }: ReviewModerationQueueProps) {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [ratingFilter, setRatingFilter] = useState<string>('all');

    // Fetch reviews
    const { data: reviews = [], isLoading } = useQuery({
        queryKey: queryKeys.reviews.list(tenantId, storeId, statusFilter, ratingFilter),
        queryFn: async () => {
            let query = supabase
                .from('product_reviews')
                .select('id, tenant_id, store_id, product_id, customer_id, customer_name, rating, title, content, is_verified_purchase, status, helpful_count, created_at, updated_at')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false });

            if (storeId) {
                query = query.eq('store_id', storeId);
            }

            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }

            if (ratingFilter !== 'all') {
                query = query.eq('rating', parseInt(ratingFilter));
            }

            const { data, error } = await query;

            if (error) {
                logger.error('Failed to fetch reviews', error);
                throw error;
            }

            // Fetch responses for each review
            const reviewsWithResponses = await Promise.all(
                (data ?? []).map(async (review) => {
                    const { data: responseData } = await supabase
                        .from('review_responses')
                        .select('id, responder_name, content, created_at')
                        .eq('review_id', review.id)
                        .maybeSingle();

                    return {
                        ...review,
                        response: responseData || null,
                    } as ProductReview;
                })
            );

            return reviewsWithResponses;
        },
    });

    // Update review status mutation
    const updateStatusMutation = useMutation({
        mutationFn: async ({ reviewId, status }: { reviewId: string; status: string }) => {
            const { error } = await supabase
                .from('product_reviews')
                .update({ status, updated_at: new Date().toISOString() })
                .eq('id', reviewId);

            if (error) throw error;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.reviews.all });
            toast.success(variables.status === 'approved' ? 'Review approved' : 'Review rejected');
        },
        onError: (error) => {
            logger.error('Failed to update review status', error);
            toast.error('Failed to update review status', { description: humanizeError(error) });
        },
    });

    // Submit response mutation
    const submitResponseMutation = useMutation({
        mutationFn: async ({ reviewId, content }: { reviewId: string; content: string }) => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { error } = await supabase
                .from('review_responses')
                .insert({
                    review_id: reviewId,
                    responder_id: user.id,
                    responder_name: user.user_metadata?.full_name || 'Vendor',
                    content,
                });

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.reviews.all });
            toast.success('Response submitted');
        },
        onError: (error) => {
            logger.error('Failed to submit response', error);
            toast.error('Failed to submit response', { description: humanizeError(error) });
        },
    });

    // Filter reviews by search term
    const filteredReviews = reviews.filter((review) => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
            review.content.toLowerCase().includes(searchLower) ||
            review.title?.toLowerCase().includes(searchLower) ||
            review.customer_name?.toLowerCase().includes(searchLower)
        );
    });

    const stats = {
        pending: reviews.filter((r) => r.status === 'pending').length,
        approved: reviews.filter((r) => r.status === 'approved').length,
        rejected: reviews.filter((r) => r.status === 'rejected').length,
    };

    const handleApprove = async (reviewId: string) => {
        await updateStatusMutation.mutateAsync({ reviewId, status: 'approved' });
    };

    const handleReject = async (reviewId: string) => {
        await updateStatusMutation.mutateAsync({ reviewId, status: 'rejected' });
    };

    const handleRespond = async (reviewId: string, content: string) => {
        await submitResponseMutation.mutateAsync({ reviewId, content });
    };

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                    <div className="text-2xl font-bold">{stats.pending}</div>
                    <div className="text-sm text-muted-foreground">Pending Review</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <div className="text-2xl font-bold">{stats.approved}</div>
                    <div className="text-sm text-muted-foreground">Approved</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                    <div className="text-2xl font-bold">{stats.rejected}</div>
                    <div className="text-sm text-muted-foreground">Rejected</div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search reviews..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                        aria-label="Search reviews"
                    />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                        <Filter className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={ratingFilter} onValueChange={setRatingFilter}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Rating" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Ratings</SelectItem>
                        <SelectItem value="5">5 Stars</SelectItem>
                        <SelectItem value="4">4 Stars</SelectItem>
                        <SelectItem value="3">3 Stars</SelectItem>
                        <SelectItem value="2">2 Stars</SelectItem>
                        <SelectItem value="1">1 Star</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Review List */}
            {isLoading ? (
                <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-48 w-full" />
                    ))}
                </div>
            ) : filteredReviews.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground">No reviews found</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredReviews.map((review) => (
                        <ReviewCard
                            key={review.id}
                            review={review}
                            showActions
                            onApprove={() => handleApprove(review.id)}
                            onReject={() => handleReject(review.id)}
                            onRespond={(content) => handleRespond(review.id, content)}
                            isUpdating={updateStatusMutation.isPending}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
