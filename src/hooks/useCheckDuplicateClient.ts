import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingClient?: {
    id: string;
    business_name: string;
    email?: string;
    phone?: string;
  };
  duplicateField?: 'email' | 'phone' | 'business_name';
}

/**
 * Hook to check for duplicate wholesale clients before creation
 */
export function useCheckDuplicateClient() {
  const { tenant } = useTenantAdminAuth();

  /**
   * Check if a client with the given email, phone, or business name already exists
   */
  const checkDuplicate = async (
    email?: string,
    phone?: string,
    businessName?: string
  ): Promise<DuplicateCheckResult> => {
    if (!tenant?.id) {
      return { isDuplicate: false };
    }

    // Build OR conditions for duplicate check
    const conditions: string[] = [];
    
    if (email) {
      conditions.push(`email.eq.${email}`);
    }
    if (phone) {
      // Normalize phone number (remove non-digits)
      const normalizedPhone = phone.replace(/\D/g, '');
      conditions.push(`phone.eq.${normalizedPhone}`);
    }

    if (conditions.length === 0) {
      return { isDuplicate: false };
    }

    // Check for existing client with same email or phone
    const { data: existingClients, error } = await supabase
      .from('wholesale_clients')
      .select('id, business_name, email, phone, deleted_at')
      .eq('tenant_id', tenant.id)
      .is('deleted_at', null) // Only check active clients
      .or(conditions.join(','));

    if (error) {
      logger.error('Error checking for duplicate client', error);
      return { isDuplicate: false };
    }

    if (existingClients && existingClients.length > 0) {
      const existing = existingClients[0];
      
      // Determine which field matched
      let duplicateField: 'email' | 'phone' | 'business_name' = 'email';
      if (email && existing.email?.toLowerCase() === email.toLowerCase()) {
        duplicateField = 'email';
      } else if (phone && existing.phone?.replace(/\D/g, '') === phone.replace(/\D/g, '')) {
        duplicateField = 'phone';
      }

      return {
        isDuplicate: true,
        existingClient: {
          id: existing.id,
          business_name: existing.business_name,
          email: existing.email ?? undefined,
          phone: existing.phone ?? undefined
        },
        duplicateField
      };
    }

    // Also check for duplicate business name (soft check - warn but don't block)
    if (businessName) {
      const { data: nameMatch } = await supabase
        .from('wholesale_clients')
        .select('id, business_name')
        .eq('tenant_id', tenant.id)
        .is('deleted_at', null)
        .ilike('business_name', businessName)
        .limit(1);

      if (nameMatch && nameMatch.length > 0) {
        return {
          isDuplicate: true,
          existingClient: {
            id: nameMatch[0].id,
            business_name: nameMatch[0].business_name
          },
          duplicateField: 'business_name'
        };
      }
    }

    return { isDuplicate: false };
  };

  return { checkDuplicate };
}

export default useCheckDuplicateClient;
