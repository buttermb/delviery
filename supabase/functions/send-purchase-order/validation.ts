import { z } from '../_shared/deps.ts';

export const sendPurchaseOrderSchema = z.object({
  purchase_order_id: z.string().uuid(),
  supplier_email: z.string().email().optional(),
  message: z.string().max(2000).optional(),
});

export type SendPurchaseOrderInput = z.infer<typeof sendPurchaseOrderSchema>;

export function validateSendPurchaseOrder(body: unknown): SendPurchaseOrderInput {
  return sendPurchaseOrderSchema.parse(body);
}
