/**
 * Request Password Reset
 * Generates password reset token and sends reset email
 */

import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { encode as base64Encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";

const requestResetSchema = z.object({
  email: z.string().email(),
  tenant_slug: z.string().min(1),
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
    const { email, tenant_slug } = requestResetSchema.parse(body);

    // Find tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, business_name, slug, status')
      .eq('slug', tenant_slug.toLowerCase())
      .eq('status', 'active')
      .maybeSingle();

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ error: 'Store not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find customer user
    const { data: customerUser, error: customerError } = await supabase
      .from('customer_users')
      .select('id, email, first_name, last_name')
      .eq('email', email.toLowerCase())
      .eq('tenant_id', tenant.id)
      .eq('status', 'active')
      .maybeSingle();

    // Always return success (prevent email enumeration)
    if (customerError || !customerUser) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'If an account exists with this email, a password reset link has been sent.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate secure token
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const token = base64Encode(tokenBytes.buffer)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
      .substring(0, 43);

    // Set expiration (24 hours)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Get IP and user agent from request
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Store reset token
    const { error: insertError } = await supabase
      .from('password_reset_tokens')
      .insert({
        customer_user_id: customerUser.id,
        tenant_id: tenant.id,
        token,
        email: email.toLowerCase(),
        expires_at: expiresAt.toISOString(),
        ip_address: ipAddress,
        user_agent: userAgent,
      });

    if (insertError) {
      console.error('Failed to create reset token:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create reset token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build reset URL
    const siteUrl = Deno.env.get('SITE_URL') || 'https://app.example.com';
    const resetUrl = `${siteUrl}/${tenant.slug}/customer/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

    const businessName = tenant.business_name || 'Our Store';
    const customerName = customerUser.first_name || 'Customer';

    // Email content
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
            <p>Hi ${customerName},</p>
            <p>We received a request to reset your password for your <strong>${businessName}</strong> account.</p>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Reset Password
              </a>
            </p>

            <p style="font-size: 12px; color: #666; margin-top: 30px;">
              Or copy and paste this link into your browser:<br>
              <a href="${resetUrl}" style="color: #667eea; word-break: break-all;">${resetUrl}</a>
            </p>

            <p style="font-size: 12px; color: #999; margin-top: 20px;">
              This link will expire in 24 hours. If you didn't request a password reset, please ignore this email or contact support if you have concerns.
            </p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #999;">
              For security reasons, this link can only be used once. If you need to reset your password again, please request a new link.
            </p>
          </div>
        </body>
      </html>
    `;

    const textContent = `
Reset Your Password

Hi ${customerName},

We received a request to reset your password for your ${businessName} account.

Click this link to reset your password:
${resetUrl}

This link will expire in 24 hours. If you didn't request a password reset, please ignore this email.
    `.trim();

    // Send email via Klaviyo if available
    const klaviyoApiKey = Deno.env.get('KLAVIYO_API_KEY');
    if (klaviyoApiKey) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-klaviyo-email`, {
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
            fromEmail: Deno.env.get('FROM_EMAIL') || 'noreply@example.com',
            fromName: businessName,
          }),
        });
      } catch (emailError) {
        console.error('Email sending error:', emailError);
      }
    } else {
      console.log('Password reset email (Klaviyo not configured):', {
        to: email,
        subject,
        resetUrl,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Request password reset error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to process password reset request',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

