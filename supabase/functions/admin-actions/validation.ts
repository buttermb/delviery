import { z } from '../_shared/deps.ts';

// Admin action schema with comprehensive validation
export const adminActionSchema = z.object({
  action: z.enum([
    'cancel-order',
    'flag-order',
    'unflag-order',
    'accept-order',
    'decline-order',
    'suspend-user',
    'assign-courier',
    'refund-order',
    'ban-user',
    'unban-user',
    'delete-user',
    'verify-user',
    'reset-password',
    'update-user-metadata',
  ]),
  orderId: z.string().uuid('Invalid order ID').optional(),
  userId: z.string().uuid('Invalid user ID').optional(),
  reason: z.string().min(1).max(1000, 'Reason too long').optional(),
  details: z.record(z.unknown()).optional(),
  refundAmount: z.number().positive().max(1000000, 'Refund amount too large').optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type AdminActionInput = z.infer<typeof adminActionSchema>;

export function validateAdminAction(body: unknown): AdminActionInput {
  return adminActionSchema.parse(body);
}
