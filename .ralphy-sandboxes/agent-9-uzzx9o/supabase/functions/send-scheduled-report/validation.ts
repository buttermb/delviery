import { z } from '../_shared/deps.ts';

export const sendScheduledReportSchema = z.object({
  schedule_id: z.string().uuid('Invalid schedule ID format'),
  force: z.boolean().optional().default(false),
  override_recipients: z.array(z.string().email()).optional(),
});

export type SendScheduledReportInput = z.infer<typeof sendScheduledReportSchema>;

export function validateSendScheduledReport(body: unknown): SendScheduledReportInput {
  return sendScheduledReportSchema.parse(body);
}
