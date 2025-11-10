import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

// Signup validation schema
export const signupSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  tenantSlug: z.string().min(1, 'Tenant slug is required').max(100).regex(/^[a-z0-9-]+$/, 'Invalid tenant slug format'),
});

// Login validation schema
export const loginSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  tenantSlug: z.string().min(1, 'Tenant slug is required').max(100).regex(/^[a-z0-9-]+$/, 'Invalid tenant slug format'),
});

// Update password validation schema
export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(100),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
