import { z } from '../_shared/deps.ts';

// Setup session input schema
export const setupSessionSchema = z.object({
  tenant_id: z.string().uuid('Invalid tenant ID format'),
  return_url: z.string().url('Invalid return URL format').optional(),
});

export type SetupSessionInput = z.infer<typeof setupSessionSchema>;

export function validateSetupSession(body: unknown): SetupSessionInput {
  return setupSessionSchema.parse(body);
}
