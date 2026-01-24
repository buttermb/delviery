import { z } from '../_shared/deps.ts';

// Stripe metadata schema
const stripeMetadataSchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]));

// Stripe webhook event schema
export const stripeWebhookSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    object: z.object({
      id: z.string().optional(),
      metadata: stripeMetadataSchema.optional(),
      subscription: z.union([z.string(), z.null()]).optional(),
      status: z.string().optional(),
      trial_end: z.number().nullable().optional(),
      cancel_at_period_end: z.boolean().optional(),
      current_period_start: z.number().optional(),
      current_period_end: z.number().optional(),
      customer: z.string().optional(),
      amount_paid: z.number().optional(),
      amount_total: z.number().optional(),
      payment_intent: z.string().nullable().optional(),
    }).passthrough(), // Allow additional properties
  }),
  created: z.number().optional(),
  livemode: z.boolean().optional(),
});

export type StripeWebhookInput = z.infer<typeof stripeWebhookSchema>;

export function validateStripeWebhook(body: unknown): StripeWebhookInput {
  return stripeWebhookSchema.parse(body);
}
