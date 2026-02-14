import { z } from '../_shared/deps.ts';

// Setup session input schema
export const setupSessionSchema = z.object({
  tenant_id: z.string().uuid('Invalid tenant ID format'),
});

export type SetupSessionInput = z.infer<typeof setupSessionSchema>;

export function validateSetupSession(body: unknown): SetupSessionInput {
  return setupSessionSchema.parse(body);
}
