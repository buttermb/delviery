import { z } from 'zod';

export const storefrontSettingsSchema = z.object({
  storeName: z.string().min(1).max(100).optional(),
  tagline: z.string().max(200).optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  heroImageUrl: z.string().url().optional().or(z.literal('')),
  showCategories: z.boolean().optional(),
  showSearch: z.boolean().optional(),
  minimumOrderAmount: z.number().min(0).optional(),
  deliveryEnabled: z.boolean().optional(),
  pickupEnabled: z.boolean().optional(),
});

export type StorefrontSettings = z.infer<typeof storefrontSettingsSchema>;
