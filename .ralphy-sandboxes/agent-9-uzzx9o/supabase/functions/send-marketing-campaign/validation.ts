import { z } from '../_shared/deps.ts';

export const sendMarketingCampaignSchema = z.object({
  campaignId: z.string().uuid('Invalid campaign ID format'),
  sendNow: z.boolean().optional().default(false),
  testMode: z.boolean().optional().default(false),
});

export type SendMarketingCampaignInput = z.infer<typeof sendMarketingCampaignSchema>;

export function validateSendMarketingCampaign(body: unknown): SendMarketingCampaignInput {
  return sendMarketingCampaignSchema.parse(body);
}
