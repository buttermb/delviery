import { createClient } from '../../_shared/deps.ts';
import type { SupabaseClient } from '../../_shared/deps.ts';
import { loginSchema } from '../validation.ts';
import { checkRateLimit, getRateLimitHeaders } from '../../_shared/rateLimiting.ts';
import { checkBruteForce, logAuthEvent, getClientIP, GENERIC_AUTH_ERROR, GENERIC_AUTH_DETAIL } from '../../_shared/bruteForceProtection.ts';
import type { CorsHeaders } from '../utils.ts';
import { createServiceClient, errorResponse } from '../utils.ts';

export async function handleLogin(
  req: Request,
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  corsHeaders: CorsHeaders,
): Promise<Response> {
  // Validate input with Zod
  const validationResult = loginSchema.safeParse(body);
  if (!validationResult.success) {
    const zodError = validationResult as { success: false; error: { errors: unknown[] } };
    return errorResponse(corsHeaders, 400, 'Validation failed', {
      details: zodError.error.errors,
    });
  }

  const { email, password, tenantSlug, rememberMe } = validationResult.data;

  // Extract client IP for rate limiting
  const clientIP = getClientIP(req);
  const userAgent = req.headers.get('user-agent') || 'unknown';

  // Brute force protection: Block IP after 10 failed attempts across ANY account in 1 hour
  const bruteForceResult = await checkBruteForce(clientIP);
  if (bruteForceResult.blocked) {
    await logAuthEvent({
      eventType: 'login_attempt',
      ipAddress: clientIP,
      email: email.toLowerCase(),
      success: false,
      failureReason: 'ip_blocked_brute_force',
      userAgent,
      metadata: { tenantSlug, failedAttempts: bruteForceResult.failedAttempts },
    });

    return errorResponse(corsHeaders, 401, GENERIC_AUTH_ERROR, {
      detail: GENERIC_AUTH_DETAIL,
    });
  }

  // Rate limiting: 5 attempts per 15 minutes per IP+email combo
  const rateLimitResult = await checkRateLimit(
    {
      key: 'tenant_login',
      limit: 5,
      windowMs: 15 * 60 * 1000,
    },
    `${clientIP}:${email.toLowerCase()}`
  );

  if (!rateLimitResult.allowed) {
    console.warn('[LOGIN] Rate limit exceeded', {
      clientIP,
      email: email.toLowerCase(),
      tenantSlug,
    });
    return new Response(
      JSON.stringify({
        error: 'Too many login attempts. Please try again later.',
        retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
      }),
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

  console.error('[LOGIN] Tenant admin login attempt:', { email, tenantSlug, clientIP });

  // Create a separate service role client for tenant lookup (bypasses RLS)
  const serviceClient = createServiceClient();

  console.error('Looking up tenant with slug:', tenantSlug.toLowerCase());

  // Get tenant by slug BEFORE authentication (using service role)
  const { data: tenant, error: tenantError } = await serviceClient
    .from('tenants')
    .select('*')
    .eq('slug', tenantSlug.toLowerCase())
    .maybeSingle();

  console.error('Tenant lookup result:', {
    found: !!tenant,
    tenantId: tenant?.id,
    ownerEmail: tenant?.owner_email,
    error: tenantError,
  });

  if (tenantError || !tenant) {
    console.error('Tenant lookup failed:', {
      slug: tenantSlug,
      error: tenantError,
      hasServiceKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    });
    return errorResponse(corsHeaders, 404, 'Tenant not found', {
      detail: 'No tenant exists with this slug. Please check the URL and try again.',
    });
  }

  console.error('Tenant found:', tenant.business_name, 'Owner:', tenant.owner_email);

  // Verify credentials with Supabase Auth
  console.error('Attempting authentication for:', email);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    console.error('Auth error:', {
      email,
      errorCode: authError.status,
      errorMessage: authError.message,
    });

    await logAuthEvent({
      eventType: 'login_attempt',
      ipAddress: clientIP,
      email: email.toLowerCase(),
      success: false,
      failureReason: 'invalid_credentials',
      userAgent,
      metadata: { tenantSlug },
    });

    return errorResponse(corsHeaders, 401, GENERIC_AUTH_ERROR, {
      detail: GENERIC_AUTH_DETAIL,
    });
  }

  if (!authData.user) {
    console.error('No user returned after authentication');
    await logAuthEvent({
      eventType: 'login_attempt',
      ipAddress: clientIP,
      email: email.toLowerCase(),
      success: false,
      failureReason: 'no_user_returned',
      userAgent,
      metadata: { tenantSlug },
    });
    return errorResponse(corsHeaders, 401, GENERIC_AUTH_ERROR, {
      detail: GENERIC_AUTH_DETAIL,
    });
  }

  console.error('Authentication successful for user:', authData.user.id);

  // Verify user has access to this tenant
  const isOwner = tenant.owner_email?.toLowerCase() === email.toLowerCase();
  console.error('Access check:', {
    email,
    tenantOwner: tenant.owner_email,
    isOwner,
  });

  let tenantUser = null;
  if (!isOwner) {
    console.error('User is not owner, checking tenant_users table');
    const { data: userCheck, error: userCheckError } = await serviceClient
      .from('tenant_users')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('tenant_id', tenant.id)
      .maybeSingle();

    console.error('Tenant user lookup:', {
      found: !!userCheck,
      error: userCheckError,
    });

    if (userCheckError) {
      console.error('Tenant user check error:', userCheckError);
    }

    tenantUser = userCheck;

    if (!tenantUser) {
      console.error('User not authorized for tenant:', {
        email,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
      });

      await logAuthEvent({
        eventType: 'login_attempt',
        ipAddress: clientIP,
        email: email.toLowerCase(),
        success: false,
        failureReason: 'not_authorized_for_tenant',
        userAgent,
        metadata: { tenantSlug, tenantId: tenant.id },
      });

      return errorResponse(corsHeaders, 403, 'You do not have access to this tenant', {
        detail: `The account ${email} is not authorized to access ${tenant.business_name}. Please contact your administrator or use the correct login credentials.`,
      });
    }

    console.error('User authorized via tenant_users:', tenantUser.role);
  } else {
    console.error('User authorized as tenant owner');
  }

  // Build admin object
  const admin = tenantUser ? {
    id: tenantUser.id,
    email: tenantUser.email,
    name: tenantUser.name,
    role: tenantUser.role,
    tenant_id: tenantUser.tenant_id,
    userId: authData.user.id,
  } : {
    id: authData.user.id,
    email: authData.user.email,
    name: tenant.owner_name,
    role: 'owner',
    tenant_id: tenant.id,
    userId: authData.user.id,
  };

  console.error('Login successful for:', email, 'tenant:', tenant.business_name);

  // Log successful login to auth_audit_log
  await logAuthEvent({
    eventType: 'login_attempt',
    ipAddress: clientIP,
    email: email.toLowerCase(),
    success: true,
    userAgent,
    metadata: { tenantSlug, tenantId: tenant.id },
  });

  // Session fixation protection: Invalidate any pre-existing sessions for this user
  try {
    await serviceClient
      .from('tenant_admin_sessions')
      .delete()
      .eq('user_id', authData.user.id);
    console.error('[SESSION_FIXATION] Previous sessions invalidated for user:', authData.user.id);
  } catch (sessionCleanupError) {
    console.warn('[SESSION_FIXATION] Failed to invalidate previous sessions:', sessionCleanupError);
  }

  // Invalidate any Supabase refresh tokens from prior sessions
  try {
    await supabase.auth.admin.signOut(authData.user.id, 'others');
    console.error('[SESSION_FIXATION] Other Supabase sessions invalidated for user:', authData.user.id);
  } catch (signOutError) {
    console.warn('[SESSION_FIXATION] Failed to invalidate other Supabase sessions:', signOutError);
  }

  // Prepare httpOnly cookie options
  const sessionDurationSeconds = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60;
  const cookieOptions = [
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${sessionDurationSeconds}`,
  ].join('; ');

  // Return user data with tenant context
  const response = new Response(
    JSON.stringify({
      user: authData.user,
      session: authData.session,
      admin,
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
      access_token: authData.session?.access_token,
      refresh_token: authData.session?.refresh_token,
    }),
    {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Set-Cookie': `tenant_access_token=${authData.session?.access_token}; ${cookieOptions}`,
      },
    }
  );

  // Add refresh token cookie
  response.headers.append('Set-Cookie', `tenant_refresh_token=${authData.session?.refresh_token}; ${cookieOptions}`);

  return response;
}
