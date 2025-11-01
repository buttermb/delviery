/**
 * Automated Tenant Limit Enforcement
 * Runs daily to check usage limits, trials, payments, and health scores
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface Tenant {
  id: string;
  business_name: string;
  subscription_status: string;
  subscription_plan: string;
  trial_ends_at?: string;
  usage: Record<string, number>;
  limits: Record<string, number>;
  owner_email: string;
  last_activity_at?: string;
  mrr?: number;
}

serve(async (req) => {
  try {
    console.log('Starting automated tenant limit enforcement...');

    // 1. CHECK USAGE LIMITS
    console.log('Checking usage limits...');
    await checkUsageLimits();

    // 2. CHECK TRIAL EXPIRATIONS
    console.log('Checking trial expirations...');
    await checkTrialExpirations();

    // 3. CHECK PAYMENT FAILURES
    console.log('Checking payment failures...');
    await checkPaymentFailures();

    // 4. CHECK HEALTH SCORES
    console.log('Checking health scores...');
    await checkHealthScores();

    // 5. CHECK COMPLIANCE
    console.log('Checking compliance...');
    await checkCompliance();

    return new Response(
      JSON.stringify({ success: true, message: 'Enforcement completed' }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Enforcement error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

/**
 * Check usage limits and send warnings/disable features
 */
async function checkUsageLimits() {
  const { data: tenants } = await supabase
    .from('tenants')
    .select('*')
    .eq('subscription_status', 'active');

  if (!tenants) return;

  for (const tenant of tenants) {
    const usage = tenant.usage || {};
    const limits = tenant.limits || {};

    // Check each resource
    for (const [resource, limit] of Object.entries(limits)) {
      if (limit === -1) continue; // Unlimited
      
      // Ensure limit is a number
      const limitValue = typeof limit === 'number' ? limit : Number(limit);
      if (isNaN(limitValue) || limitValue <= 0) continue;

      const current = usage[resource] || 0;
      const percentage = (current / limitValue) * 100;

      // 80% threshold - send warning
      if (percentage >= 80 && percentage < 100) {
        await logEnforcementEvent(tenant.id, 'usage_warning', {
          resource,
          current,
          limit: limitValue,
          percentage,
        });
        // In production, send email notification
      }

      // 100%+ threshold - disable feature
      if (percentage >= 100) {
        await logEnforcementEvent(tenant.id, 'usage_limit_exceeded', {
          resource,
          current,
          limit,
        });
        // In production, disable feature or send upgrade prompt
      }
    }
  }
}

/**
 * Check trial expirations
 */
