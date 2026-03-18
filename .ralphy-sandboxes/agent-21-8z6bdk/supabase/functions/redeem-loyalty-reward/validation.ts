import { z } from '../_shared/deps.ts';

export const redeemLoyaltyRewardSchema = z.object({
  rewardId: z.string().uuid('Invalid reward ID format'),
  customerId: z.string().uuid('Invalid customer ID format'),
  applyToOrder: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
});

export type RedeemLoyaltyRewardInput = z.infer<typeof redeemLoyaltyRewardSchema>;

export function validateRedeemLoyaltyReward(body: unknown): RedeemLoyaltyRewardInput {
  return redeemLoyaltyRewardSchema.parse(body);
}
