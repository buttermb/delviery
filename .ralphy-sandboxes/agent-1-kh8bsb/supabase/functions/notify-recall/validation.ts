import { z } from '../_shared/deps.ts';

export const notifyRecallSchema = z.object({
  recall_id: z.string().uuid('Invalid recall ID format'),
  notification_method: z.enum(['email', 'sms', 'both']).optional().default('email'),
});

export type NotifyRecallInput = z.infer<typeof notifyRecallSchema>;

export function validateNotifyRecall(body: unknown): NotifyRecallInput {
  return notifyRecallSchema.parse(body);
}
