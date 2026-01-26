/**
 * Zod validation schema for StorefrontSettings
 *
 * Validates all fields for the marketplace_stores table
 * with proper error messages for form validation
 */

import { z } from 'zod';

// ============================================
// Common Regex Patterns
// ============================================

/** Hex color code pattern (#RGB or #RRGGBB) */
const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

/** URL-safe slug pattern (lowercase letters, numbers, hyphens) */
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Time format pattern (HH:MM) */
const TIME_REGEX = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

/** US ZIP code pattern (5 digits or 5+4 format) */
const ZIP_CODE_REGEX = /^\d{5}(-\d{4})?$/;

/** Domain name pattern */
const DOMAIN_REGEX = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;

/** GA4 Measurement ID pattern */
const GA4_ID_REGEX = /^G-[A-Z0-9]+$/;

// ============================================
// Reusable Schema Components
// ============================================

/**
 * Hex color validation schema
 */
export const hexColorSchema = z
  .string()
  .regex(HEX_COLOR_REGEX, {
    message: 'Invalid color format. Use hex code like #10b981 or #fff',
  })
  .transform((val) => val.toUpperCase());

/**
 * URL slug validation schema
 */
export const slugSchema = z
  .string()
  .min(2, { message: 'Slug must be at least 2 characters' })
  .max(50, { message: 'Slug must be 50 characters or less' })
  .regex(SLUG_REGEX, {
    message: 'Slug can only contain lowercase letters, numbers, and hyphens',
  });

/**
 * Time format validation schema (HH:MM)
 */
export const timeSchema = z
  .string()
  .regex(TIME_REGEX, {
    message: 'Invalid time format. Use HH:MM (e.g., 09:00)',
  });

/**
 * Optional URL validation schema
 */
export const optionalUrlSchema = z
  .string()
  .url({ message: 'Please enter a valid URL (e.g., https://example.com)' })
  .nullable()
  .optional()
  .or(z.literal(''));

// ============================================
// Nested Object Schemas
// ============================================

/**
 * Delivery zone validation schema
 */
export const deliveryZoneSchema = z.object({
  zip_code: z
    .string()
    .min(1, { message: 'ZIP code is required' })
    .regex(ZIP_CODE_REGEX, {
      message: 'Invalid ZIP code format. Use 5 digits (e.g., 12345) or ZIP+4 (e.g., 12345-6789)',
    }),
  fee: z
    .number({
      required_error: 'Delivery fee is required',
      invalid_type_error: 'Delivery fee must be a number',
    })
    .nonnegative({ message: 'Delivery fee cannot be negative' })
    .max(999.99, { message: 'Delivery fee cannot exceed $999.99' }),
  min_order: z
    .number({
      invalid_type_error: 'Minimum order must be a number',
    })
    .nonnegative({ message: 'Minimum order cannot be negative' })
    .max(9999.99, { message: 'Minimum order cannot exceed $9,999.99' })
    .optional(),
});

/**
 * Time slot validation schema
 */
export const timeSlotSchema = z.object({
  label: z
    .string()
    .min(1, { message: 'Time slot label is required' })
    .max(50, { message: 'Time slot label must be 50 characters or less' }),
  start: timeSchema,
  end: timeSchema,
  enabled: z.boolean({ required_error: 'Enabled status is required' }),
}).refine(
  (data) => {
    // Validate that end time is after start time
    const [startHour, startMin] = data.start.split(':').map(Number);
    const [endHour, endMin] = data.end.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return endMinutes > startMinutes;
  },
  {
    message: 'End time must be after start time',
    path: ['end'],
  }
);

/**
 * Theme configuration validation schema
 */
export const themeConfigSchema = z
  .object({
    theme: z.enum(['standard', 'luxury'], {
      errorMap: () => ({ message: 'Theme must be either "standard" or "luxury"' }),
    }),
    colors: z
      .object({
        accent: hexColorSchema.optional(),
      })
      .optional(),
  })
  .nullable();

/**
 * Checkout settings validation schema
 */
