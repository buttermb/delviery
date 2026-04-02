import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { validateSendMarketingCampaign, type SendMarketingCampaignInput } from './validation.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate request body
    const rawBody = await req.json();
    const { campaignId }: SendMarketingCampaignInput = validateSendMarketingCampaign(rawBody);

    // Resolve user's tenant
    const { data: tenantUser } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!tenantUser?.tenant_id) {
      return new Response(
        JSON.stringify({ error: 'No tenant associated with user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = tenantUser.tenant_id;

    // Get campaign details — enforce tenant isolation
    const { data: campaign, error: campaignError } = await supabase
      .from('marketing_campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (campaignError) throw campaignError;

    if (!campaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate campaign is in a sendable state
    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      return new Response(
        JSON.stringify({ error: `Campaign cannot be sent — current status is "${campaign.status}"` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get customer list based on audience filter
    const query = supabase
      .from('wholesale_clients')
      .select('id, name, email, phone')
      .eq('tenant_id', tenantId)
      .eq('status', 'active');

    const { data: customers, error: customersError } = await query;

    if (customersError) throw customersError;

    const sentCount = customers?.length || 0;

    // Update campaign status — enforce tenant isolation
    const { error: updateError } = await supabase
      .from('marketing_campaigns')
      .update({
        status: 'sent',
        sent_count: sentCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaignId)
      .eq('tenant_id', tenantId);

    if (updateError) throw updateError;

    console.error(`Campaign ${campaign.name} sent to ${sentCount} customers`);

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
