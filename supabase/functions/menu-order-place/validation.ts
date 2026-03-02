import { z } from '../_shared/deps.ts';

export const menuOrderItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive().max(1000),
  tier_label: z.string().max(20).optional(),   // e.g. "8th", "Q", "Half", "Zip"
  tier_price: z.number().nonnegative().max(1000000).optional(),
  product_name: z.string().max(200).optional(),
  line_total: z.number().nonnegative().max(1000000).optional(),
});

export const menuOrderPlaceSchema = z.object({
  menu_id: z.string().uuid(),
  order_items: z.array(menuOrderItemSchema).min(1).max(100),
  payment_method: z.enum(['cash', 'venmo', 'zelle', 'cashapp', 'card', 'crypto', 'other']),
  contact_phone: z.string().min(1).max(20),
  contact_email: z.string().email().max(255).optional(),
  customer_name: z.string().max(100).optional(),
  customer_notes: z.string().max(2000).optional(),
  delivery_address: z.string().max(500).optional(),
  total_amount: z.number().nonnegative().max(1000000).optional(),
});

export type MenuOrderPlaceInput = z.infer<typeof menuOrderPlaceSchema>;
export type MenuOrderItem = z.infer<typeof menuOrderItemSchema>;

export function validateMenuOrderPlace(body: unknown): MenuOrderPlaceInput {
  return menuOrderPlaceSchema.parse(body);
}
