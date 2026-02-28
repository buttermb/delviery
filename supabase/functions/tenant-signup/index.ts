import { serve, createClient, corsHeaders } from "../_shared/deps.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { checkRateLimit } from "../_shared/rateLimiting.ts";
import { signJWT } from "../_shared/jwt.ts";

// Generate slug from business name
function generateSlug(businessName: string): string {
  return businessName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Request validation schema
const TenantSignupSchema = z.object({
  email: z.string().email().min(1).max(255),
  password: z.string().min(8).max(255),
  business_name: z.string().min(1).max(255),
  owner_name: z.string().min(1).max(255),
  phone: z.string().max(20).optional(),
  state: z.string().max(100).optional(),
  industry: z.string().max(100).optional(),
  company_size: z.string().max(50).optional(),
  captchaToken: z.string().optional(), // Cloudflare Turnstile token
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract client IP for rate limiting
    const clientIP =
      req.headers.get('x-forwarded-for')?.split(',')[0] ||
      req.headers.get('cf-connecting-ip') ||
      req.headers.get('x-real-ip') ||
      'unknown';

    // Parse and validate request body
    const rawBody = await req.json();
    const body = TenantSignupSchema.parse(rawBody);
    const { email, password, business_name, owner_name, phone, state, industry, company_size, captchaToken } = body;

    // Rate limiting check (before any processing)
    const rateLimitResult = await checkRateLimit(
      {
        key: 'signup',
        limit: parseInt(Deno.env.get('RATE_LIMIT_MAX_SIGNUPS_PER_HOUR') || '3'),
        windowMs: 60 * 60 * 1000, // 1 hour
      },
      `${clientIP}:${email.toLowerCase()}`
    );

    if (!rateLimitResult.allowed) {
      console.log('[SIGNUP] Rate limit exceeded', { clientIP, email: email.toLowerCase() });
      return new Response(
        JSON.stringify({
          error: 'Too many signup attempts. Please try again later.',
          retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // CAPTCHA verification (if token provided)
    if (captchaToken) {
      const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
      if (turnstileSecret) {
        try {
          const captchaVerification = await fetch(
            'https://challenges.cloudflare.com/turnstile/v0/siteverify',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                secret: turnstileSecret,
                response: captchaToken,
                remoteip: clientIP,
              }),
            }
          );

          const captchaResult = await captchaVerification.json();

          if (!captchaResult.success) {
            console.warn('[SIGNUP] CAPTCHA verification failed', {
              email: email.toLowerCase(),
              errorCodes: captchaResult['error-codes'],
            });
            return new Response(
              JSON.stringify({ error: 'Security verification failed. Please try again.' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } catch (error) {
          console.error('[SIGNUP] CAPTCHA verification error', error);
          // Don't fail signup if CAPTCHA service is down, but log it
        }
      }
    } else {
      // CAPTCHA is required in production when TURNSTILE_SECRET_KEY is configured
      const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
      if (turnstileSecret) {
        console.warn('[SIGNUP] CAPTCHA required but not provided', { email: email.toLowerCase(), clientIP });
        return new Response(
          JSON.stringify({
            error: 'Security verification required',
            message: 'Please complete the security verification to continue.'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // In development (no TURNSTILE_SECRET_KEY), allow signup without CAPTCHA
      console.log('[SIGNUP] No CAPTCHA token provided (development mode)', { email: email.toLowerCase() });
    }

    console.log('[SIGNUP] Security checks passed', { email: email.toLowerCase(), clientIP });

    // Check if email already exists in Supabase Auth
    const { data: existingAuthUser } = await supabase.auth.admin.listUsers();
    const authUserExists = existingAuthUser?.users.some(
      (user) => user.email?.toLowerCase() === email.toLowerCase()
    );

    if (authUserExists) {
      return new Response(
        JSON.stringify({
          error: 'An account with this email already exists. Please try logging in or use a different email address.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if email already exists in tenant_users
    const { data: existingUser } = await supabase
      .from('tenant_users')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'An account with this email already exists' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cross-table check: Verify email is not registered as a customer account
    const { data: customerUserExists } = await supabase
      .from('customer_users')
      .select('id, tenant_id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (customerUserExists) {
      return new Response(
        JSON.stringify({
          error: 'This email is registered as a customer account',
          message: 'This email is registered as a customer account. Please use the customer login or use a different email for tenant signup.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique slug
    let slug = generateSlug(business_name);
    let slugExists = true;
    let attempts = 0;
    while (slugExists && attempts < 10) {
      const { count } = await supabase
        .from('tenants')
        .select('id', { count: 'exact', head: true })
        .eq('slug', slug);

      if (count === 0) {
        slugExists = false;
      } else {
        slug = `${generateSlug(business_name)}-${Date.now()}`;
        attempts++;
      }
    }

    // If still exists after 10 attempts, use UUID fallback to ensure uniqueness
    if (slugExists) {
      const baseSlug = generateSlug(business_name);
      // Generate UUID and take first 8 characters for uniqueness
      const uuidSuffix = crypto.randomUUID().split('-')[0];
      slug = `${baseSlug}-${uuidSuffix}`;

      // Log fallback usage for monitoring
      console.warn('Slug generation fallback used:', {
        business_name,
        original_slug: baseSlug,
        final_slug: slug,
        attempts,
      });
    }

    // Create Supabase Auth user (must be done before atomic function)
    // Auto-confirm email for immediate access (B2B SaaS standard practice)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.toLowerCase(),
      password: password,
      email_confirm: true, // ✅ Auto-confirm for immediate login
      user_metadata: {
        name: owner_name,
        business_name: business_name,
        signup_date: new Date().toISOString(),
      },
    });

    if (authError || !authData.user) {
      console.error('[SIGNUP] Auth user creation error:', authError);
      return new Response(
        JSON.stringify({ error: authError?.message || 'Failed to create user account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[SIGNUP] Auth user created', { userId: authData.user.id });

    // Generate Supabase session for immediate login
    // Use anon client to sign in (admin client can't generate sessions)
    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
      email: email.toLowerCase(),
      password: password,
    });

    if (signInError || !signInData.session) {
      console.error('[SIGNUP] Failed to generate session', signInError);
      // Continue with signup but warn about login requirement
      console.warn('[SIGNUP] Auto-login failed, user will need to log in manually');
    } else {
      console.log('[SIGNUP] Supabase session generated successfully');
    }

    // Call atomic function to create all database records in single transaction
    console.log('[SIGNUP] Creating tenant records atomically', { slug });

    const { data: atomicResult, error: atomicError } = await supabase
      .rpc('create_tenant_atomic', {
        p_auth_user_id: authData.user.id,
        p_email: email.toLowerCase(),
        p_business_name: business_name,
        p_owner_name: owner_name,
        p_phone: phone || null,
        p_state: state || null,
        p_industry: industry || null,
        p_company_size: company_size || null,
        p_slug: slug,
        p_plan: 'free', // Default to free tier - users get credits immediately (spec: new signups = free with 10K credits)
      });

    if (atomicError) {
      console.error('[SIGNUP] Atomic creation failed', {
        error: atomicError,
        slug,
        userId: authData.user.id
      });

      // Rollback: Delete auth user since DB creation failed
      try {
        await supabase.auth.admin.deleteUser(authData.user.id);
        console.log('[SIGNUP] Rolled back auth user creation', { userId: authData.user.id });
      } catch (rollbackError) {
        console.error('[SIGNUP] Rollback failed', { error: rollbackError });
      }

      return new Response(
        JSON.stringify({
          error: 'Failed to create tenant. Please try again.',
          details: atomicError.message,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[SIGNUP] Tenant created atomically', {
      tenantId: atomicResult.tenant_id,
      slug
    });

    // Extract tenant and tenant_user from atomic result
    const tenant = atomicResult.tenant;
    const tenantUser = atomicResult.tenant_user;

    // Generate JWT tokens for auto-login using secure HMAC-SHA256 signing
    const accessToken = await signJWT(
      {
        user_id: tenantUser.id,
        email: tenantUser.email,
        name: tenantUser.name,
        role: tenantUser.role,
        tenant_id: tenant.id,
        tenant_slug: tenant.slug,
      },
      7 * 24 * 60 * 60 // 7 days
    );

    const refreshToken = await signJWT(
      {
        user_id: tenantUser.id,
        tenant_id: tenant.id,
        type: 'refresh',
      },
      30 * 24 * 60 * 60 // 30 days
    );

    // Set httpOnly cookies for tokens (XSS protection)
    const accessCookie = [
      `tenant_access_token=${accessToken}`,
      `Max-Age=${7 * 24 * 60 * 60}`, // 7 days in seconds
      'HttpOnly',
      'Secure',
      'SameSite=Strict',
      'Path=/',
    ].join('; ');

    const refreshCookie = [
      `tenant_refresh_token=${refreshToken}`,
      `Max-Age=${30 * 24 * 60 * 60}`, // 30 days in seconds
      'HttpOnly',
      'Secure',
      'SameSite=Strict',
      'Path=/',
    ].join('; ');

    // Return success response WITHOUT tokens in body (cookies set via headers)
    const response = new Response(
      JSON.stringify({
        success: true,
        tenant: {
          id: tenant.id,
          business_name: tenant.business_name,
          slug: tenant.slug,
          owner_email: tenant.owner_email,
          subscription_plan: tenant.subscription_plan,
          subscription_status: tenant.subscription_status,
          limits: tenant.limits,
          usage: tenant.usage,
          features: tenant.features,
        },
        user: {
          id: tenantUser.id,
          email: tenantUser.email,
          name: tenantUser.name,
          role: tenantUser.role,
          tenant_id: tenantUser.tenant_id,
        },
        // Include Supabase session tokens for immediate authentication
        session: signInData?.session ? {
          access_token: signInData.session.access_token,
          refresh_token: signInData.session.refresh_token,
        } : null,
        // Explicitly signal if auto-login failed so frontend can redirect to login page
        auto_login_failed: !signInData?.session,
        auto_login_error: signInError?.message,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Set-Cookie': accessCookie,
        },
      }
    );

    // Add second cookie (Set-Cookie can be set multiple times)
    response.headers.append('Set-Cookie', refreshCookie);

    // Background tasks (don't await - run asynchronously)
    // These don't block the response, improving signup performance
    Promise.allSettled([
      // Send email verification link (hybrid approach: immediate access, 7-day deadline)
      (async () => {
        try {
          // Generate email verification link via Supabase Auth
          const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
            type: 'signup',
            email: email.toLowerCase(),
            options: {
              redirectTo: `${Deno.env.get('SITE_URL') || Deno.env.get('SUPABASE_URL') || ''}/${tenant.slug}/admin/verify-email`,
            },
          });

          if (linkError || !linkData) {
            console.warn('[SIGNUP] Failed to generate verification link (non-blocking)', linkError);
            return;
          }

          // Update tenant_user record with verification sent timestamp
          await supabase
            .from('tenant_users')
            .update({
              email_verification_sent_at: new Date().toISOString(),
            })
            .eq('id', tenantUser.id)
            .catch((err) => {
              console.warn('[SIGNUP] Failed to update verification timestamp (non-blocking)', err);
            });

          // Send verification email via Klaviyo or Supabase email
          const siteUrl = Deno.env.get('SITE_URL') || Deno.env.get('SUPABASE_URL') || '';
          const klaviyoApiKey = Deno.env.get('KLAVIYO_API_KEY');

          if (klaviyoApiKey) {
            // Send via Klaviyo (custom template)
            const emailUrl = `${siteUrl}/functions/v1/send-klaviyo-email`;
            await fetch(emailUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                to: email.toLowerCase(),
                template: 'email-verification',
                data: {
                  business_name,
                  owner_name,
                  verification_link: linkData.properties.action_link,
                  verification_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                  dashboard_url: `${siteUrl}/${tenant.slug}/admin/dashboard`,
                },
              }),
            }).catch((err) => {
              console.warn('[SIGNUP] Verification email failed (non-blocking)', err);
            });
          } else {
            // Fallback: Supabase will send verification email automatically
            // since email_confirm is false
            console.log('[SIGNUP] Verification email will be sent by Supabase Auth');
          }
        } catch (error) {
          console.warn('[SIGNUP] Email verification error (non-blocking)', error);
        }
      })(),

      // Send welcome email (if email service configured)
      (async () => {
        try {
          const siteUrl = Deno.env.get('SITE_URL') || Deno.env.get('SUPABASE_URL') || '';
          const welcomeEmailUrl = `${siteUrl}/functions/v1/send-klaviyo-email`;

          // Only send if email service is configured
          const klaviyoApiKey = Deno.env.get('KLAVIYO_API_KEY');
          if (klaviyoApiKey) {
            await fetch(welcomeEmailUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                to: email.toLowerCase(),
                template: 'welcome',
                data: {
                  business_name,
                  owner_name,
                  tenant_slug: tenant.slug,
                  dashboard_url: `${siteUrl}/${tenant.slug}/admin/dashboard`,
                  // Credit info for welcome email
                  initial_credits: atomicResult.initial_credits || 10000,
                  plan: tenant.subscription_plan || 'free',
                  is_free_tier: tenant.is_free_tier !== false,
                },
              }),
            }).catch((err) => {
              console.warn('[SIGNUP] Welcome email failed (non-blocking)', err);
            });
          }
        } catch (error) {
          console.warn('[SIGNUP] Welcome email error (non-blocking)', error);
        }
      })(),

      // Track signup analytics event (if analytics configured)
      (async () => {
        try {
          // This would integrate with your analytics service
          // Example: PostHog, Mixpanel, Amplitude, etc.
          console.log('[SIGNUP] Analytics event: tenant_signup', {
            tenant_id: tenant.id,
            tenant_slug: tenant.slug,
            email: email.toLowerCase(),
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.warn('[SIGNUP] Analytics tracking error (non-blocking)', error);
        }
      })(),
    ]).catch((error) => {
      // Log but don't fail signup
      console.warn('[SIGNUP] Background tasks error (non-blocking)', error);
    });

    return response;

  } catch (error: unknown) {
    console.error('Error in tenant-signup:', error);

    // Zod validation errors
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({
          error: 'Validation failed',
          details: error.errors,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Generic error
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