export const checkoutSettingsSchema = z.object({
  allow_guest_checkout: z.boolean({
    required_error: 'Guest checkout setting is required',
  }),
  require_phone: z.boolean({
    required_error: 'Phone requirement setting is required',
  }),
  require_address: z.boolean({
    required_error: 'Address requirement setting is required',
  }),
  show_delivery_notes: z.boolean({
    required_error: 'Delivery notes setting is required',
  }),
  enable_coupons: z.boolean({
    required_error: 'Coupons setting is required',
  }),
  enable_tips: z.boolean({
    required_error: 'Tips setting is required',
  }),
});

/**
 * Operating hours for a single day
 */
export const dailyHoursSchema = z.object({
  open: timeSchema,
  close: timeSchema,
  closed: z.boolean({ required_error: 'Closed status is required' }),
}).refine(
  (data) => {
    // Skip validation if closed
    if (data.closed) return true;

    // Validate that close time is after open time
    const [openHour, openMin] = data.open.split(':').map(Number);
    const [closeHour, closeMin] = data.close.split(':').map(Number);
    const openMinutes = openHour * 60 + openMin;
    const closeMinutes = closeHour * 60 + closeMin;
    return closeMinutes > openMinutes;
  },
  {
    message: 'Closing time must be after opening time',
    path: ['close'],
  }
);

/**
 * Full operating hours validation schema
 */
export const operatingHoursSchema = z.record(
  z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
  dailyHoursSchema
);

/**
 * Purchase limits validation schema
 */
export const purchaseLimitsSchema = z
  .object({
    enabled: z.boolean({ required_error: 'Enabled status is required' }),
    max_per_order: z
      .number({
        invalid_type_error: 'Max per order must be a number',
      })
      .positive({ message: 'Max per order must be a positive number' })
      .max(99999, { message: 'Max per order cannot exceed $99,999' })
      .nullable()
      .optional(),
    max_daily: z
      .number({
        invalid_type_error: 'Max daily must be a number',
      })
      .positive({ message: 'Max daily limit must be a positive number' })
      .max(99999, { message: 'Max daily limit cannot exceed $99,999' })
      .nullable()
      .optional(),
    max_weekly: z
      .number({
        invalid_type_error: 'Max weekly must be a number',
      })
      .positive({ message: 'Max weekly limit must be a positive number' })
      .max(999999, { message: 'Max weekly limit cannot exceed $999,999' })
      .nullable()
      .optional(),
  })
  .nullable();

// ============================================
// Main StorefrontSettings Schema
// ============================================

/**
 * Complete Storefront Settings validation schema
 *
 * Validates all fields in the marketplace_stores table
 * that can be edited through the settings page
 */
