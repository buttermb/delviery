/**
 * Send Menu Access Link
 * Sends a disposable menu access link to a whitelisted customer via email or SMS.
 * Validates tenant ownership before sending.
 */

import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { withZenProtection } from '../_shared/zen-firewall.ts';

const RequestSchema = z.object({
  whitelistId: z.string().uuid(),
  method: z.enum(['email', 'sms']).default('email'),
});

serve(withZenProtection(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

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

    // Validate request body
    const body = RequestSchema.parse(await req.json());
    const { whitelistId, method } = body;

    // Get whitelist entry with menu details
    const { data: whitelist, error: whitelistError } = await supabase
      .from('menu_access_whitelist')
      .select(`
        *,
        disposable_menus (
          id,
          title,
          description,
          expiration_date,
          access_code_required,
          tenant_id,
          never_expires
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
    if (!menu) {
      return new Response(
        JSON.stringify({ error: 'Associated menu not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user belongs to the menu's tenant
    const { data: tenantUser } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('tenant_id', menu.tenant_id)
      .maybeSingle();

    if (!tenantUser) {
      // Fallback: check if user is the tenant owner
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('id', menu.tenant_id)
        .eq('owner_email', user.email)
        .maybeSingle();

      if (!tenant) {
        return new Response(
          JSON.stringify({ error: 'Forbidden - menu does not belong to your tenant' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Build access URL using SITE_URL
    const siteUrl = Deno.env.get('SITE_URL') || supabaseUrl;
    const accessUrl = `${siteUrl}/menu/${whitelist.unique_access_token}`;

    // Build expiration text
    const expirationText = menu.never_expires
      ? 'This link does not expire.'
      : menu.expiration_date
        ? `This link expires on: ${new Date(menu.expiration_date).toLocaleDateString()}`
        : '';

    // Prepare notification content
    const subject = `Access to ${menu.title || 'Menu'}`;
    const emailMessage = `
Hello ${whitelist.customer_name || 'Valued Customer'},

You have been granted access to our exclusive menu: ${menu.title || 'Menu'}

${menu.description || ''}

Access your menu here:
${accessUrl}

${menu.access_code_required ? 'Note: You will need an access code to view this menu. Please contact us for your code.' : ''}

${expirationText}

Best regards,
Your Team
    `.trim();

    const smsMessage = `${menu.title || 'Menu'}: Access your menu at ${accessUrl}${
      menu.access_code_required ? ' (Access code required)' : ''
    }`;

    if (method === 'email') {
      if (!whitelist.customer_email) {
        return new Response(
          JSON.stringify({ error: 'No email address on file for this customer' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Send email via Klaviyo if configured
      const klaviyoApiKey = Deno.env.get('KLAVIYO_API_KEY');
      if (klaviyoApiKey) {
        try {
          const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-klaviyo-email`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: whitelist.customer_email,
              subject,
              text: emailMessage,
              fromEmail: Deno.env.get('FROM_EMAIL') || 'noreply@example.com',
              fromName: menu.title || 'Menu Access',
            }),
          });

          if (!emailResponse.ok) {
            console.error('Failed to send menu access email via Klaviyo:', await emailResponse.text());
          }
        } catch (emailError) {
          console.error('Email sending error:', emailError);
        }
      } else {
        console.error('Menu access email (Klaviyo not configured):', {
          to: whitelist.customer_email,
          subject,
        });
      }

      // Log the notification
      await supabase.from('menu_access_logs').insert({
        menu_id: menu.id,
        access_whitelist_id: whitelistId,
        actions_taken: {
          type: 'access_link_sent',
          method: 'email',
          recipient: whitelist.customer_email,
          sent_by: user.id,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Access link sent via email',
          preview: { subject, message: emailMessage },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (method === 'sms') {
      if (!whitelist.customer_phone) {
        return new Response(
          JSON.stringify({ error: 'No phone number on file for this customer' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Send SMS via the send-sms edge function
      try {
        const smsResponse = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: whitelist.customer_phone,
            message: smsMessage,
          }),
        });

        if (!smsResponse.ok) {
          console.error('Failed to send menu access SMS:', await smsResponse.text());
        }
      } catch (smsError) {
        console.error('SMS sending error:', smsError);
      }

      // Log the notification
      await supabase.from('menu_access_logs').insert({
        menu_id: menu.id,
        access_whitelist_id: whitelistId,
        actions_taken: {
          type: 'access_link_sent',
          method: 'sms',
          recipient: whitelist.customer_phone,
          sent_by: user.id,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Access link sent via SMS',
          preview: { message: smsMessage },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid method' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error sending access link:', error);

    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: 'Validation error', details: error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}));
