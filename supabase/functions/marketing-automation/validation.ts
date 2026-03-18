import { z } from '../_shared/deps.ts';

const campaignPayloadSchema = z.object({
  campaign_id: z.string().uuid('Invalid campaign ID'),
});

const schedulePayloadSchema = z.object({
  campaign_id: z.string().uuid('Invalid campaign ID'),
  scheduled_at: z.string().datetime('Invalid datetime format'),
});

const trackEventPayloadSchema = z.object({
  campaign_id: z.string().uuid('Invalid campaign ID'),
  event_type: z.enum(['open', 'click', 'bounce', 'unsubscribe']),
  recipient_id: z.string().uuid('Invalid recipient ID').optional(),
  metadata: z.record(z.unknown()).optional(),
});

const pauseResumePayloadSchema = z.object({
  campaign_id: z.string().uuid('Invalid campaign ID'),
});

export const marketingAutomationSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('send_campaign'),
    payload: campaignPayloadSchema,
  }),
  z.object({
    action: z.literal('schedule_campaign'),
    payload: schedulePayloadSchema,
  }),
  z.object({
    action: z.literal('pause_campaign'),
    payload: pauseResumePayloadSchema,
  }),
  z.object({
    action: z.literal('resume_campaign'),
    payload: pauseResumePayloadSchema,
  }),
  z.object({
    action: z.literal('track_event'),
    payload: trackEventPayloadSchema,
  }),
]);

export type MarketingAutomationInput = z.infer<typeof marketingAutomationSchema>;

export function validateMarketingAutomation(body: unknown): MarketingAutomationInput {
  return marketingAutomationSchema.parse(body);
}
