/**
 * PHI Access Logging Hook
 * 
 * React hook for logging PHI access with HIPAA compliance
 */

import { logger } from '@/lib/logger';
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function usePHIAccessLogger() {
  const logAccess = useCallback(async (
    customerId: string,
    action: 'view' | 'create' | 'update' | 'decrypt' | 'search',
    fieldsAccessed: string[],
    purpose?: string
  ) => {
    try {
      const { error } = await supabase.rpc('log_phi_access', {
        p_customer_id: customerId,
        p_action: action,
        p_fields_accessed: fieldsAccessed,
        p_purpose: purpose
      });

      if (error) throw error;
    } catch (error) {
      logger.error('Failed to log PHI access', error as Error, { 
        component: 'phiAccessLogger',
        customerId,
        action 
      });
      // Don't block the operation if logging fails
    }
  }, []);

  return { logAccess };
}
