import { z } from '../_shared/deps.ts';

export const menuGenerateSchema = z.object({
  name: z.string().min(1, 'Menu name is required').max(255),
  description: z.string().max(1000).optional(),
  product_ids: z.array(z.string().uuid()).min(1, 'At least one product is required').max(100),
  min_order_quantity: z.number().int().positive().max(1000).optional(),
  max_order_quantity: z.number().int().positive().max(10000).optional(),
  security_settings: z.record(z.unknown()).optional(),
  custom_prices: z.record(z.number().nonnegative().max(1000000)).optional(),
  appearance_style: z.string().max(50).optional(),
  show_product_images: z.boolean().optional(),
  show_availability: z.boolean().optional(),
  show_contact_info: z.boolean().optional(),
  custom_message: z.string().max(500).optional(),
});

export type MenuGenerateInput = z.infer<typeof menuGenerateSchema>;

export function validateMenuGenerate(body: unknown): MenuGenerateInput {
  return menuGenerateSchema.parse(body);
}
