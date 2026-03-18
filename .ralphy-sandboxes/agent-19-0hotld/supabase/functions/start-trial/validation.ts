import { z } from '../_shared/deps.ts';

// Start trial input schema - now supports billing cycle and skip trial
export const startTrialSchema = z.object({
  tenant_id: z.string().uuid('Invalid tenant ID format'),
  plan_id: z.string().uuid('Invalid plan ID format'),
  billing_cycle: z.enum(['monthly', 'yearly']).optional().default('monthly'),
  skip_trial: z.boolean().optional().default(false),
  idempotency_key: z.string().optional(),
});

export type StartTrialInput = z.infer<typeof startTrialSchema>;

export function validateStartTrial(body: unknown): StartTrialInput {
  return startTrialSchema.parse(body);
}
