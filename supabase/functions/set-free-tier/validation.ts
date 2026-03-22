import { z } from '../_shared/deps.ts';

export const setFreeTierSchema = z.object({
  tenant_id: z.string().uuid('Invalid tenant ID format'),
});

export type SetFreeTierInput = z.infer<typeof setFreeTierSchema>;

export function validateSetFreeTier(body: unknown): SetFreeTierInput {
  return setFreeTierSchema.parse(body);
}
