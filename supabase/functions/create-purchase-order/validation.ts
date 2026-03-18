import { z } from '../_shared/deps.ts';

const purchaseOrderItemSchema = z.object({
  product_id: z.string().uuid(),
  product_name: z.string().min(1).max(500).optional(),
  quantity_lbs: z.number().positive().max(10000),
  quantity_units: z.number().int().nonnegative().max(10000).optional(),
  unit_cost: z.number().nonnegative().max(100000).optional(),
  price_per_lb: z.number().nonnegative().max(100000).optional(),
});

export const createPurchaseOrderSchema = z.object({
  tenant_id: z.string().uuid().optional(),
  supplier_id: z.string().uuid(),
  items: z.array(purchaseOrderItemSchema).min(1).max(100),
  expected_delivery_date: z.string().optional(),
  delivery_date: z.string().optional(),
  notes: z.string().max(2000).optional(),
  status: z.enum(['draft', 'submitted', 'approved', 'received', 'cancelled']).optional(),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type PurchaseOrderItem = z.infer<typeof purchaseOrderItemSchema>;

export function validateCreatePurchaseOrder(body: unknown): CreatePurchaseOrderInput {
  return createPurchaseOrderSchema.parse(body);
}
