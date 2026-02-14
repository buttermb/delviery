import { z } from 'zod';

/**
 * Decimal quantity validation - max 2 decimal places
 * For weight-based products (lbs, oz, g)
 */
export const decimalQuantitySchema = z.number()
  .positive('Quantity must be positive')
  .refine(
    (val) => {
      // Check for max 2 decimal places
      const decimalPart = val.toString().split('.')[1];
      return !decimalPart || decimalPart.length <= 2;
    },
    { message: 'Quantity can have at most 2 decimal places' }
  );

/**
 * Integer quantity validation
 * For unit-based products (each, pack, case)
 */
export const integerQuantitySchema = z.number()
  .int('Quantity must be a whole number')
  .positive('Quantity must be positive');

/**
 * Price validation - positive number with max 2 decimal places
 */
export const priceSchema = z.number()
  .nonnegative('Price cannot be negative')
  .refine(
    (val) => {
      const decimalPart = val.toString().split('.')[1];
      return !decimalPart || decimalPart.length <= 2;
    },
    { message: 'Price can have at most 2 decimal places' }
  );

/**
 * Order item validation schema
 */
export const orderItemSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  quantity: decimalQuantitySchema,
  unit_price: priceSchema,
  discount: priceSchema.optional().default(0),
  notes: z.string().max(500).optional()
});

/**
 * Wholesale order creation schema
 */
export const wholesaleOrderSchema = z.object({
  client_id: z.string().uuid('Invalid client ID'),
  items: z.array(orderItemSchema).min(1, 'Order must have at least one item'),
  delivery_address: z.string().min(1, 'Delivery address is required'),
  delivery_notes: z.string().max(1000).optional(),
  payment_terms: z.enum(['cod', 'net15', 'net30', 'prepaid']).optional(),
  scheduled_delivery: z.string().datetime().optional()
});

/**
 * Retail order item schema (integer quantities)
 */
export const retailOrderItemSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  quantity: integerQuantitySchema,
  unit_price: priceSchema,
  discount: priceSchema.optional().default(0)
});

/**
 * Validate quantity based on product type
 */
export function validateQuantity(
  quantity: number, 
  isWeightBased: boolean
): { valid: boolean; error?: string } {
  try {
    if (isWeightBased) {
      decimalQuantitySchema.parse(quantity);
    } else {
      integerQuantitySchema.parse(quantity);
    }
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.errors[0]?.message };
    }
    return { valid: false, error: 'Invalid quantity' };
  }
}

/**
 * Round quantity to valid precision
 */
export function roundQuantity(quantity: number, isWeightBased: boolean): number {
  if (isWeightBased) {
    // Round to 2 decimal places for weight-based
    return Math.round(quantity * 100) / 100;
  }
  // Round to integer for unit-based
  return Math.round(quantity);
}
