import { z } from '../_shared/deps.ts';

export const sendWebhookSchema = z.object({
  webhook_id: z.string().uuid('Invalid webhook ID format'),
  payload: z.record(z.unknown()).optional().default({}),
});

export type SendWebhookInput = z.infer<typeof sendWebhookSchema>;

export function validateSendWebhook(body: unknown): SendWebhookInput {
  return sendWebhookSchema.parse(body);
}
