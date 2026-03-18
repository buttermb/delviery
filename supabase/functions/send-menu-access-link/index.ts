/**
 * Send Menu Access Link Edge Function
 * Sends menu access links to whitelisted customers via email (Klaviyo) or SMS (Twilio).
 * Includes tenant authorization, structured logging, and audit trail.
 */

import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { withZenProtection } from '../_shared/zen-firewall.ts';
import { createLogger } from '../_shared/logger.ts';

const logger = createLogger('send-menu-access-link');

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const RequestSchema = z.object({
  whitelistId: z.string().uuid(),
  method: z.enum(['email', 'sms']).default('email'),
});

// ---------------------------------------------------------------------------
// Email helpers
// ---------------------------------------------------------------------------

function buildEmailHtml(
  customerName: string,
  menuTitle: string,
  menuDescription: string | null,
  accessUrl: string,
  accessCodeRequired: boolean,
  expirationDate: string,
  businessName: string,
): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">${businessName}</h1>
  </div>
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <p>Hello ${customerName},</p>
    <p>You have been granted access to our exclusive menu: <strong>${menuTitle}</strong></p>
    ${menuDescription ? `<p style="color: #666;">${menuDescription}</p>` : ''}
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
      <p style="margin: 0 0 15px 0; font-size: 14px; color: #666;">View your menu:</p>
      <a href="${accessUrl}" style="display: inline-block; background: #22c55e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
        Open Menu
      </a>
    </div>
    ${accessCodeRequired ? '<p style="color: #e65100; font-size: 14px;">Note: You will need an access code to view this menu. Please check your messages or contact us.</p>' : ''}
    <p style="font-size: 13px; color: #666;">This link expires on: ${new Date(expirationDate).toLocaleDateString()}</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="font-size: 12px; color: #999;">If you did not expect this, you can safely ignore this message.</p>
  </div>
