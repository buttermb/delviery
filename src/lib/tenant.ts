/**
 * Tenant Context & Utilities
 * Multi-tenant isolation and management
 */

import { supabase } from '@/integrations/supabase/client';

export interface Tenant {
  id: string;
  business_name: string;
  slug: string;
  owner_email: string;
  owner_name?: string;
  phone?: string;
  subscription_plan: 'starter' | 'professional' | 'enterprise';
  subscription_status: 'trial' | 'active' | 'past_due' | 'cancelled' | 'suspended';
  trial_ends_at?: string;
  subscription_started_at?: string;
  subscription_current_period_start?: string;
  subscription_current_period_end?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  payment_method_added: boolean;
  next_billing_date?: string;
  mrr?: number;
  limits: {
    customers: number;
    menus: number;
    products: number;
    locations: number;
    users: number;
  };
  usage: {
    customers: number;
    menus: number;
    products: number;
    locations: number;
    users: number;
  };
  features: {
    api_access: boolean;
    custom_branding: boolean;
    white_label: boolean;
    advanced_analytics: boolean;
    sms_enabled: boolean;
  };
  white_label: {
    enabled: boolean;
    domain?: string;
    logo?: string;
    theme?: Record<string, any>;
  };
  status: 'active' | 'suspended' | 'cancelled';
  suspended_reason?: string;
  cancelled_at?: string;
  state_licenses?: Array<{
    state: string;
    license: string;
    expires: string;
  }>;
  compliance_verified: boolean;
  onboarded: boolean;
  onboarded_at?: string;
  last_activity_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TenantUser {
  id: string;
  tenant_id: string;
  email: string;
  name?: string;
  role: 'owner' | 'admin' | 'manager' | 'runner' | 'viewer';
  permissions?: Record<string, any>;
  status: 'pending' | 'active' | 'suspended';
  email_verified: boolean;
  invited_by?: string;
  invited_at?: string;
  accepted_at?: string;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Get tenant from slug or domain
 */
export async function getTenantFromSlug(slug: string): Promise<Tenant | null> {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !data) return null;
  return data as Tenant;
}

/**
 * Get tenant by ID
 */
export async function getTenantById(tenantId: string): Promise<Tenant | null> {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();

  if (error || !data) return null;
  return data as Tenant;
}

/**
 * Set tenant context for RLS
 */
export async function setTenantContext(tenantId: string): Promise<void> {
  const { error } = await supabase.rpc('set_config', {
    setting_name: 'app.current_tenant_id',
    setting_value: tenantId,
  });

  if (error) {
    console.error('Failed to set tenant context:', error);
  }
}

/**
 * Check if tenant has reached a limit
 */
export function checkLimit(tenant: Tenant, resource: keyof Tenant['limits']): {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
} {
  const current = tenant.usage[resource] || 0;
  const limit = tenant.limits[resource];
  const unlimited = limit === -1;

  return {
    allowed: unlimited || current < limit,
    current,
    limit: unlimited ? Infinity : limit,
    remaining: unlimited ? Infinity : Math.max(0, limit - current),
  };
}

/**
 * Check if tenant has feature enabled
 */
export function hasFeature(tenant: Tenant, feature: keyof Tenant['features']): boolean {
  return tenant.features[feature] === true;
}

/**
 * Check if tenant subscription is active
 */
export function isSubscriptionActive(tenant: Tenant): boolean {
  return (
    tenant.subscription_status === 'active' ||
    (tenant.subscription_status === 'trial' && 
     (!tenant.trial_ends_at || new Date(tenant.trial_ends_at) > new Date()))
  );
}

/**
 * Get plan pricing
 */
export function getPlanPrice(plan: string): number {
  const prices: Record<string, number> = {
    starter: 99,
    professional: 299,
    enterprise: 799,
  };
  return prices[plan] || 0;
}

/**
 * Get plan name display
 */
export function getPlanDisplayName(plan: string): string {
  const names: Record<string, string> = {
    starter: 'Starter',
    professional: 'Professional',
    enterprise: 'Enterprise',
  };
  return names[plan] || plan;
}

/**
 * Check if tenant can use white-label
 */
export function canUseWhiteLabel(tenant: Tenant): boolean {
  return hasFeature(tenant, 'white_label') && tenant.white_label?.enabled;
}

/**
 * Calculate health score for tenant
 */
export function calculateHealthScore(tenant: Tenant): {
  score: number;
  reasons: string[];
} {
  let score = 100;
  const reasons: string[] = [];

  // Check activity
  if (tenant.last_activity_at) {
    const daysSinceActivity = Math.floor(
      (Date.now() - new Date(tenant.last_activity_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceActivity > 7) {
      score -= 20;
      reasons.push('No activity in over 7 days');
    }
    if (daysSinceActivity > 30) {
      score -= 30;
      reasons.push('No activity in over 30 days');
    }
  }

  // Check subscription status
  if (tenant.subscription_status === 'past_due') {
    score -= 40;
    reasons.push('Payment past due');
  }
  if (tenant.subscription_status === 'cancelled') {
    score -= 50;
    reasons.push('Subscription cancelled');
  }
  if (tenant.subscription_status === 'suspended') {
    score -= 60;
    reasons.push('Account suspended');
  }

  // Check usage
  const usageRate = tenant.usage.customers / (tenant.limits.customers || 1);
  if (usageRate < 0.2 && tenant.usage.customers > 0) {
    score -= 15;
    reasons.push('Low usage rate');
  }

  // Check onboarding
  if (!tenant.onboarded) {
    score -= 10;
    reasons.push('Not fully onboarded');
  }

  // Check engagement
  if (tenant.usage.menus === 0 && tenant.onboarded) {
    score -= 20;
    reasons.push('No menus created');
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons,
  };
}

/**
 * Track usage event
 */
export async function trackUsage(
  tenantId: string,
  eventType: string,
  quantity: number = 1,
  metadata?: Record<string, any>
): Promise<void> {
  const { error } = await supabase.from('usage_events').insert({
    tenant_id: tenantId,
    event_type: eventType,
    quantity,
    metadata: metadata || {},
  });

  if (error) {
    console.error('Failed to track usage:', error);
  }
}

