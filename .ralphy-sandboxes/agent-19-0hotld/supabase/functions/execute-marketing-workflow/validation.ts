import { z } from '../_shared/deps.ts';

export const executeMarketingWorkflowSchema = z.object({
  workflowId: z.string().uuid('Invalid workflow ID format'),
  triggerData: z.record(z.unknown()).optional().default({}),
  dryRun: z.boolean().optional().default(false),
});

export type ExecuteMarketingWorkflowInput = z.infer<typeof executeMarketingWorkflowSchema>;

export function validateExecuteMarketingWorkflow(body: unknown): ExecuteMarketingWorkflowInput {
  return executeMarketingWorkflowSchema.parse(body);
}
