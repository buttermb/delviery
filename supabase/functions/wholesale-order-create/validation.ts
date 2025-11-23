import { z } from '../_shared/deps.ts';

const orderItemSchema = z.object({
  inventory_id: z.string().uuid(),
  product_name: z.string().min(1).max(500),
  quantity_lbs: z.number().positive().max(10000),
  quantity_units: z.number().int().nonnegative().max(100000),
  price_per_lb: z.number().nonnegative().max(1000000),
});

export const wholesaleOrderCreateSchema = z.object({
  client_id: z.string().uuid('Invalid client ID format'),
  items: z.array(orderItemSchema).min(1, 'At least one item is required').max(100),
  delivery_address: z.string().min(1).max(500).optional(),
  delivery_notes: z.string().max(2000).optional(),
  payment_terms: z.enum(['net30', 'net60', 'net90', 'immediate']).optional().default('net30'),
});

export type WholesaleOrderCreateInput = z.infer<typeof wholesaleOrderCreateSchema>;
export type OrderItem = z.infer<typeof orderItemSchema>;

export function validateWholesaleOrderCreate(body: unknown): WholesaleOrderCreateInput {
  return wholesaleOrderCreateSchema.parse(body);
}
