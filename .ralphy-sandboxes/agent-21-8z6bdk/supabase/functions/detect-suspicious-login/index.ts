import { createClient } from '../_shared/deps.ts';
import { corsHeaders } from '../_shared/deps.ts';
import { withZenProtection } from '../_shared/zen-firewall.ts';
import { z } from '../_shared/deps.ts';

const requestSchema = z.object({
  userId: z.string().uuid(),
  fingerprint: z.string().min(1),
  deviceType: z.string().optional(),
  browser: z.string().optional(),
  os: z.string().optional(),
  userAgent: z.string().optional(),
  screenResolution: z.string().optional(),
  timezone: z.string().optional(),
  language: z.string().optional(),
});

interface GeoLocation {
  country: string | null;
  city: string | null;
  region: string | null;
}

async function getGeoLocation(ipAddress: string): Promise<GeoLocation> {
  try {
    // Use a free geo-IP service (fallback to null if unavailable)
    if (ipAddress === 'unknown' || ipAddress === '127.0.0.1') {
      return { country: null, city: null, region: null };
    }
    // In production, integrate with a geo-IP service like MaxMind or ip-api
    // For now, return null values (the IP is still tracked)
    return { country: null, city: null, region: null };
  } catch {
    return { country: null, city: null, region: null };
  }
}

async function sendSuspiciousLoginEmail(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  alertDetails: {
    alertType: string;
    browser: string;
    os: string;
    deviceType: string;
    ipAddress: string;
    geoCountry: string | null;
    geoCity: string | null;
    secureToken: string;
    loginTime: string;
  }
): Promise<boolean> {
  try {
    // Get user email from auth.users
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);

    if (userError || !userData?.user?.email) {
      console.error('Failed to get user email:', userError);
      return false;
    }

    const userEmail = userData.user.email;
    const userName = userData.user.user_metadata?.full_name || userData.user.user_metadata?.name || 'User';

    const baseUrl = Deno.env.get('SITE_URL') || Deno.env.get('PUBLIC_SITE_URL') || 'https://app.floraiq.io';
    const secureAccountUrl = `${baseUrl}/auth/secure-account?token=${alertDetails.secureToken}`;

    const locationStr = [alertDetails.geoCity, alertDetails.geoCountry]
      .filter(Boolean)
      .join(', ') || 'Unknown location';

    const deviceStr = `${alertDetails.browser || 'Unknown browser'} on ${alertDetails.os || 'Unknown OS'}`;

    // Send email via Supabase's built-in email (or a configured email service)
    // Using Supabase's auth.admin API or a custom SMTP integration
    const emailSubject = alertDetails.alertType === 'new_device_and_location'
      ? '🚨 Critical: New sign-in from unknown device and location'
      : alertDetails.alertType === 'new_device'
        ? '⚠️ New sign-in from an unrecognized device'
        : '⚠️ New sign-in from a new location';

    const emailBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
          <h2 style="color: #1a1a1a; margin-top: 0;">New Sign-in Detected</h2>
          <p style="color: #4a4a4a;">Hi ${userName},</p>
          <p style="color: #4a4a4a;">We noticed a new sign-in to your FloraIQ account:</p>

          <div style="background: white; border: 1px solid #e0e0e0; border-radius: 6px; padding: 16px; margin: 16px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; width: 120px;">Device:</td>
                <td style="padding: 8px 0; color: #1a1a1a; font-weight: 500;">${deviceStr}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Location:</td>
                <td style="padding: 8px 0; color: #1a1a1a; font-weight: 500;">${locationStr}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">IP Address:</td>
                <td style="padding: 8px 0; color: #1a1a1a; font-weight: 500;">${alertDetails.ipAddress}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Time:</td>
                <td style="padding: 8px 0; color: #1a1a1a; font-weight: 500;">${new Date(alertDetails.loginTime).toLocaleString()}</td>
              </tr>
            </table>
          </div>

          <p style="color: #4a4a4a;">If this was you, you can safely ignore this email.</p>

          <p style="color: #4a4a4a; font-weight: 600;">If this wasn't you, secure your account immediately:</p>

          <div style="text-align: center; margin: 24px 0;">
            <a href="${secureAccountUrl}"
               style="background: #dc2626; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
              Secure My Account
            </a>
          </div>

          <p style="color: #888; font-size: 13px;">This link expires in 24 hours. If you didn't make this request, someone may have access to your account.</p>
        </div>

        <p style="color: #888; font-size: 12px; text-align: center;">
          FloraIQ Security Team<br>
          This is an automated security notification.
        </p>
      </div>
    `;

    // Use Resend or similar email service if configured
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (resendApiKey) {
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'FloraIQ Security <security@floraiq.io>',
          to: [userEmail],
          subject: emailSubject,
          html: emailBody,
        }),
      });

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text();
        console.error('Failed to send email via Resend:', errorText);
        return false;
      }
      return true;
    }

    // Fallback: store the notification for the app to display
    console.warn('No email service configured (RESEND_API_KEY missing). Alert created but email not sent.');
    return false;
  } catch (error) {
    console.error('Error sending suspicious login email:', error);
    return false;
  }
}

Deno.serve(withZenProtection(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();
    const body = requestSchema.parse(rawBody);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get IP address
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    // Get geo location from IP
    const geo = await getGeoLocation(ipAddress);

    // Call the database function to check device and detect suspicious login
    const { data: result, error: rpcError } = await supabase.rpc('check_device_suspicious_login', {
      p_user_id: body.userId,
      p_device_fingerprint: body.fingerprint,
      p_device_type: body.deviceType || null,
      p_browser: body.browser || null,
      p_os: body.os || null,
      p_ip_address: ipAddress !== 'unknown' ? ipAddress : null,
      p_user_agent: body.userAgent || null,
      p_geo_country: geo.country,
      p_geo_city: geo.city,
    });

    if (rpcError) {
      console.error('RPC error:', rpcError);
      throw new Error(`Database error: ${rpcError.message}`);
    }

    // If suspicious login detected, send email notification
    if (result?.is_suspicious) {
      const emailSent = await sendSuspiciousLoginEmail(supabase, body.userId, {
        alertType: result.alert_type,
        browser: body.browser || 'Unknown',
        os: body.os || 'Unknown',
        deviceType: body.deviceType || 'Unknown',
        ipAddress,
        geoCountry: geo.country,
        geoCity: geo.city,
        secureToken: result.secure_token,
        loginTime: new Date().toISOString(),
      });

      // Update the alert with email sent status
      if (emailSent && result.alert_id) {
        await supabase
          .from('suspicious_login_alerts')
          .update({
            email_sent: true,
            email_sent_at: new Date().toISOString(),
          })
          .eq('id', result.alert_id);
      }

      return new Response(
        JSON.stringify({
          suspicious: true,
          alertType: result.alert_type,
          alertId: result.alert_id,
          deviceId: result.device_id,
          emailSent,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    return new Response(
      JSON.stringify({
        suspicious: false,
        deviceId: result?.device_id,
        isNewDevice: result?.is_new_device || false,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in detect-suspicious-login:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
}));
