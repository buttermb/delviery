/**
 * Request validation and slug generation for tenant signup.
 */

import { z } from '../_shared/deps.ts';

// Request validation schema
export const TenantSignupSchema = z.object({
  email: z.string().email().min(1).max(255),
  password: z.string().min(8).max(255),
  business_name: z.string().min(1).max(255),
  owner_name: z.string().min(1).max(255),
  phone: z.string().max(20).optional(),
  state: z.string().max(100).optional(),
  industry: z.string().max(100).optional(),
  company_size: z.string().max(50).optional(),
  captchaToken: z.string().optional(), // Cloudflare Turnstile token
});

export type TenantSignupInput = z.infer<typeof TenantSignupSchema>;

// Generate slug from business name
export function generateSlug(businessName: string): string {
  return businessName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
