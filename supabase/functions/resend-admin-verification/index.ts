/**
 * Resend Admin Verification Email
 * Generates a new verification link and sends it via Resend.
 * Called from the tenant admin VerifyEmailPage when clicking "Resend".
 */

import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';

const RequestSchema = z.object({
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

    // Authenticate the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { email, tenant_slug } = RequestSchema.parse(body);

    // Verify the caller owns this email
    if (user.email?.toLowerCase() !== email.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: 'Email mismatch' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Look up tenant user
    const { data: tenantUser, error: tuError } = await supabase
      .from('tenant_users')
      .select('id, name, tenant_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (tuError || !tenantUser) {
      return new Response(
        JSON.stringify({ error: 'Tenant user not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get tenant info
    const { data: tenant } = await supabase
      .from('tenants')
      .select('business_name')
      .eq('id', tenantUser.tenant_id)
      .maybeSingle();

    const businessName = tenant?.business_name || 'Your Store';
    const ownerName = tenantUser.name || 'there';
    const siteUrl = Deno.env.get('SITE_URL') || supabaseUrl;

    // Generate a fresh verification link
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email: email.toLowerCase(),
      options: {
        redirectTo: `${siteUrl}/${tenant_slug}/admin/verify-email`,
      },
    });

    if (linkError || !linkData) {
      console.error('[RESEND_VERIFICATION] Failed to generate link:', linkError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate verification link' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const verificationLink = linkData.properties.action_link;
    const deadlineDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // Send via the central email function
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('[RESEND_VERIFICATION] RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-klaviyo-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: email.toLowerCase(),
        subject: `Verify your email — ${businessName}`,
        fromName: businessName,
        html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;"><h2 style="margin-top:0;">Verify your email address</h2><p>Hi ${ownerName},</p><p>Please verify your email to secure your <strong>${businessName}</strong> account. You have until <strong>${deadlineDate}</strong>.</p><p style="margin:30px 0;"><a href="${verificationLink}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:600;">Verify Email</a></p><p style="font-size:13px;color:#666;">Or paste this link in your browser:<br><a href="${verificationLink}" style="color:#16a34a;word-break:break-all;">${verificationLink}</a></p><hr style="border:none;border-top:1px solid #eee;margin:30px 0;"><p style="font-size:12px;color:#999;">If you didn't request this, ignore this email.</p></body></html>`,
        text: `Hi ${ownerName},\n\nVerify your email for ${businessName} by visiting:\n${verificationLink}\n\nYou have until ${deadlineDate} to verify.\n\nIf you didn't request this, ignore this email.`,
      }),
    });

    if (!emailResponse.ok) {
      const errText = await emailResponse.text();
      console.error('[RESEND_VERIFICATION] Email send failed:', errText);
      return new Response(
        JSON.stringify({ error: 'Failed to send verification email' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update verification sent timestamp
    await supabase
      .from('tenant_users')
      .update({ email_verification_sent_at: new Date().toISOString() })
      .eq('id', tenantUser.id)
      .catch((err) => console.warn('[RESEND_VERIFICATION] timestamp update failed:', err));

    return new Response(
      JSON.stringify({ success: true, message: 'Verification email sent' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[RESEND_VERIFICATION] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
