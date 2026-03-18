import { z } from '../_shared/deps.ts';

const smsPayloadSchema = z.object({
  campaign_id: z.string().uuid().optional(),
  recipient_phone: z.string().min(1, 'recipient_phone is required for SMS').max(20),
  message: z.string().min(1, 'message is required for SMS').max(1600),
  metadata: z.record(z.unknown()).optional(),
  // Fields not used for SMS but allowed for compatibility
  recipient_email: z.string().email().max(255).optional(),
  subject: z.string().max(500).optional(),
  scheduled_at: z.string().datetime().optional(),
});

const emailPayloadSchema = z.object({
  campaign_id: z.string().uuid().optional(),
  recipient_email: z.string().email().max(255).optional(),
  subject: z.string().max(500).optional(),
  message: z.string().max(5000).optional(),
  recipient_phone: z.string().max(20).optional(),
  scheduled_at: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const genericPayloadSchema = z.object({
  campaign_id: z.string().uuid().optional(),
  recipient_email: z.string().email().max(255).optional(),
  recipient_phone: z.string().max(20).optional(),
  subject: z.string().max(500).optional(),
  message: z.string().max(5000).optional(),
  scheduled_at: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const marketingAutomationSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('send_sms'), payload: smsPayloadSchema }),
  z.object({ action: z.literal('send_email'), payload: emailPayloadSchema }),
  z.object({ action: z.literal('schedule_campaign'), payload: genericPayloadSchema }),
  z.object({ action: z.literal('track_event'), payload: genericPayloadSchema }),
]);

export type MarketingAutomationInput = z.infer<typeof marketingAutomationSchema>;

export function validateMarketingAutomation(body: unknown): MarketingAutomationInput {
  return marketingAutomationSchema.parse(body);
}
