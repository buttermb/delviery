import { z } from '../_shared/deps.ts';

// Stripe metadata schema
const stripeMetadataSchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]));

// Stripe webhook event schema
export const stripeWebhookSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    object: z.object({
      metadata: stripeMetadataSchema.optional(),
      subscription: z.string().optional(),
      status: z.string().optional(),
    }).passthrough(), // Allow additional properties
  }),
  created: z.number().optional(),
  livemode: z.boolean().optional(),
});

export type StripeWebhookInput = z.infer<typeof stripeWebhookSchema>;

export function validateStripeWebhook(body: unknown): StripeWebhookInput {
  return stripeWebhookSchema.parse(body);
}
