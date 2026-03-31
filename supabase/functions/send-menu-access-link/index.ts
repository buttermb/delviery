import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { CREDIT_ACTIONS } from '../_shared/creditGate.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - missing authorization header' }),
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

    const { whitelistId, method = 'email' } = await req.json();

    if (!whitelistId) {
      throw new Error('Whitelist ID is required');
    }

    // Get whitelist entry and menu details
    const { data: whitelist, error: whitelistError } = await supabase
      .from('menu_access_whitelist')
      .select(`
        *,
        disposable_menus (
          id,
          title,
          description,
          expiration_date,
          access_code_required
        )
      `)
      .eq('id', whitelistId)
      .maybeSingle();

    if (whitelistError || !whitelist) {
      return new Response(
        JSON.stringify({ error: 'Whitelist entry not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const menu = whitelist.disposable_menus;

    // Verify the menu belongs to the caller's tenant
    const { data: menuRecord } = await supabase
      .from('disposable_menus')
      .select('tenant_id')
      .eq('id', menu.id)
      .maybeSingle();

    if (!menuRecord) {
      return new Response(
        JSON.stringify({ error: 'Menu not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user belongs to the menu's tenant
    const { data: tenantUser } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('tenant_id', menuRecord.tenant_id)
      .maybeSingle();

    if (!tenantUser) {
      // Fallback: check if user is the tenant owner
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('id', menuRecord.tenant_id)
        .eq('owner_email', user.email)
        .maybeSingle();

      if (!tenant) {
        return new Response(
          JSON.stringify({ error: 'Forbidden - menu does not belong to your tenant' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    const accessUrl = `${Deno.env.get('SUPABASE_URL')?.replace('supabase.co', 'lovable.app')}/menu/${whitelist.unique_access_token}${
      menu.access_code_required ? '?code=XXXXX' : ''
    }`;

    // Prepare notification content
    const subject = `Access to ${menu.title}`;
    const message = `
Hello ${whitelist.customer_name || 'Valued Customer'},

You have been granted access to our exclusive menu: ${menu.title}

${menu.description || ''}

Access your menu here:
${accessUrl}

${menu.access_code_required ? 'Note: You will need an access code to view this menu. Please check your messages or contact us.' : ''}

This link expires on: ${new Date(menu.expiration_date).toLocaleDateString()}

Best regards,
Your Team
    `.trim();

    if (method === 'email' && whitelist.customer_email) {
      // Send email (placeholder - would integrate with email service)
      console.error('Email notification:', {
        to: whitelist.customer_email,
        subject,
        message,
      });

      // Log the notification
      await supabase.from('account_logs').insert({
        menu_id: menu.id,
        whitelist_entry_id: whitelistId,
        action: 'access_link_sent',
        details: {
          method: 'email',
          recipient: whitelist.customer_email,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Access link sent via email',
          preview: { subject, message },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (method === 'sms' && whitelist.customer_phone) {
      // Deduct credits for SMS sending (25 credits)
      const tenantId = menuRecord.tenant_id;
      const { data: creditResult, error: creditError } = await supabase
        .rpc('consume_credits', {
          p_tenant_id: tenantId,
          p_action_key: CREDIT_ACTIONS.SEND_SMS,
          p_reference_id: whitelistId,
          p_reference_type: 'menu_access_whitelist',
          p_description: `Send menu access link via SMS to ${whitelist.customer_phone}`,
        });

      if (creditError) {
        console.error('Credit deduction error:', creditError);
        return new Response(
          JSON.stringify({ error: 'Failed to process credits', details: creditError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const credit = Array.isArray(creditResult) ? creditResult[0] : creditResult;
      if (!credit?.success) {
        return new Response(
          JSON.stringify({
            error: 'Insufficient credits',
            code: 'INSUFFICIENT_CREDITS',
            message: credit?.error_message || 'Not enough credits to send SMS',
            creditsRequired: credit?.credits_cost ?? 25,
            currentBalance: credit?.new_balance ?? 0,
            actionKey: CREDIT_ACTIONS.SEND_SMS,
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Send SMS (placeholder - would integrate with SMS service)
      const smsMessage = `${menu.title}: Access your menu at ${accessUrl}${
        menu.access_code_required ? ' (Access code required)' : ''
      }`;

      try {
        console.error('SMS notification:', {
          to: whitelist.customer_phone,
          message: smsMessage,
        });
      } catch (smsError: unknown) {
        console.error('SMS delivery failed, refunding credits:', smsError);

        // Refund credits on SMS failure
        await supabase.from('credit_transactions').insert({
          tenant_id: tenantId,
          amount: credit.credits_cost ?? 25,
          balance_after: (credit.new_balance ?? 0) + (credit.credits_cost ?? 25),
          transaction_type: 'refund',
          action_type: CREDIT_ACTIONS.SEND_SMS,
          reference_id: whitelistId,
          description: 'Refund: SMS delivery failed for menu access link',
        });

        // Restore the balance
        await supabase.rpc('grant_free_credits', {
          p_tenant_id: tenantId,
          p_amount: credit.credits_cost ?? 25,
        });

        return new Response(
          JSON.stringify({
            error: 'SMS delivery failed',
            message: smsError instanceof Error ? smsError.message : 'Failed to send SMS',
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Log the notification
      await supabase.from('account_logs').insert({
        menu_id: menu.id,
        whitelist_entry_id: whitelistId,
        action: 'access_link_sent',
        details: {
          method: 'sms',
          recipient: whitelist.customer_phone,
          credits_consumed: credit.credits_cost ?? 25,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Access link sent via SMS',
          preview: { message: smsMessage },
          creditsConsumed: credit.credits_cost ?? 25,
          creditsRemaining: credit.new_balance ?? 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid method or missing contact information');
  } catch (error: unknown) {
    console.error('Error sending access link:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
