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
 * Validate email format (basic client-side check)
 * For full verification with MX lookup, use useEmailVerification hook
 */
export function validateEmail(email: string): boolean {
  if (!email) return false;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

/**
 * Quick check for disposable email domains
 */
export function isDisposableEmail(email: string): boolean {
  if (!email) return false;
  
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  
  const disposableDomains = [
    'tempmail.com', 'throwaway.email', 'guerrillamail.com', 'mailinator.com',
    'yopmail.com', '10minutemail.com', 'fakeinbox.com', 'trashmail.com',
    'dispostable.com', 'sharklasers.com', 'spam4.me', 'getnada.com'
  ];
  
  return disposableDomains.includes(domain);
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
 * Validate phone number (US format, 10 digits after stripping)
 */
export function validatePhoneNumber(phone: string): boolean {
  if (!phone) return false;

  let digits = phone.replace(/\D/g, '');
  // Strip leading US country code
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  return digits.length === 10;
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
  // US phone: accepts common formats, validates 10 digits after stripping
  phone: z.string()
    .min(1, "Phone number is required")
    .refine((val) => {
      let digits = val.replace(/\D/g, '');
      if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
      return digits.length === 10;
    }, "Please enter a valid 10-digit US phone number"),
  url: z.string().url(),
  nonEmptyString: z.string().min(1).max(255),
  positiveNumber: z.number().positive(),
  nonNegativeNumber: z.number().nonnegative(),
};

/**
 * Product validation schema
 */
export const productSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price: z.number().min(0, "Price cannot be negative").max(999999),
  wholesale_price: z.number().min(0, "Wholesale price cannot be negative").max(999999).optional(),
  cost_price: z.number().min(0, "Cost price cannot be negative").max(999999).optional(),
  sale_price: z.number().min(0, "Sale price cannot be negative").max(999999).optional(),
  stock_quantity: z.number().int("Stock quantity must be a whole number").min(0, "Stock quantity cannot be negative").optional(),
  reorder_point: z.number().int("Reorder point must be a whole number").min(0, "Reorder point cannot be negative").optional(),
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
 * Image dimension constraints
 */
export interface ImageDimensionConstraints {
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

/**
 * Image validation result
 */
export interface ImageValidationResult {
  valid: boolean;
  width: number;
  height: number;
  error?: string;
}

/**
 * Default image constraints for different contexts
 */
export const IMAGE_DIMENSION_CONSTRAINTS = {
  productImage: {
    minWidth: 400,
    minHeight: 400,
    maxWidth: 4096,
    maxHeight: 4096,
  },
  avatar: {
    minWidth: 100,
    minHeight: 100,
    maxWidth: 2048,
    maxHeight: 2048,
  },
  thumbnail: {
    minWidth: 150,
    minHeight: 150,
    maxWidth: 1024,
    maxHeight: 1024,
  },
  banner: {
    minWidth: 800,
    minHeight: 200,
    maxWidth: 4096,
    maxHeight: 2048,
  },
} as const;

/**
 * Get image dimensions from a File object
 * Returns a promise that resolves with width and height
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('File is not an image'));
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };

    img.src = objectUrl;
  });
}

/**
 * Validate image dimensions against constraints
 *
 * @param file - The image file to validate
 * @param constraints - Min/max width and height constraints
 * @returns Promise with validation result including dimensions
 *
 * @example
 * ```ts
 * const result = await validateImageDimensions(file, {
 *   minWidth: 400,
 *   minHeight: 400,
 *   maxWidth: 4096,
 *   maxHeight: 4096,
 * });
 *
 * if (!result.valid) {
 *   toast.error(result.error);
 * }
 * ```
 */
export async function validateImageDimensions(
  file: File,
  constraints: ImageDimensionConstraints
): Promise<ImageValidationResult> {
  try {
    const { width, height } = await getImageDimensions(file);
    const { minWidth, minHeight, maxWidth, maxHeight } = constraints;

    // Check minimum dimensions
    if (minWidth !== undefined && width < minWidth) {
      return {
        valid: false,
        width,
        height,
        error: `Image width (${width}px) is below minimum of ${minWidth}px`,
      };
    }

    if (minHeight !== undefined && height < minHeight) {
      return {
        valid: false,
        width,
        height,
        error: `Image height (${height}px) is below minimum of ${minHeight}px`,
      };
    }

    // Check maximum dimensions
    if (maxWidth !== undefined && width > maxWidth) {
      return {
        valid: false,
        width,
        height,
        error: `Image width (${width}px) exceeds maximum of ${maxWidth}px`,
      };
    }

    if (maxHeight !== undefined && height > maxHeight) {
      return {
        valid: false,
        width,
        height,
        error: `Image height (${height}px) exceeds maximum of ${maxHeight}px`,
      };
    }

    return { valid: true, width, height };
  } catch (error) {
    return {
      valid: false,
      width: 0,
      height: 0,
      error: error instanceof Error ? error.message : 'Failed to validate image dimensions',
    };
  }
}

/**
 * Format dimension constraints as a human-readable string
 */
export function formatDimensionConstraints(constraints: ImageDimensionConstraints): string {
  const parts: string[] = [];

  if (constraints.minWidth || constraints.minHeight) {
    const minW = constraints.minWidth ?? 0;
    const minH = constraints.minHeight ?? 0;
    parts.push(`Min: ${minW}x${minH}px`);
  }

  if (constraints.maxWidth || constraints.maxHeight) {
    const maxW = constraints.maxWidth || 'unlimited';
    const maxH = constraints.maxHeight || 'unlimited';
    parts.push(`Max: ${maxW}x${maxH}px`);
  }

  return parts.join(', ');
}

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

