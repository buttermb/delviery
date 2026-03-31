/**
 * Zod validation schemas for storefront checkout requests.
 * Sanitizes and validates all incoming data before processing.
 */

import { z } from "../_shared/deps.ts";
import { sanitizeString } from '../_shared/validation.ts';

/** Sanitize a string: trim, enforce max length, strip HTML angle brackets */
const sanitized = (maxLength = 255) =>
  z.string().transform((val) => sanitizeString(val, maxLength));

export const CheckoutItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive().max(100),
  variant: z.string().transform((v) => sanitizeString(v, 100)).optional(),
  // Client may send price for display — always overridden by DB price
  price: z.number().optional(),
});

export const CustomerInfoSchema = z.object({
  firstName: sanitized(100).pipe(z.string().min(1)),
  lastName: sanitized(100).pipe(z.string().min(1)),
  email: z.string().email().transform((v) => v.trim().toLowerCase().slice(0, 255)),
  phone: z.string().transform((v) => sanitizeString(v, 20)).optional(),
});

export const CheckoutRequestSchema = z.object({
  // Store identification — slug is the canonical field
  storeSlug: sanitized(100).pipe(z.string().min(1)),
  // Cart items (prices are ALWAYS fetched server-side)
  items: z.array(CheckoutItemSchema).min(1).max(50),
  // Customer details
  customerInfo: CustomerInfoSchema,
  // Fulfillment & payment
  fulfillmentMethod: z.enum(["delivery", "pickup"]).default("delivery"),
  paymentMethod: z.enum(["card", "cash", "venmo", "zelle"]).default("cash"),
  // Optional fields
  deliveryAddress: sanitized(500).optional(),
  deliveryZip: z.string().max(20).optional(),
  notes: sanitized(1000).optional(),
  preferredContactMethod: z.enum(["phone", "email", "text", "telegram"]).optional(),
  discountAmount: z.number().min(0).optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  idempotencyKey: sanitized(100).optional(),
  // Client-side total for discrepancy detection (always overridden by server)
  clientTotal: z.number().optional(),
  // Account creation — when customer opts in at checkout
  createAccount: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

export type CheckoutRequest = z.infer<typeof CheckoutRequestSchema>;
