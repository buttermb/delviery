import { z } from '../_shared/deps.ts';

// Valid endpoints for the admin dashboard
const validEndpoints = [
  'overview',
  'live-deliveries',
  'orders',
  'order-details',
  'compliance',
  'realtime-stats',
  'users',
  'user-details',
  'merchants',
  'merchant-details',
  'couriers',
  'courier-details',
  'products',
  'product-details',
  'verifications',
  'audit-logs',
  'flagged-items',
  'analytics',
  'settings',
] as const;

// Schema for admin dashboard request body
export const adminDashboardSchema = z.object({
  endpoint: z.enum(validEndpoints).optional(),
  // Optional parameters for specific endpoints
  orderId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  merchantId: z.string().uuid().optional(),
  courierId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
  status: z.string().max(100).optional(),
  flagged: z.enum(['true', 'false']).optional(),
  search: z.string().max(200).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
}).passthrough(); // Allow additional properties for flexibility

export type AdminDashboardInput = z.infer<typeof adminDashboardSchema>;

export function validateAdminDashboard(data: unknown): AdminDashboardInput {
  const result = adminDashboardSchema.safeParse(data);
  if (!result.success) {
    const zodError = result as z.SafeParseError<typeof adminDashboardSchema>;
    const errors = zodError.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Validation failed: ${errors}`);
  }
  return result.data;
}
