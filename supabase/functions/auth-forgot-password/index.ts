/**
 * Auth Forgot Password Edge Function
 * Accepts email, generates secure reset token, stores hash in password_reset_tokens
 * with 1 hour expiry, sends reset email, always returns success for security.
 */

import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { withZenProtection } from '../_shared/zen-firewall.ts';
import { createLogger } from '../_shared/logger.ts';
import { checkRateLimit, RATE_LIMITS } from '../_shared/rateLimiting.ts';

const logger = createLogger('auth-forgot-password');

const forgotPasswordSchema = z.object({
  email: z.string().email(),
  tenantSlug: z.string().min(1),
});

/**
 * Generate a cryptographically secure URL-safe token
 */
function generateSecureToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hash a token using SHA-256 for storage
 * We store only the hash so a DB leak doesn't expose valid tokens
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

serve(withZenProtection(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Only accept POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const validationResult = forgotPasswordSchema.safeParse(body);

    if (!validationResult.success) {
      // Still return success to prevent email enumeration
      logger.warn('Invalid request body', { details: JSON.stringify((validationResult as { success: false; error: { errors: unknown[] } }).error.errors) });
      return new Response(
        JSON.stringify({
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, tenantSlug } = validationResult.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Rate limiting by IP
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    const rateLimitResult = await checkRateLimit(RATE_LIMITS.PASSWORD_RESET, clientIp);
    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded for password reset', { ip: clientIp });
      // Still return success to prevent enumeration via rate limit differences
      return new Response(
        JSON.stringify({
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role (needed to look up users and insert tokens)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find tenant by slug
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, business_name, slug')
      .eq('slug', tenantSlug.toLowerCase())
      .eq('status', 'active')
      .maybeSingle();

    if (tenantError || !tenant) {
      logger.info('Tenant not found for password reset', { tenantSlug });
      // Return success regardless
      return new Response(
        JSON.stringify({
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find customer user by email and tenant
    const { data: customerUser, error: customerError } = await supabase
      .from('customer_users')
      .select('id, email, first_name')
      .eq('email', normalizedEmail)
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .maybeSingle();

    if (customerError || !customerUser) {
      logger.info('Customer user not found for password reset (not exposing)', {
        email: normalizedEmail,
        tenantId: tenant.id,
      });
      // Return success regardless to prevent email enumeration
      return new Response(
        JSON.stringify({
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Invalidate any existing unused tokens for this user
    await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('customer_user_id', customerUser.id)
      .is('used_at', null);

    // Generate secure token
    const rawToken = generateSecureToken();
    const tokenHash = await hashToken(rawToken);

    // Set 1 hour expiry
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Store token hash in password_reset_tokens
    const { error: insertError } = await supabase
      .from('password_reset_tokens')
      .insert({
        customer_user_id: customerUser.id,
        tenant_id: tenant.id,
        token: tokenHash,
        email: normalizedEmail,
        expires_at: expiresAt.toISOString(),
        ip_address: clientIp,
        user_agent: userAgent,
      });

    if (insertError) {
      logger.error('Failed to store password reset token', { error: insertError.message });
      // Still return success
      return new Response(
        JSON.stringify({
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build reset URL with the raw token (not the hash)
    const siteUrl = Deno.env.get('SITE_URL') || 'https://app.example.com';
    const resetUrl = `${siteUrl}/shop/${tenant.slug}/reset-password?token=${rawToken}&email=${encodeURIComponent(normalizedEmail)}`;

    const businessName = tenant.business_name || 'Our Store';

    // Send reset email
    const subject = `Reset your password - ${businessName}`;
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Reset Your Password</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p>Hi${customerUser.first_name ? ` ${customerUser.first_name}` : ''},</p>
            <p>We received a request to reset the password for your <strong>${businessName}</strong> account.</p>

            <p style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}"
                 style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Reset Password
              </a>
            </p>

            <p style="font-size: 14px; color: #666;">
              This link will expire in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email.
            </p>

            <p style="font-size: 12px; color: #666; margin-top: 20px;">
              Or copy and paste this link into your browser:<br>
              <a href="${resetUrl}" style="color: #667eea; word-break: break-all;">${resetUrl}</a>
            </p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

            <p style="font-size: 12px; color: #999;">
              If you didn't request a password reset from ${businessName}, please ignore this email. Your password will remain unchanged.
            </p>
          </div>
        </body>
      </html>
    `;

    const textContent = `
Reset Your Password

Hi${customerUser.first_name ? ` ${customerUser.first_name}` : ''},

We received a request to reset the password for your ${businessName} account.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.

If you didn't request a password reset from ${businessName}, please ignore this email. Your password will remain unchanged.
    `.trim();

    // Send email via Klaviyo if available
    const klaviyoApiKey = Deno.env.get('KLAVIYO_API_KEY');
    if (klaviyoApiKey) {
      try {
        const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-klaviyo-email`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: normalizedEmail,
            subject,
            html: htmlContent,
            text: textContent,
            fromEmail: Deno.env.get('FROM_EMAIL') || 'noreply@example.com',
            fromName: businessName,
          }),
        });

        if (!emailResponse.ok) {
          logger.error('Failed to send password reset email via Klaviyo', {
            status: emailResponse.status.toString(),
          });
        } else {
          logger.info('Password reset email sent successfully', { email: normalizedEmail });
        }
      } catch (emailError: unknown) {
        logger.error('Email sending error', {
          error: emailError instanceof Error ? emailError.message : 'Unknown error',
        });
      }
    } else {
      // Log email for development
      logger.info('Password reset email (Klaviyo not configured)', {
        to: normalizedEmail,
        resetUrl,
      });
    }

    // Log event to audit_logs
    await supabase.from('audit_logs').insert({
      actor_id: customerUser.id,
      actor_type: 'system',
      action: 'password_reset_requested',
      resource_type: 'customer_user',
      resource_id: customerUser.id,
      tenant_id: tenant.id,
      changes: {
        email: normalizedEmail,
        requested_at: new Date().toISOString(),
      },
      ip_address: clientIp,
      user_agent: userAgent,
    });

    logger.info('Password reset token generated', {
      userId: customerUser.id,
      tenantId: tenant.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    logger.error('Forgot password error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Always return success to prevent information leakage
    return new Response(
      JSON.stringify({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}));
