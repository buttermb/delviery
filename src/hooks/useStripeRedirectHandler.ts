import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { safeStorage } from '@/utils/safeStorage';

/**
 * Hook to handle Stripe checkout redirect after payment method collection
 * Detects ?success=true&trial=true in URL and updates trial status
 */
export function useStripeRedirectHandler() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { admin, tenant } = useTenantAdminAuth();

  useEffect(() => {
    const success = searchParams.get('success') === 'true';
    const trial = searchParams.get('trial') === 'true';
    const tenantId = searchParams.get('tenant_id');

    if (!success || !trial) return;

    logger.info('[StripeRedirect] Processing Stripe success callback', {
      success,
      trial,
      tenantId,
      hasAdmin: !!admin,
      hasTenant: !!tenant,
    });

    const handleStripeSuccess = async () => {
      try {
        // Get tenant slug from database if we only have tenant ID
        let tenantSlug = tenant?.slug || safeStorage.getItem('lastTenantSlug');
        
        if (!tenantSlug && tenantId) {
          logger.info('[StripeRedirect] Fetching tenant slug from database');
          const { data: tenantData } = await supabase
            .from('tenants')
            .select('slug')
            .eq('id', tenantId)
            .single();
          
          if (tenantData) {
            tenantSlug = tenantData.slug;
            safeStorage.setItem('lastTenantSlug', tenantSlug);
          }
        }

        // Check if user session is valid
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          logger.warn('[StripeRedirect] No active session, redirecting to login');
          
          toast.error('Session expired. Please log in again.');
          
          // Redirect to login with tenant slug
          if (tenantSlug) {
            navigate(`/${tenantSlug}/admin/login`);
          } else {
            navigate('/saas/login');
          }
          return;
        }

        // Update payment method status via edge function
        const { data, error } = await supabase.functions.invoke('update-trial-status', {
          body: {
            tenant_id: tenantId || tenant?.id,
            payment_method_added: true,
          },
        });

        if (error) throw error;

        logger.info('[StripeRedirect] Trial status updated successfully');

        toast.success('Payment method added successfully!', {
          description: 'Your 14-day trial has started.',
        });

        // Clean up URL params and redirect to admin
        if (tenantSlug) {
          navigate(`/${tenantSlug}/admin`, { replace: true });
        } else {
          logger.error('[StripeRedirect] No tenant slug available for redirect');
          navigate('/saas/login', { replace: true });
        }
      } catch (error) {
        logger.error('[StripeRedirect] Failed to update trial status', error);
        toast.error('Failed to complete setup', {
          description: 'Please contact support if this issue persists.',
        });
        
        // Try to get tenant slug from storage as fallback
        const fallbackSlug = safeStorage.getItem('lastTenantSlug');
        if (fallbackSlug) {
          navigate(`/${fallbackSlug}/admin`, { replace: true });
        } else {
          navigate('/saas/login', { replace: true });
        }
      }
    };

    handleStripeSuccess();
  }, [searchParams, navigate, admin, tenant]);
}
