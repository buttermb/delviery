export interface MarketingCampaign {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'push';
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'failed';
  subject: string | null;
  content: string;
  audience: string | null;
  scheduled_at: string | null;
  sent_count: number | null;
  opened_count: number | null;
  clicked_count: number | null;
  created_at: string;
}

export interface MarketingWorkflow {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_conditions: Record<string, unknown> | null;
  actions: Record<string, unknown>[] | null;
  status: 'active' | 'paused' | 'draft';
  run_count: number | null;
  last_run_at: string | null;
  created_at: string;
}
