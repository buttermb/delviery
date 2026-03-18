import { z } from '../_shared/deps.ts';

const emailPayloadSchema = z.object({
  campaign_id: z.string().uuid().optional(),
  tenant_id: z.string().uuid(),
  recipient_email: z.string().email().max(255),
  recipient_name: z.string().max(255).optional(),
  subject: z.string().min(1).max(500),
  html_content: z.string().min(1).max(50000),
  text_content: z.string().max(50000).optional(),
  from_name: z.string().max(255).optional(),
  from_email: z.string().email().max(255).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const smsPayloadSchema = z.object({
  campaign_id: z.string().uuid().optional(),
  tenant_id: z.string().uuid(),
  recipient_phone: z.string().min(10).max(20),
  message: z.string().min(1).max(1600),
  metadata: z.record(z.unknown()).optional(),
});

const scheduleCampaignPayloadSchema = z.object({
  campaign_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  scheduled_at: z.string().datetime(),
});

const trackEventPayloadSchema = z.object({
  campaign_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  event_type: z.enum(['open', 'click', 'bounce', 'unsubscribe']),
  recipient_email: z.string().email().max(255).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const marketingAutomationSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('send_email'), payload: emailPayloadSchema }),
  z.object({ action: z.literal('send_sms'), payload: smsPayloadSchema }),
  z.object({ action: z.literal('schedule_campaign'), payload: scheduleCampaignPayloadSchema }),
  z.object({ action: z.literal('track_event'), payload: trackEventPayloadSchema }),
]);

export type MarketingAutomationInput = z.infer<typeof marketingAutomationSchema>;
export type EmailPayload = z.infer<typeof emailPayloadSchema>;
export type SmsPayload = z.infer<typeof smsPayloadSchema>;
export type ScheduleCampaignPayload = z.infer<typeof scheduleCampaignPayloadSchema>;
export type TrackEventPayload = z.infer<typeof trackEventPayloadSchema>;

export function validateMarketingAutomation(body: unknown): MarketingAutomationInput {
  return marketingAutomationSchema.parse(body);
}
