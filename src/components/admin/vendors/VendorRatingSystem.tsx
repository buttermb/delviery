/**
 * Vendor Rating System Component
 *
 * Internal vendor rating system for admin staff.
 * Features:
 * - Rate vendors on 5 dimensions (price, quality, reliability, communication, compliance)
 * - Aggregate score displayed on vendor card and detail
 * - Ratings linked to specific POs
 * - History of ratings over time
 * - Only visible to admin staff
 */

import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import {
  Star,
  Plus,
  Loader2,
  Edit,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  useVendorRatings,
  RATING_DIMENSIONS,
  MIN_RATING,
  MAX_RATING,
  getRatingLabel,
  getRatingColor,
  type VendorRating,
  type RatingDimension,
} from '@/hooks/useVendorRatings';
import { useVendorOrders } from '@/hooks/useVendorOrders';
import { logger } from '@/lib/logger';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';

// ============================================================================
// Types & Schema
// ============================================================================

interface VendorRatingSystemProps {
  vendorId: string;
  vendorName: string;
}

const ratingFormSchema = z.object({
  purchase_order_id: z.string().optional(),
  price_rating: z.number().min(MIN_RATING).max(MAX_RATING),
  quality_rating: z.number().min(MIN_RATING).max(MAX_RATING),
  reliability_rating: z.number().min(MIN_RATING).max(MAX_RATING),
  communication_rating: z.number().min(MIN_RATING).max(MAX_RATING),
  compliance_rating: z.number().min(MIN_RATING).max(MAX_RATING),
  notes: z.string().optional(),
});

type RatingFormValues = z.infer<typeof ratingFormSchema>;

// ============================================================================
// Star Rating Display Component
// ============================================================================

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' | 'lg' }) {
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
          className={`${sizeClasses[size]} ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            }`}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Rating Slider Component
// ============================================================================

function RatingSlider({
  value,
  onChange,
  dimension,
}: {
  value: number;
  onChange: (value: number) => void;
  dimension: (typeof RATING_DIMENSIONS)[number];
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{dimension.label}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-sm">{dimension.description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-2">
          <StarRating rating={value} size="sm" />
          <span className={`text-sm font-medium ${getRatingColor(value)}`}>
            {value.toFixed(1)}
          </span>
        </div>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={MIN_RATING}
        max={MAX_RATING}
        step={0.5}
        className="w-full"
      />
    </div>
  );
}

// ============================================================================
// Aggregate Score Card Component
// ============================================================================