export const storefrontSettingsSchema = z.object({
  // ============================================
  // Identifiers (read-only, validated for reference)
  // ============================================
  id: z.string().uuid({ message: 'Invalid store ID format' }),

  // ============================================
  // General Settings
  // ============================================
  store_name: z
    .string({ required_error: 'Store name is required' })
    .min(2, { message: 'Store name must be at least 2 characters' })
    .max(100, { message: 'Store name must be 100 characters or less' })
    .trim(),

  slug: slugSchema,

  encrypted_url_token: z
    .string()
    .max(64, { message: 'Token must be 64 characters or less' })
    .nullable()
    .optional(),

  tagline: z
    .string()
    .max(200, { message: 'Tagline must be 200 characters or less' })
    .nullable()
    .optional()
    .transform((val) => val?.trim() || null),

  description: z
    .string()
    .max(2000, { message: 'Description must be 2,000 characters or less' })
    .nullable()
    .optional()
    .transform((val) => val?.trim() || null),

  // ============================================
  // Visibility & Access
  // ============================================
  is_active: z.boolean({
    required_error: 'Active status is required',
  }),

  is_public: z.boolean({
    required_error: 'Public visibility is required',
  }),

  require_account: z.boolean({
    required_error: 'Account requirement setting is required',
  }),

  require_age_verification: z.boolean({
    required_error: 'Age verification setting is required',
  }),

  minimum_age: z
    .number({
      required_error: 'Minimum age is required',
      invalid_type_error: 'Minimum age must be a number',
    })
    .int({ message: 'Minimum age must be a whole number' })
    .min(18, { message: 'Minimum age must be at least 18' })
    .max(99, { message: 'Minimum age cannot exceed 99' }),

  // ============================================
  // Branding
  // ============================================
  logo_url: optionalUrlSchema,
  banner_url: optionalUrlSchema,
  favicon_url: optionalUrlSchema,

  primary_color: hexColorSchema,
  secondary_color: hexColorSchema,
  accent_color: hexColorSchema,

  font_family: z
    .string()
    .min(1, { message: 'Font family is required' })
    .max(100, { message: 'Font family must be 100 characters or less' }),

  theme_config: themeConfigSchema,

  // ============================================
  // Delivery Settings
  // ============================================
  delivery_zones: z
    .array(deliveryZoneSchema)
    .max(100, { message: 'Maximum 100 delivery zones allowed' }),

  time_slots: z
    .array(timeSlotSchema)
    .max(20, { message: 'Maximum 20 time slots allowed' }),

  free_delivery_threshold: z
    .number({
      required_error: 'Free delivery threshold is required',
      invalid_type_error: 'Free delivery threshold must be a number',
    })
    .nonnegative({ message: 'Free delivery threshold cannot be negative' })
    .max(9999.99, { message: 'Free delivery threshold cannot exceed $9,999.99' }),

  default_delivery_fee: z
    .number({
      required_error: 'Default delivery fee is required',
      invalid_type_error: 'Default delivery fee must be a number',
    })
    .nonnegative({ message: 'Default delivery fee cannot be negative' })
    .max(999.99, { message: 'Default delivery fee cannot exceed $999.99' }),

  // ============================================
  // Payment & Checkout
  // ============================================
  payment_methods: z
    .array(
      z.enum(['cash', 'card', 'apple_pay', 'google_pay', 'venmo', 'zelle'], {
        errorMap: () => ({ message: 'Invalid payment method' }),
      })
    )
    .min(1, { message: 'At least one payment method must be enabled' })
    .max(10, { message: 'Maximum 10 payment methods allowed' }),

  checkout_settings: checkoutSettingsSchema,

  purchase_limits: purchaseLimitsSchema,

  // ============================================
  // Operating Hours
  // ============================================
  operating_hours: operatingHoursSchema,

  // ============================================
  // SEO & Analytics
  // ============================================
  meta_title: z
    .string()
    .max(70, { message: 'Meta title should be 70 characters or less for optimal SEO' })
    .nullable()
    .optional()
    .transform((val) => val?.trim() || null),

  meta_description: z
    .string()
    .max(160, { message: 'Meta description should be 160 characters or less for optimal SEO' })
    .nullable()
    .optional()
    .transform((val) => val?.trim() || null),

  og_image_url: optionalUrlSchema,

  ga4_measurement_id: z
    .string()
    .regex(GA4_ID_REGEX, {
      message: 'Invalid GA4 Measurement ID format. Should be like G-XXXXXXXXXX',
    })
    .nullable()
    .optional()
    .or(z.literal('')),

  custom_domain: z
    .string()
    .regex(DOMAIN_REGEX, {
      message: 'Invalid domain format. Use format like shop.example.com',
    })
    .nullable()
    .optional()
    .or(z.literal('')),

  // ============================================
  // Featured Products
  // ============================================
  featured_product_ids: z
    .array(z.string().uuid({ message: 'Invalid product ID format' }))
    .max(20, { message: 'Maximum 20 featured products allowed' }),
});

// ============================================
// Partial Schemas for Form Validation
// ============================================

/**
 * Schema for General settings tab
 */
export const generalSettingsSchema = storefrontSettingsSchema.pick({
  store_name: true,
  slug: true,
  tagline: true,
  description: true,
  is_public: true,
  require_account: true,
  require_age_verification: true,
  minimum_age: true,
});

