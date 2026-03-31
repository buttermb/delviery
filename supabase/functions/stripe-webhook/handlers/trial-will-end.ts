/**
 * Handler for customer.subscription.trial_will_end events.
 *
 * Logs a trial_ending_soon event when a trial is about to expire.
 */
import type { HandlerContext, HandlerResult } from './types.ts';

export async function handleTrialWillEnd(ctx: HandlerContext): Promise<HandlerResult> {
  const { supabase, event } = ctx;
  const object = event.data.object;
  const tenantId = object.metadata?.tenant_id;

  if (tenantId) {
    await supabase.from('trial_events').insert({
      tenant_id: tenantId,
      event_type: 'trial_ending_soon',
      event_data: {
        subscription_id: object.id,
        trial_end: object.trial_end,
      },
    });
  }
}
