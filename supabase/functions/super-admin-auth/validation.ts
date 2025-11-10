import { z } from '../_shared/deps.ts';

// Login validation schema
export const loginSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
});

// Refresh token validation schema
export const refreshSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

// Update password validation schema
export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(100),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
