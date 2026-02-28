import { z } from '../_shared/deps.ts';

// Signup validation schema
export const signupSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  firstName: z.string().max(100).optional().nullable(),
  lastName: z.string().max(100).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  dateOfBirth: z.string().optional().nullable(), // Format: YYYY-MM-DD
  tenantSlug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Invalid tenant slug format').optional().nullable(),
  tenantId: z.string().uuid('Invalid tenant ID format').optional().nullable(),
  isBusinessBuyer: z.boolean().optional().nullable().default(false),
  businessName: z.string().max(255).optional().nullable(),
  businessLicenseNumber: z.string().max(100).optional().nullable(),
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
