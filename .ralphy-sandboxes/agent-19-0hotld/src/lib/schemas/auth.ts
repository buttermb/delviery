/**
 * Auth & user input Zod schemas
 */

import { z } from 'zod';
import { emailSchema, phoneSchema } from '@/lib/schemas/common';

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// ---------------------------------------------------------------------------
// Signup
// ---------------------------------------------------------------------------

export const signupSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  fullName: z.string().min(1, 'Name is required').max(200),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// ---------------------------------------------------------------------------
// User input (generic contact info)
// ---------------------------------------------------------------------------

export const userInputSchema = z.object({
  email: emailSchema,
  name: z.string().min(1).max(100),
  phone: phoneSchema.optional(),
});

// ---------------------------------------------------------------------------
// Checkout (customer info step)
// ---------------------------------------------------------------------------

export const checkoutCustomerInfoSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  phone: phoneSchema,
  email: emailSchema.optional().or(z.literal('')),
  deliveryNotes: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type UserInput = z.infer<typeof userInputSchema>;
export type CheckoutCustomerInfo = z.infer<typeof checkoutCustomerInfoSchema>;
