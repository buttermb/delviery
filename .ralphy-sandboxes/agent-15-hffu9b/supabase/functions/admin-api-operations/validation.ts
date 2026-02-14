import { z } from '../_shared/deps.ts';

export const adminApiOperationSchema = z.object({
  action: z.enum(['create', 'update', 'delete', 'read', 'list']),
  resource: z.string().min(1).max(100),
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
