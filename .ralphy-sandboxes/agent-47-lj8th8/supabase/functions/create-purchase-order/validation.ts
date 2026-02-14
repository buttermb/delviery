import { z } from '../_shared/deps.ts';

const purchaseOrderItemSchema = z.object({
  product_id: z.string().uuid(),
  product_name: z.string().min(1).max(500),
  quantity_lbs: z.number().positive().max(10000),
  quantity_units: z.number().int().nonnegative().max(10000).optional().default(0),
  price_per_lb: z.number().nonnegative().max(100000),
});

export const createPurchaseOrderSchema = z.object({
  tenant_id: z.string().uuid(),
  supplier_id: z.string().uuid(),
  items: z.array(purchaseOrderItemSchema).min(1).max(100),
  delivery_date: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type PurchaseOrderItem = z.infer<typeof purchaseOrderItemSchema>;

export function validateCreatePurchaseOrder(body: unknown): CreatePurchaseOrderInput {
  return createPurchaseOrderSchema.parse(body);
}
