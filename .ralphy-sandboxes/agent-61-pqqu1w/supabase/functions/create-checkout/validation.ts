import { z } from '../_shared/deps.ts';

// Create checkout input schema
export const createCheckoutSchema = z.object({
  tenant_id: z.string().uuid('Invalid tenant ID format'),
  plan_id: z.string().uuid('Invalid plan ID format'),
  billing_cycle: z.enum(['monthly', 'yearly']).default('monthly'),
  skip_trial: z.boolean().default(false),
});

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;

export function validateCreateCheckout(body: unknown): CreateCheckoutInput {
  return createCheckoutSchema.parse(body);
}
