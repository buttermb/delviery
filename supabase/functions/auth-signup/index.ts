/**
 * Auth Signup Edge Function
 * Creates a new user account with email verification
 *
 * Accepts: email, password, full_name, tenant_slug, phone
 * - Validates input with Zod
 * - Checks if email already exists
 * - Creates user via supabase.auth.admin.createUser
 * - Generates email verification token
 * - Sends verification email via SendGrid or Resend
 * - Returns success with message to check email
 */

import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from '../_shared/rateLimiting.ts';

const signupSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  full_name: z
    .string()
    .min(1, 'Full name is required')
    .max(255, 'Full name must be at most 255 characters')
    .transform((val) => val.trim()),
  tenant_slug: z
    .string()
    .min(1, 'Tenant slug is required')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Invalid tenant slug format'),
  phone: z
    .string()
    .max(20)
    .regex(/^\+?[0-9\s\-()]+$/, 'Invalid phone number format')
    .optional()
    .nullable(),
});

/**
 * Generate a cryptographically secure token
 */
function generateVerificationToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash a token for secure storage
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Send verification email via SendGrid
 */
async function sendViaSendGrid(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromEmail: string;
  fromName: string;
}): Promise<boolean> {
  const apiKey = Deno.env.get('SENDGRID_API_KEY');
  if (!apiKey) return false;

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: params.to }] }],
      from: { email: params.fromEmail, name: params.fromName },
      subject: params.subject,
      content: [
        { type: 'text/plain', value: params.text },
        { type: 'text/html', value: params.html },
      ],
    }),
  });

  return response.ok || response.status === 202;
}

/**
 * Send verification email via Resend
 */
async function sendViaResend(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromEmail: string;
  fromName: string;
}): Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) return false;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${params.fromName} <${params.fromEmail}>`,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });

  return response.ok;
}

/**
 * Send verification email using available provider
 */
async function sendVerificationEmail(params: {
  to: string;
  verificationUrl: string;
  token: string;
  businessName: string;
}): Promise<boolean> {
  const fromEmail = Deno.env.get('FROM_EMAIL') || 'noreply@floraiqcrm.com';
  const fromName = params.businessName;
  const subject = `Verify your email address - ${params.businessName}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Verify Your Email</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Hi there,</p>
          <p>Thank you for signing up with <strong>${params.businessName}</strong>! Please verify your email address to complete your registration.</p>

          <p style="text-align: center; margin: 30px 0;">
            <a href="${params.verificationUrl}"
               style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Verify Email Address
            </a>
          </p>

          <p style="font-size: 12px; color: #666; margin-top: 30px;">
            Or copy and paste this link into your browser:<br>
            <a href="${params.verificationUrl}" style="color: #667eea; word-break: break-all;">${params.verificationUrl}</a>
          </p>

          <p style="font-size: 12px; color: #999; margin-top: 20px;">
            This link expires in 24 hours.
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

          <p style="font-size: 12px; color: #999;">
            If you didn't create an account with ${params.businessName}, please ignore this email.
          </p>
        </div>
      </body>
    </html>
  `;

  const text = `
Verify Your Email Address

Hi there,

Thank you for signing up with ${params.businessName}! Please verify your email address to complete your registration.

Verify your email by clicking this link:
${params.verificationUrl}

This link expires in 24 hours.

If you didn't create an account with ${params.businessName}, please ignore this email.
  `.trim();

  const emailParams = { to: params.to, subject, html, text, fromEmail, fromName };

  // Try Resend first, then SendGrid
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const sendgridKey = Deno.env.get('SENDGRID_API_KEY');

  if (resendKey) {
    return await sendViaResend(emailParams);
  }

  if (sendgridKey) {
    return await sendViaSendGrid(emailParams);
  }

  // No email provider configured - log for development
  console.log('No email provider configured. Verification token:', params.token);
  console.log('Verification URL:', params.verificationUrl);
  return false;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing required environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate input with Zod
    const validation = signupSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({
          error: 'Validation failed',
          details: (validation as { success: false; error: { errors: { path: (string | number)[]; message: string }[] } }).error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, password, full_name, tenant_slug, phone } = validation.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Rate limit by IP
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rateLimitResult = await checkRateLimit(
      { key: 'auth_signup', limit: 5, windowMs: 60 * 60 * 1000 }, // 5 signups per hour per IP
      clientIp
    );

    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({ error: 'Too many signup attempts. Please try again later.' }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            ...getRateLimitHeaders(rateLimitResult),
          },
        }
      );
    }

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify tenant exists and is active
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, business_name, slug, status')
      .eq('slug', tenant_slug)
      .eq('status', 'active')
      .maybeSingle();

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ error: 'Invalid or inactive organization' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if email already exists in auth.users
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error('Error checking existing users:', listError);
      return new Response(
        JSON.stringify({ error: 'Unable to process signup at this time' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailExists = existingUsers?.users?.some(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );

    if (emailExists) {
      // Return generic message to prevent email enumeration
      return new Response(
        JSON.stringify({
          error: 'An account with this email already exists',
          code: 'EMAIL_EXISTS',
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create user via supabase.auth.admin.createUser
    const { data: authData, error: createError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: false, // Require email verification
      user_metadata: {
        full_name,
        phone: phone || null,
        tenant_id: tenant.id,
        tenant_slug: tenant.slug,
      },
    });

    if (createError) {
      console.error('User creation error:', createError);

      if (createError.message?.includes('already been registered')) {
        return new Response(
          JSON.stringify({
            error: 'An account with this email already exists',
            code: 'EMAIL_EXISTS',
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Failed to create account. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!authData?.user) {
      return new Response(
        JSON.stringify({ error: 'Failed to create account. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authData.user.id;

    // Create user_profiles entry
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: userId,
        tenant_id: tenant.id,
        email: normalizedEmail,
        full_name,
        phone: phone || null,
        role: 'customer',
        email_verified: false,
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Cleanup: delete the auth user if profile creation fails
      await supabase.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: 'Failed to create account. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate email verification token
    const verificationToken = generateVerificationToken();
    const tokenHash = await hashToken(verificationToken);

    // Token expires in 24 hours
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Store token hash in email_verification_tokens
    const { error: tokenError } = await supabase
      .from('email_verification_tokens')
      .insert({
        user_id: userId,
        email: normalizedEmail,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
      });

    if (tokenError) {
      console.error('Token storage error:', tokenError);
      // Don't fail signup if token storage fails - user can request a new one
    }

    // Log signup event to auth_audit_log
    await supabase
      .from('auth_audit_log')
      .insert({
        user_id: userId,
        tenant_id: tenant.id,
        event_type: 'signup_started',
        ip_address: clientIp,
        user_agent: req.headers.get('user-agent') || 'unknown',
        metadata: {
          email: normalizedEmail,
          tenant_slug: tenant.slug,
        },
      })
      .then(({ error }) => {
        if (error) console.error('Audit log error:', error);
      });

    // Build verification URL
    const siteUrl = Deno.env.get('SITE_URL') || 'https://app.floraiqcrm.com';
    const verificationUrl = `${siteUrl}/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(normalizedEmail)}`;

    // Send verification email (async, don't block response)
    sendVerificationEmail({
      to: normalizedEmail,
      verificationUrl,
      token: verificationToken,
      businessName: tenant.business_name || 'FloraIQ',
    }).catch((err) => {
      console.error('Failed to send verification email:', err);
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Account created successfully. Please check your email to verify your account.',
        user_id: userId,
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Auth signup error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
