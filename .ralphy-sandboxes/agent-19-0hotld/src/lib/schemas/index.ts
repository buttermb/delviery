/**
 * Zod schemas library — barrel export
 *
 * Centralised validation schemas for all FloraIQ entities.
 * Import specific schemas:
 *   import { productSchema, orderSchema } from '@/lib/schemas';
 *
 * Or import from a domain module:
 *   import { productSchema } from '@/lib/schemas/product';
 */

export * from '@/lib/schemas/common';
export * from '@/lib/schemas/auth';
export * from '@/lib/schemas/product';
export * from '@/lib/schemas/order';
export * from '@/lib/schemas/customer';
export * from '@/lib/schemas/delivery';
export * from '@/lib/schemas/tenant';
export * from '@/lib/schemas/invoice';
export * from '@/lib/schemas/vendor';
export * from '@/lib/schemas/crm';
export * from '@/lib/schemas/wholesale';
export * from '@/lib/schemas/marketplace';
export * from '@/lib/schemas/menu';
