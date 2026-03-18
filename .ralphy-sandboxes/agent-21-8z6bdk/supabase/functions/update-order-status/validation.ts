import { z } from '../_shared/deps.ts';

// Order status update schema
export const orderStatusSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(['pending', 'confirmed', 'preparing', 'on_the_way', 'out_for_delivery', 'delivered', 'cancelled', 'failed']),
  message: z.string().max(500).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  courierId: z.string().uuid().optional(),
});

export type OrderStatusInput = z.infer<typeof orderStatusSchema>;

export function validateOrderStatus(body: unknown): OrderStatusInput {
  return orderStatusSchema.parse(body);
}
