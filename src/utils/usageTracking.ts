/**
 * Usage Tracking Utilities
 * Automatic usage tracking for billing
 */

import { supabase } from '@/integrations/supabase/client';
import { trackUsage } from '@/lib/tenant';

/**
 * Track usage event
 */
export async function trackUsageEvent(
  tenantId: string,
  eventType: 'sms_sent' | 'email_sent' | 'label_printed' | 'api_call' | string,
  quantity: number = 1,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await supabase.from('usage_events').insert({
      tenant_id: tenantId,
      event_type: eventType,
      quantity,
      metadata: metadata || {},
    });
  } catch (error) {
    console.error('Failed to track usage:', error);
  }
}

/**
 * Track SMS sent
 */
export async function trackSMSSent(
  tenantId: string,
  messageCount: number = 1
): Promise<void> {
  await trackUsageEvent(tenantId, 'sms_sent', messageCount);
}

/**
 * Track email sent
 */
export async function trackEmailSent(
  tenantId: string,
  emailCount: number = 1
): Promise<void> {
  await trackUsageEvent(tenantId, 'email_sent', emailCount);
}

/**
 * Track label printed
 */
export async function trackLabelPrinted(
  tenantId: string,
  labelCount: number = 1
): Promise<void> {
  await trackUsageEvent(tenantId, 'label_printed', labelCount);
}

/**
 * Track API call
 */
export async function trackAPICall(
  tenantId: string,
  endpoint?: string
): Promise<void> {
  await trackUsageEvent(tenantId, 'api_call', 1, { endpoint });
}

/**
 * Update tenant resource usage count
 */
export async function updateResourceUsage(
  tenantId: string,
  resource: 'customers' | 'menus' | 'products' | 'locations' | 'users',
  delta: number
): Promise<void> {
  try {
    // Get current usage
    const { data: tenant } = await supabase
      .from('tenants')
      .select('usage')
      .eq('id', tenantId)
      .single();

    if (!tenant) return;

    const currentUsage = tenant.usage || {};
    const newCount = Math.max(0, (currentUsage[resource] || 0) + delta);

    // Update usage
    await supabase
      .from('tenants')
      .update({
        usage: {
          ...currentUsage,
          [resource]: newCount,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId);
  } catch (error) {
    console.error('Failed to update resource usage:', error);
  }
}

