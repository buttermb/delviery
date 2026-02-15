/**
 * Vendor Rating Hook
 *
 * Internal vendor rating system for admin staff.
 * Features:
 * - Rate vendors on 5 dimensions (price, quality, reliability, communication, compliance)
 * - Aggregate score calculation
 * - Ratings linked to specific POs
 * - History of ratings over time
 * - Only visible to admin staff
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export type RatingDimension =
  | 'price'
  | 'quality'
  | 'reliability'
  | 'communication'
  | 'compliance';

export interface VendorRating {
  id: string;
  tenant_id: string;
  vendor_id: string;
  purchase_order_id: string | null;
  price_rating: number;
  quality_rating: number;
  reliability_rating: number;
  communication_rating: number;
  compliance_rating: number;
  overall_score: number;
  notes: string | null;
  rated_by: string | null;
  rated_at: string;
  created_at: string;
  updated_at: string;
}

export interface VendorRatingAggregate {
  vendor_id: string;
  total_ratings: number;
  avg_price: number;
  avg_quality: number;
  avg_reliability: number;
  avg_communication: number;
  avg_compliance: number;
  avg_overall: number;
}

export interface CreateVendorRatingInput {
  vendor_id: string;
  purchase_order_id?: string;
  price_rating: number;
  quality_rating: number;
  reliability_rating: number;
  communication_rating: number;
  compliance_rating: number;
  notes?: string;
}

export interface UpdateVendorRatingInput {
  id: string;
  price_rating?: number;
  quality_rating?: number;
  reliability_rating?: number;
  communication_rating?: number;
  compliance_rating?: number;
  notes?: string | null;
}

// ============================================================================
// Constants
// ============================================================================

export const RATING_DIMENSIONS: {
  key: RatingDimension;
  label: string;
  description: string;
}[] = [
  {
    key: 'price',
    label: 'Price',
    description: 'Competitiveness of pricing and value for money',
  },
  {
    key: 'quality',
    label: 'Quality',
    description: 'Product quality and consistency',
  },
  {
    key: 'reliability',
    label: 'Reliability',
    description: 'On-time delivery and order accuracy',
  },
  {
    key: 'communication',
    label: 'Communication',
    description: 'Responsiveness and clarity of communication',
  },
  {
    key: 'compliance',
    label: 'Compliance',
    description: 'Regulatory compliance and documentation',
  },
];

export const MIN_RATING = 1;
export const MAX_RATING = 5;

// ============================================================================
// Helper Functions
// ============================================================================

export function calculateOverallScore(ratings: {
  price_rating: number;
  quality_rating: number;
  reliability_rating: number;
  communication_rating: number;
  compliance_rating: number;
}): number {
  const total =
    ratings.price_rating +
    ratings.quality_rating +
    ratings.reliability_rating +
    ratings.communication_rating +
    ratings.compliance_rating;
  return Math.round((total / 5) * 10) / 10; // Round to 1 decimal
}

export function getRatingLabel(score: number): string {
  if (score >= 4.5) return 'Excellent';
  if (score >= 4) return 'Very Good';
  if (score >= 3) return 'Good';
  if (score >= 2) return 'Fair';
  return 'Poor';
}

export function getRatingColor(score: number): string {
  if (score >= 4.5) return 'text-green-600';
  if (score >= 4) return 'text-green-500';
  if (score >= 3) return 'text-yellow-500';
  if (score >= 2) return 'text-orange-500';
  return 'text-red-500';
}

// ============================================================================
// Hook: useVendorRatings
// ============================================================================

export function useVendorRatings(vendorId: string) {
  const { tenant, admin: user } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  // Fetch all ratings for a vendor
  const ratingsQuery = useQuery({
    queryKey: queryKeys.vendors.ratings(tenantId || '', vendorId),
    queryFn: async (): Promise<VendorRating[]> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const { data, error } = await (supabase as any)
        .from('vendor_ratings')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('vendor_id', vendorId)
        .order('rated_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch vendor ratings', error, {
          component: 'useVendorRatings',
          tenantId,
          vendorId,
        });
        throw error;
      }

      return (data ?? []) as VendorRating[];
    },
    enabled: !!tenantId && !!vendorId,
  });

  // Fetch aggregate rating for a vendor
  const aggregateQuery = useQuery({
    queryKey: queryKeys.vendors.ratingAggregate(tenantId || '', vendorId),
    queryFn: async (): Promise<VendorRatingAggregate | null> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const { data, error } = await (supabase as any)
        .from('vendor_ratings')
        .select('price_rating, quality_rating, reliability_rating, communication_rating, compliance_rating, overall_score')
        .eq('tenant_id', tenantId)
        .eq('vendor_id', vendorId);

      if (error) {
        logger.error('Failed to fetch vendor rating aggregate', error, {
          component: 'useVendorRatings',
          tenantId,
          vendorId,
        });
        throw error;
      }

      if (!data || data.length === 0) {
        return null;
      }

      // Calculate averages
      const total = data.length;
      const sums = data.reduce(
        (acc, r) => ({
          price: acc.price + r.price_rating,
          quality: acc.quality + r.quality_rating,
          reliability: acc.reliability + r.reliability_rating,
          communication: acc.communication + r.communication_rating,
          compliance: acc.compliance + r.compliance_rating,
          overall: acc.overall + r.overall_score,
        }),
        { price: 0, quality: 0, reliability: 0, communication: 0, compliance: 0, overall: 0 }
      );

      return {
        vendor_id: vendorId,
        total_ratings: total,
        avg_price: Math.round((sums.price / total) * 10) / 10,
        avg_quality: Math.round((sums.quality / total) * 10) / 10,
        avg_reliability: Math.round((sums.reliability / total) * 10) / 10,
        avg_communication: Math.round((sums.communication / total) * 10) / 10,
        avg_compliance: Math.round((sums.compliance / total) * 10) / 10,
        avg_overall: Math.round((sums.overall / total) * 10) / 10,
      };
    },
    enabled: !!tenantId && !!vendorId,
  });

  // Create rating mutation
  const createRatingMutation = useMutation({
    mutationFn: async (input: CreateVendorRatingInput): Promise<VendorRating> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const overallScore = calculateOverallScore({
        price_rating: input.price_rating,
        quality_rating: input.quality_rating,
        reliability_rating: input.reliability_rating,
        communication_rating: input.communication_rating,
        compliance_rating: input.compliance_rating,
      });

      const { data, error } = await (supabase as any)
        .from('vendor_ratings')
        .insert({
          tenant_id: tenantId,
          vendor_id: input.vendor_id,
          purchase_order_id: input.purchase_order_id ?? null,
          price_rating: input.price_rating,
          quality_rating: input.quality_rating,
          reliability_rating: input.reliability_rating,
          communication_rating: input.communication_rating,
          compliance_rating: input.compliance_rating,
          overall_score: overallScore,
          notes: input.notes ?? null,
          rated_by: user?.id ?? null,
          rated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to create vendor rating', error, {
          component: 'useVendorRatings',
          tenantId,
          vendorId: input.vendor_id,
        });
        throw error;
      }

      return data as VendorRating;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.vendors.ratings(tenantId || '', vendorId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.vendors.ratingAggregate(tenantId || '', vendorId),
      });
    },
  });

  // Update rating mutation
  const updateRatingMutation = useMutation({
    mutationFn: async (input: UpdateVendorRatingInput): Promise<VendorRating> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      // Fetch current data for recalculating overall score
      const { data: currentData } = await (supabase as any)
        .from('vendor_ratings')
        .select('*')
        .eq('id', input.id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (!currentData) {
        throw new Error('Rating not found');
      }

      const updatedRatings = {
        price_rating: input.price_rating ?? currentData.price_rating,
        quality_rating: input.quality_rating ?? currentData.quality_rating,
        reliability_rating: input.reliability_rating ?? currentData.reliability_rating,
        communication_rating: input.communication_rating ?? currentData.communication_rating,
        compliance_rating: input.compliance_rating ?? currentData.compliance_rating,
      };

      const overallScore = calculateOverallScore(updatedRatings);

      const { data, error } = await (supabase as any)
        .from('vendor_ratings')
        .update({
          ...updatedRatings,
          overall_score: overallScore,
          notes: input.notes !== undefined ? input.notes : (currentData as any).notes,
        })
        .eq('id', input.id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update vendor rating', error, {
          component: 'useVendorRatings',
          tenantId,
          ratingId: input.id,
        });
        throw error;
      }

      return data as VendorRating;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.vendors.ratings(tenantId || '', vendorId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.vendors.ratingAggregate(tenantId || '', vendorId),
      });
    },
  });

  // Delete rating mutation
  const deleteRatingMutation = useMutation({
    mutationFn: async (ratingId: string): Promise<void> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const { error } = await (supabase as any)
        .from('vendor_ratings')
        .delete()
        .eq('id', ratingId)
        .eq('tenant_id', tenantId);

      if (error) {
        logger.error('Failed to delete vendor rating', error, {
          component: 'useVendorRatings',
          tenantId,
          ratingId,
        });
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.vendors.ratings(tenantId || '', vendorId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.vendors.ratingAggregate(tenantId || '', vendorId),
      });
    },
  });

  return {
    // Query data
    ratings: ratingsQuery.data ?? [],
    aggregate: aggregateQuery.data,
    isLoading: ratingsQuery.isLoading || aggregateQuery.isLoading,
    isError: ratingsQuery.isError || aggregateQuery.isError,
    error: ratingsQuery.error || aggregateQuery.error,

    // Mutations
    createRating: createRatingMutation.mutateAsync,
    updateRating: updateRatingMutation.mutateAsync,
    deleteRating: deleteRatingMutation.mutateAsync,

    // Mutation states
    isCreating: createRatingMutation.isPending,
    isUpdating: updateRatingMutation.isPending,
    isDeleting: deleteRatingMutation.isPending,
  };
}

// ============================================================================
// Hook: useVendorRatingHistory
// ============================================================================

export function useVendorRatingHistory(vendorId: string, limit = 10) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  return useQuery({
    queryKey: queryKeys.vendors.ratingHistory(tenantId || '', vendorId),
    queryFn: async (): Promise<VendorRating[]> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const { data, error } = await (supabase as any)
        .from('vendor_ratings')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('vendor_id', vendorId)
        .order('rated_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Failed to fetch vendor rating history', error, {
          component: 'useVendorRatingHistory',
          tenantId,
          vendorId,
        });
        throw error;
      }

      return (data ?? []) as VendorRating[];
    },
    enabled: !!tenantId && !!vendorId,
  });
}
