/**
 * Extended Tenant Type
 * Adds missing properties for tenant management
 */

import { Database } from '@/integrations/supabase/types';

export interface TenantLimits {
  customers: number;
  menus: number;
  products: number;
  locations: number;
  users: number;
}

export interface TenantUsage {
  customers: number;
  menus: number;
  products: number;
  locations: number;
  users: number;
}

export type Tenant = Database['public']['Tables']['tenants']['Row'] & {
  limits?: TenantLimits;
  usage?: TenantUsage;
  mrr?: number;
  trial_ends_at?: string | null;
  next_billing_date?: string | null;
  payment_method_added?: boolean;
  phone?: string;
  detected_operation_size?: string | null;
  last_size_detection_at?: string | null;
  monthly_orders?: number;
  team_size?: number;
};
