import { z } from '../_shared/deps.ts';

const returnItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive().max(1000),
  quantity_lbs: z.number().positive().max(10000),
  subtotal: z.number().nonnegative().max(100000),
  reason: z.string().max(500).optional(),
  disposition: z.enum(['restock', 'dispose', 'inspect']).optional().default('restock'),
});

export const processReturnSchema = z.object({
  tenant_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  order_id: z.string().uuid().optional(),
  items: z.array(returnItemSchema).min(1).max(50),
  reason: z.enum(['defective', 'wrong_item', 'not_satisfied', 'other']),
  notes: z.string().max(2000).optional(),
});

export type ProcessReturnInput = z.infer<typeof processReturnSchema>;
export type ReturnItem = z.infer<typeof returnItemSchema>;

export function validateProcessReturn(body: unknown): ProcessReturnInput {
  return processReturnSchema.parse(body);
}
