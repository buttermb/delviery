/**
 * Client-side validation utilities
 * 
 * CRITICAL: Always validate user input on both client and server
 */

import { z } from 'zod';

/**
 * Sanitize string input
 * Removes HTML tags and limits length
 */
export function sanitizeString(input: string, maxLength: number = 255): string {
  if (!input) return '';
  
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, ''); // Basic XSS prevention
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  if (!email) return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

/**
 * Validate UUID format
 */
export function validateUUID(uuid: string): boolean {
  if (!uuid) return false;
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate phone number (US format)
 */
export function validatePhoneNumber(phone: string): boolean {
  if (!phone) return false;
  
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10 || cleaned.length === 11;
}

/**
 * Validate URL format
 */
export function validateURL(url: string): boolean {
  if (!url) return false;
  
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Common Zod schemas for reuse
 */
export const validationSchemas = {
  email: z.string().email().max(255),
  uuid: z.string().uuid(),
  phone: z.string().regex(/^\+?1?\d{10}$/),
  url: z.string().url(),
  nonEmptyString: z.string().min(1).max(255),
  positiveNumber: z.number().positive(),
  nonNegativeNumber: z.number().nonnegative(),
};

/**
 * Product validation schema
 */
export const productSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  price: z.number().positive().max(999999),
  sku: z.string().regex(/^[A-Z0-9-]+$/).optional(),
  category: z.enum(['flower', 'edibles', 'pre-rolls', 'concentrates', 'vapes']),
  vendor_name: z.string().max(100).optional(),
  strain: z.string().max(100).optional(),
});

/**
 * Order validation schema
 */
export const orderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive().max(100),
  })).min(1).max(50),
  addressId: z.string().uuid(),
  paymentMethod: z.enum(['cash', 'card', 'crypto']),
  deliveryNotes: z.string().max(500).optional(),
});

/**
 * User input validation schema
 */
export const userInputSchema = z.object({
  email: validationSchemas.email,
  name: z.string().min(1).max(100),
  phone: validationSchemas.phone.optional(),
});

/**
 * Validate and sanitize user input
 */
export function validateAndSanitize<T>(
  input: unknown,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(input);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { success: false, errors: result.error };
}

