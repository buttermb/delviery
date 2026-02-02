/**
 * ReviewCard Component
 * Display individual product review with moderation actions
 */

import { formatSmartDate } from '@/lib/utils/formatDate';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { logger } from '@/lib/logger';
import { Textarea } from '@/components/ui/textarea';
import { StarRating } from './StarRating';
import Check from "lucide-react/dist/esm/icons/check";
import X from "lucide-react/dist/esm/icons/x";
import ThumbsUp from "lucide-react/dist/esm/icons/thumbs-up";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface ProductReview {
    id: string;
    product_id: string;
    customer_id: string | null;
    customer_name: string | null;
    rating: number;
    title: string | null;
    content: string;
    is_verified_purchase: boolean;
    status: 'pending' | 'approved' | 'rejected';
    helpful_count: number;
    created_at: string;
    updated_at: string;
    response?: {
        id: string;
        responder_name: string;
        content: string;
        created_at: string;
    } | null;
}

interface ReviewCardProps {
    review: ProductReview;
    onApprove?: () => Promise<void>;
    onReject?: () => Promise<void>;
    onRespond?: (content: string) => Promise<void>;
    showActions?: boolean;
    className?: string;
}

export function ReviewCard({
    review,
    onApprove,
    onReject,
    onRespond,
    showActions = false,
    className,
}: ReviewCardProps) {
    const [isResponding, setIsResponding] = useState(false);
    const [responseText, setResponseText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleRespond = async () => {
        if (!responseText.trim() || !onRespond) return;

        setIsSubmitting(true);
        try {
            await onRespond(responseText.trim());
            setResponseText('');
            setIsResponding(false);
        } catch (error) {
            logger.error('Failed to submit response', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const statusColors = {
        pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };

    return (
        <Card className={cn('overflow-hidden', className)}>
            <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <StarRating value={review.rating} readonly size="sm" />
                            {review.is_verified_purchase && (
                                <Badge variant="outline" className="gap-1">
                                    <ShieldCheck className="w-3 h-3" />
                                    Verified Purchase
                                </Badge>
                            )}
                            {showActions && (
                                <Badge className={statusColors[review.status]}>
                                    {review.status.charAt(0).toUpperCase() + review.status.slice(1)}
                                </Badge>
                            )}
                        </div>

                        {review.title && (
                            <h4 className="font-semibold text-base">{review.title}</h4>
                        )}

                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="font-medium">
                                {review.customer_name || 'Anonymous'}
                            </span>
                            <span>•</span>
                            <span>{formatSmartDate(review.created_at)}</span>
                        </div>
                    </div>

                    {showActions && (
                        <div className="flex gap-2">
                            {review.status === 'pending' && (
                                <>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={onApprove}
                                        className="gap-1 text-green-600 hover:text-green-700"
                                    >
                                        <Check className="w-4 h-4" />
                                        Approve
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={onReject}
                                        className="gap-1 text-red-600 hover:text-red-700"
                                    >
                                        <X className="w-4 h-4" />
                                        Reject
                                    </Button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Review Content */}
                <p className="text-sm leading-relaxed">{review.content}</p>

                {/* Helpful Count */}
                {review.helpful_count > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ThumbsUp className="w-3 h-3" />
                        <span>{review.helpful_count} found this helpful</span>
                    </div>
                )}

                {/* Vendor Response */}
                {review.response && (
                    <>
                        <Separator />
                        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Badge variant="secondary">Vendor Response</Badge>
                                <span className="text-muted-foreground">
                                    {review.response.responder_name}
                                </span>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-muted-foreground text-xs">
                                    {formatSmartDate(review.response.created_at)}
                                </span>
                            </div>
                            <p className="text-sm">{review.response.content}</p>
                        </div>
                    </>
                )}

                {/* Response Form */}
                {showActions && !review.response && review.status === 'approved' && (
                    <>
                        {!isResponding ? (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setIsResponding(true)}
                            >
                                Respond to Review
                            </Button>
                        ) : (
                            <div className="space-y-3 pt-2">
                                <Separator />
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Your Response</label>
                                    <Textarea
                                        placeholder="Thank you for your feedback..."
                                        value={responseText}
                                        onChange={(e) => setResponseText(e.target.value)}
                                        rows={3}
                                        className="resize-none"
                                    />
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            onClick={handleRespond}
                                            disabled={!responseText.trim() || isSubmitting}
                                        >
                                            {isSubmitting ? 'Submitting...' : 'Submit Response'}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                                setIsResponding(false);
                                                setResponseText('');
                                            }}
                                            disabled={isSubmitting}
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
