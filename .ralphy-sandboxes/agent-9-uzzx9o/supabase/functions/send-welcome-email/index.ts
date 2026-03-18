/**
 * Send Welcome Email
 * Called by the handle_new_user database trigger to send a welcome email
 * to newly registered users.
 */

import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';

const WelcomeEmailSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().email(),
  full_name: z.string().optional().default(''),
  tenant_id: z.string().uuid().nullable().optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { email, full_name, tenant_id } = WelcomeEmailSchema.parse(body);

    // Resolve tenant info for branding
    let businessName = 'FloraIQ';
    let tenantSlug = '';
    if (tenant_id) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('business_name, slug')
        .eq('id', tenant_id)
        .maybeSingle();

      if (tenant) {
        businessName = tenant.business_name || businessName;
        tenantSlug = tenant.slug || '';
      }
    }

    const siteUrl = Deno.env.get('SITE_URL') || supabaseUrl || 'https://app.floraiq.com';
    const dashboardUrl = tenantSlug
      ? `${siteUrl}/${tenantSlug}/admin/dashboard`
      : `${siteUrl}/dashboard`;
    const displayName = full_name || email.split('@')[0];

    const subject = `Welcome to ${businessName}!`;
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Welcome to ${businessName}!</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p>Hi ${displayName},</p>
            <p>Your account has been created successfully. We're excited to have you on board!</p>

            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <p style="margin: 0 0 15px 0; font-size: 14px; color: #666;">Get started by visiting your dashboard:</p>
              <a href="${dashboardUrl}"
                 style="display: inline-block; background: #22c55e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Go to Dashboard
              </a>
            </div>

            <h3 style="color: #16a34a;">Getting Started</h3>
            <ul style="padding-left: 20px;">
              <li>Set up your profile and preferences</li>
              <li>Explore available features</li>
              <li>Add your products and inventory</li>
            </ul>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

            <p style="font-size: 12px; color: #999;">
              If you didn't create this account, please contact our support team.
            </p>
          </div>
        </body>
      </html>
    `;

    const textContent = `
Welcome to ${businessName}!

Hi ${displayName},

Your account has been created successfully. We're excited to have you on board!

Get started by visiting your dashboard: ${dashboardUrl}

Getting Started:
- Set up your profile and preferences
- Explore available features
- Add your products and inventory

If you didn't create this account, please contact our support team.
    `.trim();

    // Send email via Klaviyo if available, otherwise log
    const klaviyoApiKey = Deno.env.get('KLAVIYO_API_KEY');
    if (klaviyoApiKey) {
      const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-klaviyo-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: email,
          subject,
          html: htmlContent,
          text: textContent,
          fromEmail: Deno.env.get('FROM_EMAIL') || 'noreply@floraiq.com',
          fromName: businessName,
          template: 'welcome',
          data: {
            business_name: businessName,
            display_name: displayName,
            dashboard_url: dashboardUrl,
          },
        }),
      });

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text();
        console.error('[WELCOME-EMAIL] Failed to send via Klaviyo:', errorText);
      } else {
        console.log('[WELCOME-EMAIL] Sent successfully to:', email);
      }
    } else {
      // Log email for development
      console.log('[WELCOME-EMAIL] Klaviyo not configured, email logged:', {
        to: email,
        subject,
        dashboard_url: dashboardUrl,
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Welcome email sent' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[WELCOME-EMAIL] Error:', error);

    // Return success even on failure - welcome email is non-critical
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Welcome email processing completed (may not have been sent)',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
