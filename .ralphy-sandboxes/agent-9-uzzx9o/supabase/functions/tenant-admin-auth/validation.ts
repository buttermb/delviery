import { z } from '../_shared/deps.ts';

// Login validation schema
export const loginSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  tenantSlug: z.string().min(1, 'Tenant slug is required').max(100).regex(/^[a-z0-9-]+$/, 'Invalid tenant slug format'),
  rememberMe: z.boolean().optional().default(false),
});

// Refresh token validation schema
export const refreshSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});

// Setup password validation schema
export const setupPasswordSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  tenantSlug: z.string().min(1, 'Tenant slug is required').max(100).regex(/^[a-z0-9-]+$/, 'Invalid tenant slug format'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type SetupPasswordInput = z.infer<typeof setupPasswordSchema>;
