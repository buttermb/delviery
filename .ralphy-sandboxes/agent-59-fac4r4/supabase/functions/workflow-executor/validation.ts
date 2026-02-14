import { z } from '../_shared/deps.ts';

export const workflowExecutorSchema = z.object({
  execution_id: z.string().uuid('Invalid execution ID format'),
});

export type WorkflowExecutorInput = z.infer<typeof workflowExecutorSchema>;

export function validateWorkflowExecutor(body: unknown): WorkflowExecutorInput {
  return workflowExecutorSchema.parse(body);
}