</body>
</html>`.trim();
}

function buildPlainTextMessage(
  customerName: string,
  menuTitle: string,
  menuDescription: string | null,
  accessUrl: string,
  accessCodeRequired: boolean,
  expirationDate: string,
): string {
  return [
    `Hello ${customerName},`,
    '',
    `You have been granted access to our exclusive menu: ${menuTitle}`,
    menuDescription ? `\n${menuDescription}` : '',
    '',
    `Access your menu here:`,
    accessUrl,
    accessCodeRequired ? '\nNote: You will need an access code to view this menu.' : '',
    '',
    `This link expires on: ${new Date(expirationDate).toLocaleDateString()}`,
    '',
    'Best regards,',
    'Your Team',
  ]
    .filter(Boolean)
    .join('\n')
    .trim();
}

function buildSmsMessage(
  menuTitle: string,
  accessUrl: string,
  accessCodeRequired: boolean,
): string {
  return `${menuTitle}: Access your menu at ${accessUrl}${accessCodeRequired ? ' (Access code required)' : ''}`;
}

// ---------------------------------------------------------------------------
// Delivery helpers
// ---------------------------------------------------------------------------

async function sendEmailViaKlaviyo(
  supabaseUrl: string,
  serviceKey: string,
  to: string,
  subject: string,
  html: string,
  text: string,
  fromEmail: string,
  fromName: string,
): Promise<{ success: boolean; error?: string }> {
  const response = await fetch(`${supabaseUrl}/functions/v1/send-klaviyo-email`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to, subject, html, text, fromEmail, fromName }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { success: false, error: errorText };
  }

  return { success: true };
}

async function sendSmsViaTwilio(
  to: string,
  message: string,
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

  if (!accountSid || !authToken || !fromNumber) {
    return { success: false, error: 'Twilio not configured' };
  }

  const formattedPhone = to.startsWith('+') ? to : `+${to.replace(/\D/g, '')}`;

  const formData = new URLSearchParams();
  formData.append('From', fromNumber);
  formData.append('To', formattedPhone);
  formData.append('Body', message);

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const response = await fetch(twilioUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { success: false, error: errorText };
  }

  const data = await response.json();
  return { success: true, sid: data.sid };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(
  withZenProtection(async (req: Request) => {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // ---------------------------------------------------------------
      // 1. Authenticate caller
      // ---------------------------------------------------------------
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized - missing authorization header' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const token = authHeader.replace('Bearer ', '');
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // ---------------------------------------------------------------
      // 2. Validate request body
      // ---------------------------------------------------------------
      const parseResult = RequestSchema.safeParse(await req.json());
      if (!parseResult.success) {
        return new Response(
          JSON.stringify({ error: 'Invalid request', details: parseResult.error.issues }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      const { whitelistId, method } = parseResult.data;

      // ---------------------------------------------------------------
      // 3. Load whitelist entry + menu
      // ---------------------------------------------------------------
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
            tenant_id
          )
        `)
        .eq('id', whitelistId)
        .maybeSingle();

      if (whitelistError || !whitelist) {
        return new Response(
          JSON.stringify({ error: 'Whitelist entry not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const menu = whitelist.disposable_menus;
      if (!menu) {
        return new Response(
          JSON.stringify({ error: 'Associated menu not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const tenantId = menu.tenant_id;

      // ---------------------------------------------------------------
      // 4. Verify caller belongs to the menu's tenant
      // ---------------------------------------------------------------
      const { data: tenantUser } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (!tenantUser) {
        // Fallback: check if user is the tenant owner
        const { data: tenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('id', tenantId)
          .eq('owner_email', user.email)
          .maybeSingle();

        if (!tenant) {
          return new Response(
            JSON.stringify({ error: 'Forbidden - menu does not belong to your tenant' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
      }

      // ---------------------------------------------------------------
      // 5. Resolve tenant branding
      // ---------------------------------------------------------------
      const { data: tenantInfo } = await supabase
        .from('tenants')
        .select('business_name')
        .eq('id', tenantId)
        .maybeSingle();

      const businessName = tenantInfo?.business_name || 'FloraIQ';

      // ---------------------------------------------------------------
      // 6. Build access URL & messages
      // ---------------------------------------------------------------
      const siteUrl = Deno.env.get('SITE_URL') || Deno.env.get('PUBLIC_SITE_URL') || 'https://app.floraiq.com';
      const accessUrl = `${siteUrl}/menu/${whitelist.unique_access_token}`;

      const customerName = whitelist.customer_name || 'Valued Customer';

      const plainText = buildPlainTextMessage(
        customerName,
        menu.title,
        menu.description,
        accessUrl,
        menu.access_code_required,
        menu.expiration_date,
      );

      // ---------------------------------------------------------------
      // 7. Send via selected method
      // ---------------------------------------------------------------
      if (method === 'email') {
        if (!whitelist.customer_email) {
          return new Response(
            JSON.stringify({ error: 'No email address on file for this customer' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }

        const subject = `Access to ${menu.title}`;
        const html = buildEmailHtml(
          customerName,
          menu.title,
          menu.description,
          accessUrl,
          menu.access_code_required,
          menu.expiration_date,
          businessName,
        );

        const fromEmail = Deno.env.get('FROM_EMAIL') || 'noreply@floraiq.com';
        const klaviyoKey = Deno.env.get('KLAVIYO_API_KEY');

        if (klaviyoKey) {
          const result = await sendEmailViaKlaviyo(
            supabaseUrl,
            supabaseServiceKey,
            whitelist.customer_email,
            subject,
            html,
            plainText,
            fromEmail,
            businessName,
          );

          if (!result.success) {
            logger.warn('Klaviyo email delivery failed, logging for retry', {
              userId: user.id,
              tenantId,
              error: result.error,
            } as Record<string, unknown>);
          }
        } else {
          logger.info('Klaviyo not configured - email logged only', {
            userId: user.id,
            tenantId,
          } as Record<string, unknown>);
        }

        // Audit log
        await supabase.from('account_logs').insert({
          menu_id: menu.id,
          whitelist_entry_id: whitelistId,
          action: 'access_link_sent',
          details: { method: 'email', recipient: whitelist.customer_email },
        });

        logger.info('Menu access link sent via email', { userId: user.id, tenantId } as Record<string, unknown>);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Access link sent via email',
            preview: { subject, message: plainText },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // SMS path
      if (!whitelist.customer_phone) {
        return new Response(
          JSON.stringify({ error: 'No phone number on file for this customer' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const smsMessage = buildSmsMessage(menu.title, accessUrl, menu.access_code_required);

      const smsResult = await sendSmsViaTwilio(whitelist.customer_phone, smsMessage);
      if (!smsResult.success) {
        logger.warn('Twilio SMS delivery failed', {
          userId: user.id,
          tenantId,
          error: smsResult.error,
        } as Record<string, unknown>);
      }

      // Audit log
      await supabase.from('account_logs').insert({
        menu_id: menu.id,
        whitelist_entry_id: whitelistId,
        action: 'access_link_sent',
        details: { method: 'sms', recipient: whitelist.customer_phone },
      });

      logger.info('Menu access link sent via SMS', { userId: user.id, tenantId } as Record<string, unknown>);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Access link sent via SMS',
          preview: { message: smsMessage },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    } catch (error: unknown) {
      logger.error('Error sending access link', {
        error: error instanceof Error ? error.message : String(error),
      } as Record<string, unknown>);

      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
  }),
);
