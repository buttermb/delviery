import { z } from '../_shared/deps.ts';

// Explicit allowlist of tenant-scoped tables accessible via the admin API.
// Adding a table here grants full CRUD access scoped to the caller's tenant_id.
const ALLOWED_RESOURCES = [
  'customers',
  'products',
  'orders',
  'order_items',
  'inventory',
  'invoices',
  'invoice_items',
  'coupons',
  'loyalty_points',
  'reviews',
  'addresses',
  'notifications',
  'delivery_routes',
  'fleet_vehicles',
  'menus',
  'menu_items',
] as const;

export const adminApiOperationSchema = z.object({
  action: z.enum(['create', 'update', 'delete', 'read', 'list']),
  resource: z.enum(ALLOWED_RESOURCES),
  id: z.string().uuid().optional(),
  data: z.record(z.unknown()).optional(),
  filters: z.record(z.unknown()).optional(),
  limit: z.number().int().positive().max(1000).optional(),
  offset: z.number().int().nonnegative().optional(),
});

export type AdminApiOperationInput = z.infer<typeof adminApiOperationSchema>;

export function validateAdminApiOperation(body: unknown): AdminApiOperationInput {
  return adminApiOperationSchema.parse(body);
}