function AggregateScoreCard({
  aggregate,
  isLoading,
}: {
  aggregate: ReturnType<typeof useVendorRatings>['aggregate'];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!aggregate) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        No ratings yet
      </div>
    );
  }

  const dimensions = [
    { key: 'price' as const, label: 'Price', value: aggregate.avg_price },
    { key: 'quality' as const, label: 'Quality', value: aggregate.avg_quality },
    { key: 'reliability' as const, label: 'Reliability', value: aggregate.avg_reliability },
    { key: 'communication' as const, label: 'Communication', value: aggregate.avg_communication },
    { key: 'compliance' as const, label: 'Compliance', value: aggregate.avg_compliance },
  ];

  return (
    <div className="space-y-4">
      {/* Overall Score */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div>
          <p className="text-sm text-muted-foreground">Overall Score</p>
          <p className={`text-3xl font-bold ${getRatingColor(aggregate.avg_overall)}`}>
            {aggregate.avg_overall.toFixed(1)}
          </p>
          <p className={`text-sm ${getRatingColor(aggregate.avg_overall)}`}>
            {getRatingLabel(aggregate.avg_overall)}
          </p>
        </div>
        <div className="text-right">
          <StarRating rating={Math.round(aggregate.avg_overall)} size="lg" />
          <p className="text-sm text-muted-foreground mt-1">
            Based on {aggregate.total_ratings} rating{aggregate.total_ratings !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Dimension Breakdown */}
      <div className="space-y-3">
        {dimensions.map((dim) => (
          <div key={dim.key} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{dim.label}</span>
              <span className={`font-medium ${getRatingColor(dim.value)}`}>
                {dim.value.toFixed(1)}
              </span>
            </div>
            <Progress value={(dim.value / MAX_RATING) * 100} className="h-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Rating History Item Component
// ============================================================================

function RatingHistoryItem({
  rating,
  onEdit,
  onDelete,
}: {
  rating: VendorRating;
  onEdit: (rating: VendorRating) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <StarRating rating={Math.round(rating.overall_score)} size="sm" />
            <span className={`font-medium ${getRatingColor(rating.overall_score)}`}>
              {rating.overall_score.toFixed(1)}
            </span>
            <Badge variant="outline" className="text-xs">
              {getRatingLabel(rating.overall_score)}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Rated on {format(new Date(rating.rated_at), 'MMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEdit(rating)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => onDelete(rating.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Dimension scores */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: 'Price', value: rating.price_rating },
          { label: 'Quality', value: rating.quality_rating },
          { label: 'Reliability', value: rating.reliability_rating },
          { label: 'Comm.', value: rating.communication_rating },
          { label: 'Compliance', value: rating.compliance_rating },
        ].map((dim) => (
          <div key={dim.label} className="text-center">
            <p className="text-xs text-muted-foreground">{dim.label}</p>
            <p className={`text-sm font-medium ${getRatingColor(dim.value)}`}>
              {dim.value.toFixed(1)}
            </p>
          </div>
        ))}
      </div>

      {/* Linked PO */}
      {rating.purchase_order_id && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <FileText className="h-3 w-3" />
          <span>Linked to PO</span>
        </div>
      )}

      {/* Notes */}
      {rating.notes && (
        <p className="text-sm text-muted-foreground border-t pt-2">{rating.notes}</p>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function VendorRatingSystem({ vendorId, vendorName }: VendorRatingSystemProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRating, setEditingRating] = useState<VendorRating | null>(null);
  const [deleteRatingId, setDeleteRatingId] = useState<string | null>(null);

  const {
    ratings,
    aggregate,
    isLoading,
    isError,
    createRating,
    updateRating,
    deleteRating,
    isCreating,
    isUpdating,
    isDeleting,
  } = useVendorRatings(vendorId);

  // Fetch vendor's purchase orders for linking
  const { data: vendorOrders, isLoading: isLoadingOrders } = useVendorOrders(vendorId);

  const form = useForm<RatingFormValues>({
    resolver: zodResolver(ratingFormSchema),
    defaultValues: {
      purchase_order_id: '',
      price_rating: 3,
      quality_rating: 3,
      reliability_rating: 3,
      communication_rating: 3,
      compliance_rating: 3,
      notes: '',
    },
  });

  // Handle dialog open for create
  const handleAddRating = useCallback(() => {
    setEditingRating(null);
    form.reset({
      purchase_order_id: '',
      price_rating: 3,
      quality_rating: 3,
      reliability_rating: 3,
      communication_rating: 3,
      compliance_rating: 3,
      notes: '',
    });
    setIsDialogOpen(true);
  }, [form]);

  // Handle dialog open for edit
  const handleEditRating = useCallback(
    (rating: VendorRating) => {
      setEditingRating(rating);
      form.reset({
        purchase_order_id: rating.purchase_order_id ?? '',
        price_rating: rating.price_rating,
        quality_rating: rating.quality_rating,
        reliability_rating: rating.reliability_rating,
        communication_rating: rating.communication_rating,
        compliance_rating: rating.compliance_rating,
        notes: rating.notes ?? '',
      });
      setIsDialogOpen(true);
    },
    [form]
  );

  // Handle form submit
  const handleSubmit = async (values: RatingFormValues) => {
    try {
      if (editingRating) {
        await updateRating({
          id: editingRating.id,
          price_rating: values.price_rating,
          quality_rating: values.quality_rating,
          reliability_rating: values.reliability_rating,
          communication_rating: values.communication_rating,
          compliance_rating: values.compliance_rating,
          notes: values.notes || null,
        });
        toast.success('Rating updated');
      } else {
        await createRating({
          vendor_id: vendorId,
          purchase_order_id: values.purchase_order_id || undefined,
          price_rating: values.price_rating,
          quality_rating: values.quality_rating,
          reliability_rating: values.reliability_rating,
          communication_rating: values.communication_rating,
          compliance_rating: values.compliance_rating,
          notes: values.notes || undefined,
        });
        toast.success('Rating added');
      }
      setIsDialogOpen(false);
      form.reset();
    } catch (error) {
      logger.error('Failed to save rating', error, {
        component: 'VendorRatingSystem',
      });
      toast.error(editingRating ? 'Failed to update rating' : 'Failed to add rating');
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deleteRatingId) return;
    try {
      await deleteRating(deleteRatingId);
      toast.success('Rating deleted');
      setDeleteRatingId(null);
    } catch (error) {
      logger.error('Failed to delete rating', error, {
        component: 'VendorRatingSystem',
      });
      toast.error('Failed to delete rating');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex h-40 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (isError) {
    return (
      <Card>
        <CardContent className="p-6">
          <EnhancedEmptyState
            icon={Star}
            title="Failed to load ratings"
            description="There was an error loading vendor ratings. Please try again."
            primaryAction={{
              label: 'Retry',
              onClick: () => window.location.reload(),
            }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Star className="h-5 w-5" />
              Vendor Ratings
            </CardTitle>
            <CardDescription>
              Internal ratings for {vendorName}
            </CardDescription>
          </div>
          <Button onClick={handleAddRating} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Rating
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Aggregate Score Section */}
          <AggregateScoreCard aggregate={aggregate} isLoading={isLoading} />

          {/* Ratings History */}
          {ratings.length === 0 ? (
            <EnhancedEmptyState
              icon={Star}
              title="No ratings yet"
              description="Add a rating to track this vendor's performance over time."
              primaryAction={{
                label: 'Add Rating',
                onClick: handleAddRating,
              }}
            />
          ) : (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Rating History ({ratings.length})
              </h4>
              {ratings.map((rating) => (
                <RatingHistoryItem
                  key={rating.id}
                  rating={rating}
                  onEdit={handleEditRating}
                  onDelete={setDeleteRatingId}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Rating Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRating ? 'Edit Rating' : 'Add Vendor Rating'}
            </DialogTitle>
            <DialogDescription>
              {editingRating
                ? 'Update the rating for this vendor.'
                : 'Rate this vendor on 5 key dimensions.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              {/* Link to PO (optional) */}
              <FormField
                control={form.control}
                name="purchase_order_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link to Purchase Order (Optional)</FormLabel>
                    <Select onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)} value={field.value || '__none__'}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a PO..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">No PO linked</SelectItem>
                        {vendorOrders?.map((po) => (
                          <SelectItem key={po.id} value={po.id}>
                            PO #{po.po_number ?? po.id.slice(0, 8)} -{' '}
                            {format(new Date(po.created_at), 'MMM d, yyyy')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Associate this rating with a specific purchase order.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Rating Sliders */}
              <div className="space-y-4">
                {RATING_DIMENSIONS.map((dimension) => (
                  <FormField
                    key={dimension.key}
                    control={form.control}
                    name={`${dimension.key}_rating` as keyof RatingFormValues}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <RatingSlider
                            value={field.value as number}
                            onChange={field.onChange}
                            dimension={dimension}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add notes about this rating..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isCreating || isUpdating}>
                  {(isCreating || isUpdating) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingRating ? 'Save Changes' : 'Add Rating'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteRatingId}
        onOpenChange={() => setDeleteRatingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rating</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this rating? This action cannot be undone
              and will affect the vendor's aggregate score.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ============================================================================
// Vendor Rating Badge Component (for use in vendor cards/lists)
// ============================================================================

export function VendorRatingBadge({
  vendorId,
  showCount = false,
}: {
  vendorId: string;
  showCount?: boolean;
}) {
  const { aggregate, isLoading } = useVendorRatings(vendorId);

  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }

  if (!aggregate) {
    return (
      <span className="text-xs text-muted-foreground">No ratings</span>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <StarRating rating={Math.round(aggregate.avg_overall)} size="sm" />
      <span className={`text-sm font-medium ${getRatingColor(aggregate.avg_overall)}`}>
        {aggregate.avg_overall.toFixed(1)}
      </span>
      {showCount && (
        <span className="text-xs text-muted-foreground">
          ({aggregate.total_ratings})
        </span>
      )}
    </div>
  );
}
