import { z } from '../_shared/deps.ts';

// Start trial input schema
export const startTrialSchema = z.object({
  tenant_id: z.string().uuid('Invalid tenant ID format'),
  plan_id: z.string().uuid('Invalid plan ID format'),
});

export type StartTrialInput = z.infer<typeof startTrialSchema>;

export function validateStartTrial(body: unknown): StartTrialInput {
  return startTrialSchema.parse(body);
}