async function checkTrialExpirations() {
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  // Find trials expiring in 3 days
  const { data: expiringTrials } = await supabase
    .from('tenants')
    .select('*')
    .in('subscription_status', ['trial', 'trialing'])
    .lte('trial_ends_at', threeDaysFromNow.toISOString())
    .gt('trial_ends_at', now.toISOString());

  if (expiringTrials) {
    for (const tenant of expiringTrials) {
      await logEnforcementEvent(tenant.id, 'trial_expiring_soon', {
        days_remaining: Math.ceil(
          (new Date(tenant.trial_ends_at || 0).getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24)
        ),
      });
      // In production, send "Add payment method" email
    }
  }

  // Find expired trials
  const { data: expiredTrials } = await supabase
    .from('tenants')
    .select('*')
    .in('subscription_status', ['trial', 'trialing'])
    .lte('trial_ends_at', now.toISOString());

  if (expiredTrials) {
    for (const tenant of expiredTrials) {
      // Check if payment method exists
      const hasPaymentMethod = tenant.payment_method_added || false;

      if (!hasPaymentMethod) {
        // Suspend account
        await supabase
          .from('tenants')
          .update({
            subscription_status: 'suspended',
            suspended_reason: 'Trial expired without payment method',
            updated_at: new Date().toISOString(),
          })
          .eq('id', tenant.id);

        await logEnforcementEvent(tenant.id, 'trial_expired_suspended', {});
      } else {
        // Transition to active
        await supabase
          .from('tenants')
          .update({
            subscription_status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', tenant.id);

        await logEnforcementEvent(tenant.id, 'trial_converted', {});
      }
    }
  }
}

/**
 * Check payment failures
 */
async function checkPaymentFailures() {
  const { data: pastDueTenants } = await supabase
    .from('tenants')
    .select('*')
    .eq('subscription_status', 'past_due');

  if (!pastDueTenants) return;

  for (const tenant of pastDueTenants) {
    // Get recent payment failure events
    const { data: failures } = await supabase
      .from('subscription_events')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('event_type', 'payment_failed')
      .order('created_at', { ascending: false })
      .limit(3);

    if (failures && failures.length >= 3) {
      // After 3 failures, suspend
      await supabase
        .from('tenants')
        .update({
          subscription_status: 'suspended',
          suspended_reason: 'Multiple payment failures',
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenant.id);

      await logEnforcementEvent(tenant.id, 'account_suspended_payment', {
        failure_count: failures.length,
      });
    } else {
      // Send reminder email
      await logEnforcementEvent(tenant.id, 'payment_reminder_sent', {
        failure_count: failures?.length || 0,
      });
    }
  }
}

/**
 * Check health scores and flag at-risk tenants
 */
async function checkHealthScores() {
  const { data: tenants } = await supabase.from('tenants').select('*');

  if (!tenants) return;

  for (const tenant of tenants) {
    const healthScore = calculateHealthScore(tenant);

    if (healthScore < 50) {
      // Flag as at-risk
      await logEnforcementEvent(tenant.id, 'tenant_at_risk', {
        health_score: healthScore,
        reasons: [],
      });
      // In production, assign to customer success manager
    }
  }
}

/**
 * Check compliance (licenses, etc.)
 */
async function checkCompliance() {
  const { data: tenants } = await supabase
    .from('tenants')
    .select('*')
    .eq('compliance_verified', true);

  if (!tenants) return;

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  for (const tenant of tenants) {
    const licenses = tenant.state_licenses || [];

    for (const license of licenses) {
      const expiresAt = new Date(license.expires);
      
      // Expiring in 30 days
      if (expiresAt <= thirtyDaysFromNow && expiresAt > now) {
        await logEnforcementEvent(tenant.id, 'license_expiring', {
          state: license.state,
          expires_at: license.expires,
        });
        // In production, send renewal reminder
      }

      // Expired
      if (expiresAt <= now) {
        await supabase
          .from('tenants')
          .update({
            compliance_verified: false,
            subscription_status: 'suspended',
            suspended_reason: `License expired: ${license.state}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', tenant.id);

        await logEnforcementEvent(tenant.id, 'license_expired_suspended', {
          state: license.state,
        });
      }
    }
  }
}

/**
 * Calculate health score for tenant
 */
function calculateHealthScore(tenant: any): number {
  let score = 100;

  // Check activity
  if (tenant.last_activity_at) {
    const daysSinceActivity = Math.floor(
      (Date.now() - new Date(tenant.last_activity_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceActivity > 7) score -= 20;
    if (daysSinceActivity > 30) score -= 30;
  }

  // Check subscription status
  if (tenant.subscription_status === 'past_due') score -= 40;
  if (tenant.subscription_status === 'cancelled') score -= 50;
  if (tenant.subscription_status === 'suspended') score -= 60;

  // Check usage
  const usageRate = (tenant.usage?.customers || 0) / (tenant.limits?.customers || 1);
  if (usageRate < 0.2 && tenant.usage?.customers > 0) score -= 15;

  // Check onboarding
  if (!tenant.onboarded) score -= 10;

  // Check engagement
  if (tenant.usage?.menus === 0 && tenant.onboarded) score -= 20;

  return Math.max(0, Math.min(100, score));
}

/**
 * Log enforcement event
 */
async function logEnforcementEvent(
  tenantId: string,
  eventType: string,
  metadata: Record<string, any>
) {
  await supabase.from('subscription_events').insert({
    tenant_id: tenantId,
    event_type: eventType,
    metadata,
  });
}

