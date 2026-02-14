import { z } from '../_shared/deps.ts';

// Billing action schema
export const billingSchema = z.object({
  action: z.enum([
    'get_subscription',
    'get_usage',
    'get_invoices',
    'create_checkout',
    'cancel_subscription',
    'update_payment_method',
    'get_plans',
    'get_billing',
    'get_payment_methods',
  ]),
  tenant_id: z.string().uuid().optional(),
  plan_id: z.string().uuid().optional(),
  success_url: z.string().url().max(2000).optional(),
  cancel_url: z.string().url().max(2000).optional(),
});

export type BillingInput = z.infer<typeof billingSchema>;

export function validateBilling(body: unknown): BillingInput {
  return billingSchema.parse(body);
}
