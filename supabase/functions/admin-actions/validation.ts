import { z } from '../_shared/deps.ts';

// Admin action schema
export const adminActionSchema = z.object({
  action: z.enum([
    'cancel-order',
    'refund-order',
    'ban-user',
    'unban-user',
    'delete-user',
    'verify-user',
    'reset-password',
    'update-user-metadata',
  ]),
  orderId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  reason: z.string().max(1000).optional(),
  details: z.record(z.unknown()).optional(),
  refundAmount: z.number().positive().max(1000000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type AdminActionInput = z.infer<typeof adminActionSchema>;

export function validateAdminAction(body: unknown): AdminActionInput {
  return adminActionSchema.parse(body);
}