/**
 * Schema for Branding settings tab
 */
export const brandingSettingsSchema = storefrontSettingsSchema.pick({
  logo_url: true,
  banner_url: true,
  favicon_url: true,
  primary_color: true,
  secondary_color: true,
  accent_color: true,
  font_family: true,
  theme_config: true,
});

/**
 * Schema for Delivery settings tab
 */
export const deliverySettingsSchema = storefrontSettingsSchema.pick({
  default_delivery_fee: true,
  free_delivery_threshold: true,
});

/**
 * Schema for Delivery zones tab
 */
export const deliveryZonesSettingsSchema = storefrontSettingsSchema.pick({
  delivery_zones: true,
});

/**
 * Schema for Time slots tab
 */
export const timeSlotsSettingsSchema = storefrontSettingsSchema.pick({
  time_slots: true,
});

/**
 * Schema for Payment methods tab
 */
export const paymentSettingsSchema = storefrontSettingsSchema.pick({
  payment_methods: true,
});

/**
 * Schema for Checkout settings tab
 */
export const checkoutTabSettingsSchema = storefrontSettingsSchema.pick({
  checkout_settings: true,
  purchase_limits: true,
});

/**
 * Schema for Operating hours tab
 */
export const hoursSettingsSchema = storefrontSettingsSchema.pick({
  operating_hours: true,
});

/**
 * Schema for SEO settings tab
 */
export const seoSettingsSchema = storefrontSettingsSchema.pick({
  meta_title: true,
  meta_description: true,
  og_image_url: true,
  ga4_measurement_id: true,
  custom_domain: true,
});

/**
 * Schema for Featured products tab
 */
export const featuredProductsSettingsSchema = storefrontSettingsSchema.pick({
  featured_product_ids: true,
});

// ============================================
// Type Exports
// ============================================

/** Full storefront settings type */
export type StorefrontSettings = z.infer<typeof storefrontSettingsSchema>;

/** Delivery zone type */
export type DeliveryZone = z.infer<typeof deliveryZoneSchema>;

/** Time slot type */
export type TimeSlot = z.infer<typeof timeSlotSchema>;

/** Theme configuration type */
export type ThemeConfig = z.infer<typeof themeConfigSchema>;

/** Checkout settings type */
export type CheckoutSettings = z.infer<typeof checkoutSettingsSchema>;

/** Operating hours type */
export type OperatingHours = z.infer<typeof operatingHoursSchema>;

/** Purchase limits type */
export type PurchaseLimits = z.infer<typeof purchaseLimitsSchema>;

/** Daily hours type */
export type DailyHours = z.infer<typeof dailyHoursSchema>;

// ============================================
// Validation Helper Functions
// ============================================

/**
 * Validate complete storefront settings
 * Returns validation result with parsed data or errors
 */
export function validateStorefrontSettings(data: unknown): {
  success: true;
  data: StorefrontSettings;
} | {
  success: false;
  errors: z.ZodError;
} {
  const result = storefrontSettingsSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, errors: result.error };
}

/**
 * Validate partial storefront settings for a specific tab
 */
export function validateSettingsTab<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
  data: unknown
): {
  success: true;
  data: z.infer<T>;
} | {
  success: false;
  errors: z.ZodError;
} {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, errors: result.error };
}

/**
 * Extract user-friendly error messages from Zod validation errors
 */
export function getFieldErrors(
  zodError: z.ZodError
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of zodError.issues) {
    const path = issue.path.join('.');
    // Only keep the first error for each field
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }

  return errors;
}

/**
 * Validate a single field value
 * Useful for real-time field validation
 */
export function validateField<K extends keyof StorefrontSettings>(
  field: K,
  value: unknown
): string | null {
  const fieldSchema = storefrontSettingsSchema.shape[field];
  const result = fieldSchema.safeParse(value);

  if (result.success) {
    return null;
  }

  return result.error.issues[0]?.message || 'Invalid value';
}
