import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Star, MessageSquare, TrendingUp, RefreshCw,
  User, Calendar, ChevronDown, ChevronUp, Trash2
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MenuFeedbackProps {
  menuId?: string;
  className?: string;
}

interface MenuOption {
  id: string;
  name: string;
}

interface FeedbackItem {
  id: string;
  tenant_id: string;
  menu_id: string;
  order_id: string | null;
  customer_id: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
  customer_name?: string;
  customer_email?: string;
}

interface FeedbackStats {
  totalFeedback: number;
  averageRating: number;
  ratingDistribution: { rating: number; count: number; percentage: number }[];
  recentFeedback: FeedbackItem[];
}

function StarRating({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            sizeClasses[size],
            star <= rating
              ? 'fill-amber-400 text-amber-400'
              : 'fill-muted text-muted'
          )}
        />
      ))}
    </div>
  );
}

function RatingBadge({ rating }: { rating: number }) {
  const colorClass = rating >= 4
    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    : rating >= 3
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';

  return (
    <Badge variant="secondary" className={cn('font-semibold', colorClass)}>
      {rating.toFixed(1)} / 5.0
    </Badge>
  );
}

export function MenuFeedback({ menuId: propMenuId, className }: MenuFeedbackProps) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();

  const [selectedMenuId, setSelectedMenuId] = useState<string | undefined>(propMenuId);
  const [expandedFeedback, setExpandedFeedback] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [feedbackToDelete, setFeedbackToDelete] = useState<string | null>(null);

  const currentMenuId = propMenuId || selectedMenuId;

  // Fetch menus for selector
  const { data: menus = [], isLoading: menusLoading } = useQuery({
    queryKey: ['menu-feedback-menus', tenantId],
    queryFn: async (): Promise<MenuOption[]> => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('disposable_menus')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.warn('Failed to fetch menus for feedback selector', { error: error.message });
        return [];
      }

      return (data || []) as MenuOption[];
    },
    enabled: !!tenantId,
    staleTime: 60 * 1000,
  });

  // Fetch feedback data for selected menu
  const { data: feedbackStats, isLoading: feedbackLoading, refetch } = useQuery({
    queryKey: ['menu-feedback-stats', currentMenuId, tenantId],
    queryFn: async (): Promise<FeedbackStats> => {
      if (!tenantId || !currentMenuId) {
        return {
          totalFeedback: 0,
          averageRating: 0,
          ratingDistribution: [],
          recentFeedback: [],
        };
      }

      // Fetch feedback with customer info via order relationship
      const { data: feedback, error } = await (supabase as any)
        .from('menu_feedback')
        .select(`
          id,
          tenant_id,
          menu_id,
          order_id,
          customer_id,
          rating,
          comment,
          created_at
        `)
        .eq('tenant_id', tenantId)
        .eq('menu_id', currentMenuId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.warn('Failed to fetch menu feedback', { error: error.message });
        return {
          totalFeedback: 0,
          averageRating: 0,
          ratingDistribution: [],
          recentFeedback: [],
        };
      }

      const feedbackList = (feedback || []) as FeedbackItem[];

      // Calculate statistics
      const totalFeedback = feedbackList.length;
      const averageRating = totalFeedback > 0
        ? feedbackList.reduce((sum, f) => sum + f.rating, 0) / totalFeedback
        : 0;

      // Calculate rating distribution
      const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      feedbackList.forEach(f => {
        if (f.rating >= 1 && f.rating <= 5) {
          ratingCounts[f.rating]++;
        }
      });

      const ratingDistribution = [5, 4, 3, 2, 1].map(rating => ({
        rating,
        count: ratingCounts[rating],
        percentage: totalFeedback > 0 ? (ratingCounts[rating] / totalFeedback) * 100 : 0,
      }));

      return {
        totalFeedback,
        averageRating,
        ratingDistribution,
        recentFeedback: feedbackList.slice(0, 50), // Limit to recent 50
      };
    },
    enabled: !!tenantId && !!currentMenuId,
    staleTime: 30 * 1000,
  });

  // Delete feedback mutation
  const deleteFeedbackMutation = useMutation({
    mutationFn: async (feedbackId: string) => {
      const { error } = await (supabase as any)
        .from('menu_feedback')
        .delete()
        .eq('id', feedbackId)
        .eq('tenant_id', tenantId!);

      if (error) {
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      toast.success('Feedback deleted');
      queryClient.invalidateQueries({ queryKey: ['menu-feedback-stats', currentMenuId, tenantId] });
    },
    onError: (error: Error) => {
      logger.error('Failed to delete feedback', error);
      toast.error('Failed to delete feedback');
    },
  });

  const toggleFeedbackExpand = (id: string) => {
    setExpandedFeedback(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const isLoading = menusLoading || feedbackLoading;

  if (isLoading && !feedbackStats) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Menu Feedback</h2>
          {feedbackLoading && (
            <Badge variant="outline" className="animate-pulse">
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              Updating...
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 ml-auto">
          {/* Menu Selector (if not provided via props) */}
          {!propMenuId && (
            <Select value={selectedMenuId} onValueChange={setSelectedMenuId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select a menu" />
              </SelectTrigger>
              <SelectContent>
                {menus.map((menu) => (
                  <SelectItem key={menu.id} value={menu.id}>
                    {menu.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Refresh Button */}
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {!currentMenuId ? (
        <Card className="p-12">
          <div className="text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Select a menu to view feedback</p>
            <p className="text-sm mt-2">Choose a menu from the dropdown to see customer feedback and ratings</p>
          </div>
        </Card>
      ) : feedbackStats && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Average Rating */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Average Rating</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-3xl font-bold">
                        {feedbackStats.averageRating.toFixed(1)}
                      </span>
                      <span className="text-muted-foreground text-lg">/5</span>
                    </div>
                    <StarRating rating={Math.round(feedbackStats.averageRating)} size="md" />
                  </div>
                  <div className="h-14 w-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Star className="h-7 w-7 text-amber-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Feedback */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Feedback</p>
                    <p className="text-3xl font-bold mt-1">
                      {feedbackStats.totalFeedback.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Customer reviews
                    </p>
                  </div>
                  <div className="h-14 w-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <MessageSquare className="h-7 w-7 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Rating Trend */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Satisfaction Score</p>
                    <p className="text-3xl font-bold mt-1">
                      {feedbackStats.totalFeedback > 0
                        ? Math.round((feedbackStats.ratingDistribution
                            .filter(r => r.rating >= 4)
                            .reduce((sum, r) => sum + r.count, 0) / feedbackStats.totalFeedback) * 100)
                        : 0}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      4+ star ratings
                    </p>
                  </div>
                  <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <TrendingUp className="h-7 w-7 text-green-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Rating Distribution & Recent Feedback */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Rating Distribution */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-500" />
                  Rating Distribution
                </CardTitle>
                <CardDescription>Breakdown by star rating</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {feedbackStats.ratingDistribution.map(({ rating, count, percentage }) => (
                    <div key={rating} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-4 text-right font-medium">{rating}</span>
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        </div>
                        <span className="text-muted-foreground text-xs">
                          {count} ({percentage.toFixed(0)}%)
                        </span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  ))}
                </div>

                {feedbackStats.totalFeedback === 0 && (
                  <div className="py-8 text-center text-muted-foreground">
                    <Star className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No ratings yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Feedback */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-500" />
                  Recent Feedback
                </CardTitle>
                <CardDescription>Latest customer reviews for this menu</CardDescription>
              </CardHeader>
              <CardContent>
                {feedbackStats.recentFeedback.length > 0 ? (
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-4">
                      {feedbackStats.recentFeedback.map((feedback) => {
                        const isExpanded = expandedFeedback.has(feedback.id);
                        const hasLongComment = feedback.comment && feedback.comment.length > 150;

                        return (
                          <div
                            key={feedback.id}
                            className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-2">
                                  <StarRating rating={feedback.rating} size="sm" />
                                  <RatingBadge rating={feedback.rating} />
                                </div>

                                {feedback.comment && (
                                  <div className="mt-2">
                                    <p className={cn(
                                      'text-sm text-muted-foreground',
                                      !isExpanded && hasLongComment && 'line-clamp-2'
                                    )}>
                                      {feedback.comment}
                                    </p>
                                    {hasLongComment && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="mt-1 h-auto p-0 text-xs text-primary"
                                        onClick={() => toggleFeedbackExpand(feedback.id)}
                                      >
                                        {isExpanded ? (
                                          <>
                                            <ChevronUp className="h-3 w-3 mr-1" />
                                            Show less
                                          </>
                                        ) : (
                                          <>
                                            <ChevronDown className="h-3 w-3 mr-1" />
                                            Read more
                                          </>
                                        )}
                                      </Button>
                                    )}
                                  </div>
                                )}

                                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(feedback.created_at), 'MMM d, yyyy h:mm a')}
                                  </div>
                                  {feedback.order_id && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-muted-foreground/60">Order:</span>
                                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                        {feedback.order_id.slice(0, 8)}...
                                      </code>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => {
                                  setFeedbackToDelete(feedback.id);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="py-12 text-center text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">No feedback yet</p>
                    <p className="text-sm mt-2">
                      Feedback will appear here when customers submit reviews after completing orders
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (feedbackToDelete) {
            deleteFeedbackMutation.mutate(feedbackToDelete);
            setDeleteDialogOpen(false);
            setFeedbackToDelete(null);
          }
        }}
        itemType="feedback"
        isLoading={deleteFeedbackMutation.isPending}
      />
    </div>
  );
}
