import { serve, createClient, corsHeaders } from "../_shared/deps.ts";
import { z } from "../_shared/deps.ts";
import { checkRateLimit } from "../_shared/rateLimiting.ts";
import { TenantSignupSchema } from './validation.ts';
import { verifyCaptcha } from './captcha.ts';
import { checkDuplicateEmail, createAuthUser, generateSession } from './auth.ts';
import { generateUniqueSlug, createTenantAtomic, setupFreeTier } from './tenant-creation.ts';
import { generateTokens, buildSuccessResponse } from './response-builder.ts';
import { runBackgroundTasks } from './background-tasks.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) throw new Error('Missing environment variables');
    if (!supabaseAnonKey) throw new Error('Missing SUPABASE_ANON_KEY environment variable');

    const supabase = createClient(supabaseUrl, supabaseKey);

    const clientIP =
      req.headers.get('x-forwarded-for')?.split(',')[0] ||
      req.headers.get('cf-connecting-ip') ||
      req.headers.get('x-real-ip') ||
      'unknown';

    const rawBody = await req.json();
    const body = TenantSignupSchema.parse(rawBody);
    const { email, password, business_name, owner_name, phone, state, industry, company_size, captchaToken } = body;

    // Rate limiting
    const rateLimitResult = await checkRateLimit(
      { key: 'signup', limit: parseInt(Deno.env.get('RATE_LIMIT_MAX_SIGNUPS_PER_HOUR') || '3'), windowMs: 60 * 60 * 1000 },
      `${clientIP}:${email.toLowerCase()}`
    );
    if (!rateLimitResult.allowed) {
      console.error('[SIGNUP] Rate limit exceeded', { clientIP, email: email.toLowerCase() });
      return new Response(
        JSON.stringify({ error: 'Too many signup attempts. Please try again later.', retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000) }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CAPTCHA verification
    const captchaResult = await verifyCaptcha(captchaToken, email, clientIP);
    if (!captchaResult.passed && captchaResult.response) return captchaResult.response;

    console.error('[SIGNUP] Security checks passed', { email: email.toLowerCase(), clientIP });

    // Check for duplicate emails
    const duplicateResponse = await checkDuplicateEmail(supabase, email);
    if (duplicateResponse) return duplicateResponse;

    // Generate slug, create auth user, generate session
    const slug = await generateUniqueSlug(supabase, business_name);
    const { user: authUser, error: authErr } = await createAuthUser(supabase, email, password, owner_name, business_name);
    if (authErr) return authErr;

    const { session: signInSession } = await generateSession(supabaseUrl, supabaseAnonKey, email, password);

    // Create tenant records atomically
    const authUserId = (authUser as Record<string, unknown>).id as string;
    const { result: atomicResult, error: tenantErr } = await createTenantAtomic(supabase, {
      authUserId, email, businessName: business_name, ownerName: owner_name,
      phone, state, industry, companySize: company_size, slug,
    });
    if (tenantErr) return tenantErr;

    const tenant = (atomicResult as Record<string, unknown>).tenant as Record<string, unknown>;
    const tenantUser = (atomicResult as Record<string, unknown>).tenant_user as Record<string, unknown>;

    await setupFreeTier(supabase, tenant.id as string);

    // Build response with tokens and cookies
    const tokens = await generateTokens(tenant, tenantUser);
    const response = buildSuccessResponse(
      { tenant, tenantUser, signInSession: signInSession as Record<string, unknown> | null },
      tokens
    );

    // Background tasks (don't await)
    runBackgroundTasks(supabase, {
      supabaseKey, email, ownerName: owner_name, businessName: business_name,
      tenantId: tenant.id as string, tenantSlug: tenant.slug as string,
      tenantUserId: tenantUser.id as string, authUserId,
    });

    return response;

  } catch (error: unknown) {
    console.error('Error in tenant-signup:', error);
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
