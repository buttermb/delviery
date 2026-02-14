import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateSendMarketingCampaign, type SendMarketingCampaignInput } from './validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const rawBody = await req.json();
    const { campaignId }: SendMarketingCampaignInput = validateSendMarketingCampaign(rawBody);

    if (!campaignId) {
      throw new Error('Campaign ID is required');
    }

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabaseClient
      .from('marketing_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError) throw campaignError;

    // Get customer list based on audience filter
    const query = supabaseClient
      .from('wholesale_clients')
      .select('id, name, email, phone')
      .eq('tenant_id', campaign.tenant_id)
      .eq('status', 'active');

    if (campaign.audience !== 'all') {
      // Apply audience filters here based on campaign.audience
      // For now, we'll send to all active clients
    }

    const { data: customers, error: customersError } = await query;

    if (customersError) throw customersError;

    // Simulate sending (in production, integrate with email/SMS service)
    const sentCount = customers?.length || 0;

    // Update campaign status
    const { error: updateError } = await supabaseClient
      .from('marketing_campaigns')
      .update({
        status: 'sent',
        sent_count: sentCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaignId);

    if (updateError) throw updateError;

    console.log(`Campaign ${campaign.name} sent to ${sentCount} customers`);

    return new Response(
      JSON.stringify({
        success: true,
        campaignName: campaign.name,
        sentCount,
        message: `Campaign sent successfully to ${sentCount} customers`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending campaign:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
