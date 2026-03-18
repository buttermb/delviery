import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { createLogger } from '../_shared/logger.ts';
import { withZenProtection } from '../_shared/zen-firewall.ts';
import { validateMarketingAutomation, type MarketingAutomationInput } from './validation.ts';

const logger = createLogger('marketing-automation');

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

/**
 * Resolve tenant_id from an authenticated user via tenant_users or owner_email fallback.
 */
async function resolveTenantId(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  userEmail: string | undefined
): Promise<string | null> {
  const { data: tenantUser } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (tenantUser) return tenantUser.tenant_id;

  if (userEmail) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('owner_email', userEmail)
      .maybeSingle();

    if (tenant) return tenant.id;
  }

  return null;
}

serve(withZenProtection(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      logger.error('Missing environment variables');
      return jsonResponse({ error: 'Server configuration error' }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      logger.warn('Missing authorization header');
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      logger.warn('Authentication failed', { error: authError?.message });
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Verify admin access
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id, user_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!adminUser) {
      logger.warn('Non-admin attempted marketing action', { userId: user.id });
      return jsonResponse({ error: 'Admin access required' }, 403);
    }

    // Resolve tenant for isolation
    const tenantId = await resolveTenantId(supabase, user.id, user.email);
    if (!tenantId) {
      logger.warn('No tenant association', { userId: user.id });
      return jsonResponse({ error: 'Tenant not found' }, 403);
    }

    // Validate request body
    const rawBody = await req.json();
    let input: MarketingAutomationInput;
    try {
      input = validateMarketingAutomation(rawBody);
    } catch (validationError) {
      logger.warn('Validation failed', {
        error: validationError instanceof Error ? validationError.message : 'Unknown',
        userId: user.id,
      });
      return jsonResponse({
        error: 'Validation failed',
        details: validationError instanceof Error ? validationError.message : 'Invalid input',
      }, 400);
    }

    const { action, payload } = input;

    // ==================== SEND CAMPAIGN ====================
    if (action === 'send_campaign') {
      const { campaign_id } = payload;

      // Verify campaign belongs to tenant and is in a sendable state
      const { data: campaign, error: fetchError } = await supabase
        .from('marketing_campaigns')
        .select('*')
        .eq('id', campaign_id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (fetchError || !campaign) {
        logger.warn('Campaign not found', { campaign_id, tenantId });
        return jsonResponse({ error: 'Campaign not found' }, 404);
      }

      if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
        return jsonResponse({
          error: `Cannot send campaign with status '${campaign.status}'`,
        }, 400);
      }

      // Update campaign status to sending
      const { error: updateError } = await supabase
        .from('marketing_campaigns')
        .update({
          status: 'sending',
        })
        .eq('id', campaign_id)
        .eq('tenant_id', tenantId);

      if (updateError) {
        logger.error('Failed to update campaign status', { campaign_id, error: updateError.message });
        return jsonResponse({ error: 'Failed to initiate campaign send' }, 500);
      }

      // Mark as sent (actual email/SMS integration would go here)
      const { error: sentError } = await supabase
        .from('marketing_campaigns')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', campaign_id)
        .eq('tenant_id', tenantId);

      if (sentError) {
        logger.error('Failed to mark campaign as sent', { campaign_id, error: sentError.message });
        // Rollback to draft on failure
        await supabase
          .from('marketing_campaigns')
          .update({ status: 'draft' })
          .eq('id', campaign_id)
          .eq('tenant_id', tenantId);
        return jsonResponse({ error: 'Failed to send campaign' }, 500);
      }

      logger.info('Campaign sent', { campaign_id, type: campaign.type, tenantId, adminId: adminUser.id });
      return jsonResponse({ success: true, message: `Campaign '${campaign.name}' sent successfully` });
    }

    // ==================== SCHEDULE CAMPAIGN ====================
    if (action === 'schedule_campaign') {
      const { campaign_id, scheduled_at } = payload;

      // Validate schedule is in the future
      if (new Date(scheduled_at) <= new Date()) {
        return jsonResponse({ error: 'Scheduled time must be in the future' }, 400);
      }

      const { data: campaign, error: fetchError } = await supabase
        .from('marketing_campaigns')
        .select('id, name, status')
        .eq('id', campaign_id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (fetchError || !campaign) {
        logger.warn('Campaign not found for scheduling', { campaign_id, tenantId });
        return jsonResponse({ error: 'Campaign not found' }, 404);
      }

      if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
        return jsonResponse({
          error: `Cannot schedule campaign with status '${campaign.status}'`,
        }, 400);
      }

      const { error: updateError } = await supabase
        .from('marketing_campaigns')
        .update({
          status: 'scheduled',
          scheduled_at,
        })
        .eq('id', campaign_id)
        .eq('tenant_id', tenantId);

      if (updateError) {
        logger.error('Failed to schedule campaign', { campaign_id, error: updateError.message });
        return jsonResponse({ error: 'Failed to schedule campaign' }, 500);
      }

      logger.info('Campaign scheduled', { campaign_id, scheduled_at, tenantId, adminId: adminUser.id });
      return jsonResponse({ success: true, message: `Campaign '${campaign.name}' scheduled for ${scheduled_at}` });
    }

    // ==================== PAUSE CAMPAIGN ====================
    if (action === 'pause_campaign') {
      const { campaign_id } = payload;

      const { data: campaign, error: fetchError } = await supabase
        .from('marketing_campaigns')
        .select('id, name, status')
        .eq('id', campaign_id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (fetchError || !campaign) {
        return jsonResponse({ error: 'Campaign not found' }, 404);
      }

      if (campaign.status !== 'scheduled' && campaign.status !== 'sending') {
        return jsonResponse({
          error: `Cannot pause campaign with status '${campaign.status}'`,
        }, 400);
      }

      const { error: updateError } = await supabase
        .from('marketing_campaigns')
        .update({ status: 'paused' })
        .eq('id', campaign_id)
        .eq('tenant_id', tenantId);

      if (updateError) {
        logger.error('Failed to pause campaign', { campaign_id, error: updateError.message });
        return jsonResponse({ error: 'Failed to pause campaign' }, 500);
      }

      logger.info('Campaign paused', { campaign_id, tenantId, adminId: adminUser.id });
      return jsonResponse({ success: true, message: `Campaign '${campaign.name}' paused` });
    }

    // ==================== RESUME CAMPAIGN ====================
    if (action === 'resume_campaign') {
      const { campaign_id } = payload;

      const { data: campaign, error: fetchError } = await supabase
        .from('marketing_campaigns')
        .select('id, name, status, scheduled_at')
        .eq('id', campaign_id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (fetchError || !campaign) {
        return jsonResponse({ error: 'Campaign not found' }, 404);
      }

      if (campaign.status !== 'paused') {
        return jsonResponse({
          error: `Cannot resume campaign with status '${campaign.status}'`,
        }, 400);
      }

      // Resume to scheduled if it had a future schedule, otherwise back to draft
      const resumeStatus = campaign.scheduled_at && new Date(campaign.scheduled_at) > new Date()
        ? 'scheduled'
        : 'draft';

      const { error: updateError } = await supabase
        .from('marketing_campaigns')
        .update({ status: resumeStatus })
        .eq('id', campaign_id)
        .eq('tenant_id', tenantId);

      if (updateError) {
        logger.error('Failed to resume campaign', { campaign_id, error: updateError.message });
        return jsonResponse({ error: 'Failed to resume campaign' }, 500);
      }

      logger.info('Campaign resumed', { campaign_id, resumeStatus, tenantId, adminId: adminUser.id });
      return jsonResponse({ success: true, message: `Campaign '${campaign.name}' resumed as ${resumeStatus}` });
    }

    // ==================== TRACK EVENT ====================
    if (action === 'track_event') {
      const { campaign_id, event_type } = payload;

      // Verify campaign exists and belongs to tenant
      const { data: campaign, error: fetchError } = await supabase
        .from('marketing_campaigns')
        .select('id, sent_count, opened_count, clicked_count')
        .eq('id', campaign_id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (fetchError || !campaign) {
        return jsonResponse({ error: 'Campaign not found' }, 404);
      }

      // Increment the appropriate counter
      const updates: Record<string, number> = {};
      if (event_type === 'open') {
        updates.opened_count = (campaign.opened_count || 0) + 1;
      } else if (event_type === 'click') {
        updates.clicked_count = (campaign.clicked_count || 0) + 1;
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('marketing_campaigns')
          .update(updates)
          .eq('id', campaign_id)
          .eq('tenant_id', tenantId);

        if (updateError) {
          logger.error('Failed to track event', { campaign_id, event_type, error: updateError.message });
          return jsonResponse({ error: 'Failed to track event' }, 500);
        }
      }

      logger.info('Campaign event tracked', { campaign_id, event_type, tenantId });
      return jsonResponse({ success: true, event_type });
    }

    return jsonResponse({ error: 'Unknown action' }, 400);
  } catch (error) {
    logger.error('Marketing automation error', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500
    );
  }
}));
