import { z } from '../_shared/deps.ts';

export const marketingAutomationSchema = z.object({
  action: z.enum(['send_email', 'send_sms', 'schedule_campaign', 'track_event']),
  payload: z.object({
    campaign_id: z.string().uuid().optional(),
    recipient_email: z.string().email().max(255).optional(),
    recipient_phone: z.string().max(20).optional(),
    subject: z.string().max(500).optional(),
    message: z.string().max(5000).optional(),
    scheduled_at: z.string().datetime().optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
});

export type MarketingAutomationInput = z.infer<typeof marketingAutomationSchema>;

export function validateMarketingAutomation(body: unknown): MarketingAutomationInput {
  return marketingAutomationSchema.parse(body);
}
