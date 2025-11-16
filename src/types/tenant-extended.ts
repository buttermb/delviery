/**
 * Extended Tenant Type
 * Adds missing properties for tenant management
 */

import { Database } from '@/integrations/supabase/types';

export type Tenant = Database['public']['Tables']['tenants']['Row'] & {
  limits?: any;
  usage?: any;
  mrr?: number;
  trial_ends_at?: string | null;
  next_billing_date?: string | null;
  payment_method_added?: boolean;
  phone?: string;
};
