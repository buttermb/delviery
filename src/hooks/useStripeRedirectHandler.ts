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
        // Check if user session is valid
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          logger.warn('[StripeRedirect] No active session, redirecting to login');
          
          // Save tenant slug for login redirect
          if (tenantId) {
            safeStorage.setItem('lastTenantSlug', tenantId);
          }
          
          toast.error('Session expired. Please log in again.');
          
          // Redirect to login with tenant slug
          const slug = tenantId || tenant?.slug || safeStorage.getItem('lastTenantSlug');
          if (slug) {
            navigate(`/${slug}/admin/login`);
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

        // Clean up URL params
        const slug = tenant?.slug || safeStorage.getItem('lastTenantSlug');
        if (slug) {
          navigate(`/${slug}/admin`, { replace: true });
        } else {
          navigate('/admin', { replace: true });
        }
      } catch (error) {
        logger.error('[StripeRedirect] Failed to update trial status', error);
        toast.error('Failed to complete setup', {
          description: 'Please contact support if this issue persists.',
        });
        
        // Still redirect to admin, but show error
        const slug = tenant?.slug || safeStorage.getItem('lastTenantSlug');
        if (slug) {
          navigate(`/${slug}/admin`, { replace: true });
        }
      }
    };

    handleStripeSuccess();
  }, [searchParams, navigate, admin, tenant]);
}
