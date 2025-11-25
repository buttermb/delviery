import { logger } from '@/lib/logger';
/**
 * useFeatureTracking Hook
 * 
 * Tracks feature usage for analytics and hot items generation
 */

import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

/**
 * Hook to track feature usage
 */
export function useFeatureTracking() {
  const { tenant, admin } = useTenantAdminAuth();

  const trackFeatureUsage = useMutation({
    mutationFn: async (featureId: string) => {
      if (!tenant?.id || !admin?.userId) {
        logger.warn('Cannot track feature usage: missing tenant or admin', { component: 'useFeatureTracking' });
        return;
      }

      try {
        // Upsert feature usage directly to table
        const { error } = await (supabase as any)
          .from('feature_usage_tracking')
          .upsert({
            tenant_id: tenant.id,
            user_id: admin.userId,
            feature_id: featureId,
            usage_count: 1,
            last_used_at: new Date().toISOString(),
          }, {
            onConflict: 'tenant_id,user_id,feature_id',
            ignoreDuplicates: false,
          });

        if (error) {
          // Log error but don't throw (non-critical)
          logger.warn('Failed to track feature usage', error, {
            component: 'useFeatureTracking',
            featureId,
          });
        }
      } catch (error: unknown) {
        // Log error but don't throw (non-critical)
        logger.warn('Error tracking feature usage', error, {
          component: 'useFeatureTracking',
          featureId,
        });
      }
    },
  });

  /**
   * Track feature click
   */
  const trackFeatureClick = (featureId: string) => {
    trackFeatureUsage.mutate(featureId);

    // Also track in analytics if available
    if (typeof window !== 'undefined' && 'analytics' in window && typeof (window as { analytics?: { track: (event: string, data: Record<string, unknown>) => void } }).analytics?.track === 'function') {
      try {
        (window as { analytics: { track: (event: string, data: Record<string, unknown>) => void } }).analytics.track('Feature Accessed', {
          feature_id: featureId,
          tenant_id: tenant?.id,
          operation_size: (tenant as any)?.detected_operation_size,
        });
      } catch (error: unknown) {
        // Analytics tracking is optional, don't fail if it errors
        logger.warn('Failed to track in analytics', error, { component: 'useFeatureTracking' });
      }
    }
  };

  return {
    trackFeatureClick,
    trackFeatureUsage: trackFeatureUsage.mutate,
    isTracking: trackFeatureUsage.isPending,
  };
}

