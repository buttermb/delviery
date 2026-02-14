import { z } from '../_shared/deps.ts';

export const cartItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive().max(1000),
  price: z.number().nonnegative().max(1000000),
  productName: z.string().min(1).max(500),
  selectedWeight: z.string().max(100).optional(),
});

export const createOrderSchema = z.object({
  userId: z.string().uuid().optional(),
  merchantId: z.string().uuid().optional(),
  deliveryAddress: z.string().min(1).max(500),
  deliveryBorough: z.string().min(1).max(100),
  paymentMethod: z.enum(['cash', 'card', 'crypto']),
  deliveryFee: z.number().nonnegative().max(10000),
  subtotal: z.number().nonnegative().max(1000000),
  totalAmount: z.number().nonnegative().max(1000000),
  scheduledDeliveryTime: z.string().optional(),
  deliveryNotes: z.string().max(2000).optional(),
  pickupLat: z.number().min(-90).max(90).optional(),
  pickupLng: z.number().min(-180).max(180).optional(),
  dropoffLat: z.number().min(-90).max(90).optional(),
  dropoffLng: z.number().min(-180).max(180).optional(),
  customerName: z.string().max(255).optional(),
  customerPhone: z.string().max(20).optional(),
  customerEmail: z.string().email().max(255).optional(),
  cartItems: z.array(cartItemSchema).min(1).max(100),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CartItem = z.infer<typeof cartItemSchema>;

export function validateCreateOrder(body: unknown): CreateOrderInput {
  return createOrderSchema.parse(body);
}
