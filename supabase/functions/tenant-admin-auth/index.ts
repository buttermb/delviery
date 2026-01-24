// @ts-nocheck - Disable type checking for Deno/Supabase client compatibility
// Edge Function: tenant-admin-auth
import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { secureHeadersMiddleware } from '../_shared/secure-headers.ts';
import { loginSchema, refreshSchema, setupPasswordSchema } from './validation.ts';
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from '../_shared/rateLimiting.ts';
import { checkBruteForce, logAuthEvent, getClientIP, GENERIC_AUTH_ERROR, GENERIC_AUTH_DETAIL } from '../_shared/bruteForceProtection.ts';

serve(secureHeadersMiddleware(async (req) => {
  // Get origin from request for CORS (required when credentials are included)
  const origin = req.headers.get('origin');
  const hasCredentials = req.headers.get('cookie') || req.headers.get('authorization');

  // When credentials are included, must return specific origin, not wildcard
  // Also need to validate origin against allowed origins for security
  const allowedOrigins: (string | RegExp)[] = [
    'https://floraiqcrm.com',
    'https://www.floraiqcrm.com',
    'http://localhost:8080',
    'http://localhost:5173',
    'http://localhost:3000',
    // Lovable preview domains
    /^https:\/\/[a-f0-9-]+\.lovableproject\.com$/,
    /^https:\/\/[a-f0-9-]+\.lovable\.app$/,
    'https://lovable.app',
    'https://lovable.app',
    'https://lovable.dev',
    // Vercel domains
    /^https:\/\/.*\.vercel\.app$/,
  ];

  const isOriginAllowed = (checkOrigin: string | null): boolean => {
    if (!checkOrigin) return false;
    return allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return checkOrigin === allowed;
      }
      return allowed.test(checkOrigin);
    });
  };

  // Determine the origin to use in response
  const requestOrigin = origin && isOriginAllowed(origin) ? origin : null;

  // Reject requests with credentials from non-allowed origins
  if (hasCredentials && !requestOrigin) {
    return new Response(
      JSON.stringify({ error: 'Origin not allowed' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  const corsHeadersWithOrigin: Record<string, string> = {
    'Access-Control-Allow-Origin': requestOrigin || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cookie',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  };

  // Add credentials header when we have a valid origin
  if (requestOrigin) {
    corsHeadersWithOrigin['Access-Control-Allow-Credentials'] = 'true';
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeadersWithOrigin });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Only parse JSON body for actions that need it
    let requestBody: any = {};
    if (action !== 'verify' && action !== 'logout' && req.method === 'POST') {
      try {
        requestBody = await req.json();
      } catch (e) {
        console.error('Failed to parse JSON body:', e);
        requestBody = {};
      }
    }

    if (action === 'login') {
      // Validate input with Zod
      const validationResult = loginSchema.safeParse(requestBody);
      if (!validationResult.success) {
        const zodError = validationResult as { success: false; error: { errors: unknown[] } };
        return new Response(
          JSON.stringify({
            error: 'Validation failed',
            details: zodError.error.errors
          }),
          { status: 400, headers: { ...corsHeadersWithOrigin, 'Content-Type': 'application/json' } }
        );
      }

      const { email, password, tenantSlug } = validationResult.data;

      // Extract client IP for rate limiting
      const clientIP = getClientIP(req);
      const userAgent = req.headers.get('user-agent') || 'unknown';

      // Brute force protection: Block IP after 10 failed attempts across ANY account in 1 hour
      const bruteForceResult = await checkBruteForce(clientIP);
      if (bruteForceResult.blocked) {
        // Log the blocked attempt
        await logAuthEvent({
          eventType: 'login_attempt',
          ipAddress: clientIP,
          email: email.toLowerCase(),
          success: false,
          failureReason: 'ip_blocked_brute_force',
          userAgent,
          metadata: { tenantSlug, failedAttempts: bruteForceResult.failedAttempts },
        });

        // Return generic error - do NOT reveal the IP is blocked
        return new Response(
          JSON.stringify({
            error: GENERIC_AUTH_ERROR,
            detail: GENERIC_AUTH_DETAIL,
          }),
          { status: 401, headers: { ...corsHeadersWithOrigin, 'Content-Type': 'application/json' } }
        );
      }

      // Rate limiting: 5 attempts per 15 minutes per IP+email combo
      const rateLimitResult = await checkRateLimit(
        {
          key: 'tenant_login',
          limit: 5,
          windowMs: 15 * 60 * 1000, // 15 minutes
        },
        `${clientIP}:${email.toLowerCase()}`
      );

      if (!rateLimitResult.allowed) {
        console.warn('[LOGIN] Rate limit exceeded', {
          clientIP,
          email: email.toLowerCase(),
          tenantSlug
        });
        return new Response(
          JSON.stringify({
            error: 'Too many login attempts. Please try again later.',
            retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
          }),
          {
            status: 429,
            headers: {
              ...corsHeadersWithOrigin,
              'Content-Type': 'application/json',
              ...getRateLimitHeaders(rateLimitResult),
            },
          }
        );
      }

      console.log('[LOGIN] Tenant admin login attempt:', { email, tenantSlug, clientIP });

      // Create a separate service role client for tenant lookup (bypasses RLS)
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      console.log('Looking up tenant with slug:', tenantSlug.toLowerCase());

      // Get tenant by slug BEFORE authentication (using service role)
      const { data: tenant, error: tenantError } = await serviceClient
        .from('tenants')
        .select('*')
        .eq('slug', tenantSlug.toLowerCase())
        .maybeSingle();

      console.log('Tenant lookup result:', {
        found: !!tenant,
        tenantId: tenant?.id,
        ownerEmail: tenant?.owner_email,
        error: tenantError
      });

      if (tenantError || !tenant) {
        console.error('Tenant lookup failed:', {
          slug: tenantSlug,
          error: tenantError,
          hasServiceKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        });
        return new Response(
          JSON.stringify({
            error: 'Tenant not found',
            detail: 'No tenant exists with this slug. Please check the URL and try again.'
          }),
          { status: 404, headers: { ...corsHeadersWithOrigin, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Tenant found:', tenant.business_name, 'Owner:', tenant.owner_email);

      // Verify credentials with Supabase Auth
      console.log('Attempting authentication for:', email);
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.error('Auth error:', {
          email,
          errorCode: authError.status,
          errorMessage: authError.message
        });

        // Log failed login attempt to auth_audit_log for brute force tracking
        await logAuthEvent({
          eventType: 'login_attempt',
          ipAddress: clientIP,
          email: email.toLowerCase(),
          success: false,
          failureReason: 'invalid_credentials',
          userAgent,
          metadata: { tenantSlug },
        });

        return new Response(
          JSON.stringify({
            error: GENERIC_AUTH_ERROR,
            detail: GENERIC_AUTH_DETAIL,
          }),
          { status: 401, headers: { ...corsHeadersWithOrigin, 'Content-Type': 'application/json' } }
        );
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
        return new Response(
          JSON.stringify({ error: GENERIC_AUTH_ERROR, detail: GENERIC_AUTH_DETAIL }),
          { status: 401, headers: { ...corsHeadersWithOrigin, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Authentication successful for user:', authData.user.id);

      // Verify user has access to this tenant (check if email matches tenant owner or is a tenant user)
      const isOwner = tenant.owner_email?.toLowerCase() === email.toLowerCase();
      console.log('Access check:', {
        email,
        tenantOwner: tenant.owner_email,
        isOwner
      });

      let tenantUser = null;
      if (!isOwner) {
        console.log('User is not owner, checking tenant_users table');
        const { data: userCheck, error: userCheckError } = await serviceClient
          .from('tenant_users')
          .select('*')
          .eq('email', email.toLowerCase())
          .eq('tenant_id', tenant.id)
          .maybeSingle();

        console.log('Tenant user lookup:', {
          found: !!userCheck,
          error: userCheckError
        });

        if (userCheckError) {
          console.error('Tenant user check error:', userCheckError);
        }

        tenantUser = userCheck;

        if (!tenantUser) {
          console.error('User not authorized for tenant:', {
            email,
            tenantId: tenant.id,
            tenantSlug: tenant.slug
          });

          // Log as a failed attempt (valid credentials but wrong tenant)
          await logAuthEvent({
            eventType: 'login_attempt',
            ipAddress: clientIP,
            email: email.toLowerCase(),
            success: false,
            failureReason: 'not_authorized_for_tenant',
            userAgent,
            metadata: { tenantSlug, tenantId: tenant.id },
          });

          return new Response(
            JSON.stringify({
              error: 'You do not have access to this tenant',
              detail: `The account ${email} is not authorized to access ${tenant.business_name}. Please contact your administrator or use the correct login credentials.`
            }),
            { status: 403, headers: { ...corsHeadersWithOrigin, 'Content-Type': 'application/json' } }
          );
        }

        console.log('User authorized via tenant_users:', tenantUser.role);
      } else {
        console.log('User authorized as tenant owner');
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

      console.log('Login successful for:', email, 'tenant:', tenant.business_name);

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
      // This ensures a fresh session state on authentication, preventing session hijacking
      try {
        await serviceClient
          .from('tenant_admin_sessions')
          .delete()
          .eq('user_id', authData.user.id);
        console.log('[SESSION_FIXATION] Previous sessions invalidated for user:', authData.user.id);
      } catch (sessionCleanupError) {
        // Log but don't block login - session cleanup is best-effort
        console.warn('[SESSION_FIXATION] Failed to invalidate previous sessions:', sessionCleanupError);
      }

      // Invalidate any Supabase refresh tokens from prior sessions by signing out
      // other sessions. The current session just created by signInWithPassword is preserved.
      try {
        await supabase.auth.admin.signOut(authData.user.id, 'others');
        console.log('[SESSION_FIXATION] Other Supabase sessions invalidated for user:', authData.user.id);
      } catch (signOutError) {
        // Log but don't block - this is a supplementary protection
        console.warn('[SESSION_FIXATION] Failed to invalidate other Supabase sessions:', signOutError);
      }

      // Prepare httpOnly cookie options
      const cookieOptions = [
        'HttpOnly',
        'Secure',
        'SameSite=Strict',
        'Path=/',
        `Max-Age=${7 * 24 * 60 * 60}` // 7 days
      ].join('; ');

      // Return user data with tenant context (including limits and usage)
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
            ...corsHeadersWithOrigin,
            'Content-Type': 'application/json',
            'Set-Cookie': `tenant_access_token=${authData.session?.access_token}; ${cookieOptions}`,
          }
        }
      );

      // Add refresh token cookie
      response.headers.append('Set-Cookie', `tenant_refresh_token=${authData.session?.refresh_token}; ${cookieOptions}`);

      return response;
    }

    if (action === 'refresh') {
      // STEP 1: Get refresh token from request body or cookie (fallback)
      let refresh_token: string | null = null;

      // Try to get from request body first
      const validationResult = refreshSchema.safeParse(requestBody);
      if (validationResult.success) {
        refresh_token = validationResult.data.refresh_token;
      }

      // Fallback: try to get from httpOnly cookie
      if (!refresh_token) {
        const cookieHeader = req.headers.get('Cookie');
        if (cookieHeader) {
          const cookies = cookieHeader.split(';').map(c => c.trim());
          const refreshTokenCookie = cookies.find(c => c.startsWith('tenant_refresh_token='));
          if (refreshTokenCookie) {
            refresh_token = refreshTokenCookie.split('=')[1];
          }
        }
      }

      // STEP 2: Validate refresh token is present and not empty/invalid
      if (!refresh_token ||
          refresh_token === 'undefined' ||
          refresh_token === 'null' ||
          refresh_token.trim() === '' ||
          refresh_token.length < 10) {
        console.error('Token refresh error: No valid refresh token provided', {
          hasToken: !!refresh_token,
          tokenLength: refresh_token?.length,
          isUndefinedString: refresh_token === 'undefined',
          isNullString: refresh_token === 'null',
        });

        return new Response(
          JSON.stringify({
            error: 'Refresh token is required',
            reason: 'missing_refresh_token',
            details: 'No valid refresh token was provided in the request body or cookies'
          }),
          { status: 400, headers: { ...corsHeadersWithOrigin, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Attempting token refresh', {
        tokenLength: refresh_token.length,
        tokenPrefix: refresh_token.substring(0, 10) + '...',
      });

      // STEP 3: Attempt to refresh the session
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token,
      });

      if (error || !data.session) {
        console.error('Token refresh error:', error);
        console.log('Refresh request details:', {
          hasRefreshToken: !!refresh_token,
          tokenLength: refresh_token?.length,
          errorMsg: error?.message,
          errorCode: error?.status,
          hasSession: !!data?.session,
        });

        return new Response(
          JSON.stringify({
            error: 'Failed to refresh token',
            reason: error?.message?.includes('Invalid Refresh Token') ? 'invalid_refresh_token' : 'refresh_failed',
            details: error?.message || 'Session refresh returned no data'
          }),
          { status: 401, headers: { ...corsHeadersWithOrigin, 'Content-Type': 'application/json' } }
        );
      }

      // STEP 4: Prepare httpOnly cookie options
      const cookieOptions = [
        'HttpOnly',
        'Secure',
        'SameSite=Lax', // Changed from Strict to Lax for better cross-site compatibility
        'Path=/',
        `Max-Age=${7 * 24 * 60 * 60}` // 7 days
      ].join('; ');

      // Use longer expiry for refresh token cookie
      const refreshCookieOptions = [
        'HttpOnly',
        'Secure',
        'SameSite=Lax',
        'Path=/',
        `Max-Age=${30 * 24 * 60 * 60}` // 30 days for refresh token
      ].join('; ');

      console.log('Token refresh successful', {
        userId: data.user?.id,
        expiresIn: data.session?.expires_in,
      });

      // STEP 5: Build response with new tokens and cookies
      const response = new Response(
        JSON.stringify({
          user: data.user,
          session: data.session,
          access_token: data.session?.access_token,
          refresh_token: data.session?.refresh_token,
          expires_in: data.session?.expires_in,
        }),
        {
          status: 200,
          headers: {
            ...corsHeadersWithOrigin,
            'Content-Type': 'application/json',
            'Set-Cookie': `tenant_access_token=${data.session?.access_token}; ${cookieOptions}`,
          }
        }
      );

      // Add refresh token cookie with longer expiry
      response.headers.append('Set-Cookie', `tenant_refresh_token=${data.session?.refresh_token}; ${refreshCookieOptions}`);

      return response;
    }

    if (action === "logout") {
      // Clear session if token provided (backwards compatibility)
      const authHeader = req.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "");
        await supabase.from("tenant_admin_sessions").delete().eq("token", token);
      }

      // Clear httpOnly cookies by setting them with expired Max-Age
      const clearAccessCookie = [
        'tenant_access_token=',
        'Max-Age=0',
        'HttpOnly',
        'Secure',
        'SameSite=Strict',
        'Path=/',
      ].join('; ');

      const clearRefreshCookie = [
        'tenant_refresh_token=',
        'Max-Age=0',
        'HttpOnly',
        'Secure',
        'SameSite=Strict',
        'Path=/',
      ].join('; ');

      const response = new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: {
            ...corsHeadersWithOrigin,
            "Content-Type": "application/json",
            "Set-Cookie": clearAccessCookie,
          },
        }
      );

      // Add second cookie
      response.headers.append("Set-Cookie", clearRefreshCookie);

      return response;
    }

    if (action === "setup-password") {
      // Setup password for newly created tenant user (during signup)
      const rawBody = await req.json();

      // Validate input with Zod
      const validationResult = setupPasswordSchema.safeParse(rawBody);
      if (!validationResult.success) {
        const zodError = validationResult as { success: false; error: { errors: unknown[] } };
        return new Response(
          JSON.stringify({
            error: 'Validation failed',
            details: zodError.error.errors
          }),
          { status: 400, headers: { ...corsHeadersWithOrigin, 'Content-Type': 'application/json' } }
        );
      }

      const { email, password, tenantSlug } = validationResult.data;

      // Find tenant by slug
      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .select("*")
        .eq("slug", tenantSlug.toLowerCase())
        .maybeSingle();

      if (tenantError || !tenant) {
        return new Response(
          JSON.stringify({ error: "Tenant not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find tenant admin user (can be pending status)
      const { data: adminUser, error: adminError } = await supabase
        .from("tenant_users")
        .select("*")
        .eq("email", email.toLowerCase())
        .eq("tenant_id", tenant.id)
        .maybeSingle();

      if (adminError || !adminUser) {
        return new Response(
          JSON.stringify({ error: "User not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if password already set
      if (adminUser.password_hash) {
        return new Response(
          JSON.stringify({ error: "Password already set. Use login instead." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Update password_hash and activate user
      const { error: updateError } = await supabase
        .from("tenant_users")
        .update({
          password_hash: passwordHash,
          status: 'active' // Activate user when password is set
        })
        .eq("id", adminUser.id);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Failed to setup password" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Password setup successful" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'impersonate') {
      // Super admin impersonation - generate tenant admin token
      const { tenant_id, super_admin_id } = requestBody;

      if (!tenant_id) {
        return new Response(
          JSON.stringify({ error: 'tenant_id required' }),
          { status: 400, headers: { ...corsHeadersWithOrigin, 'Content-Type': 'application/json' } }
        );
      }

      // Get tenant
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id, business_name, slug, subscription_plan, subscription_status, limits, usage, features')
        .eq('id', tenant_id)
        .single();

      if (tenantError || !tenant) {
        return new Response(
          JSON.stringify({ error: 'Tenant not found' }),
          { status: 404, headers: { ...corsHeadersWithOrigin, 'Content-Type': 'application/json' } }
        );
      }

      // Get first active admin
      const { data: tenantAdmin, error: adminError } = await supabase
        .from('tenant_users')
        .select('id, email, name, role, tenant_id')
        .eq('tenant_id', tenant_id)
        .in('role', ['owner', 'admin'])
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      if (adminError || !tenantAdmin) {
        return new Response(
          JSON.stringify({ error: 'No active admin found for tenant' }),
          { status: 404, headers: { ...corsHeadersWithOrigin, 'Content-Type': 'application/json' } }
        );
      }

      // Log impersonation start in audit_logs
      const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
      const userAgent = req.headers.get('user-agent') || 'unknown';

      await supabase
        .from('audit_logs')
        .insert({
          actor_id: super_admin_id || '00000000-0000-0000-0000-000000000000',
          actor_type: 'super_admin',
          action: 'impersonate_started',
          resource_type: 'tenant',
          resource_id: tenant_id,
          tenant_id: tenant_id,
          changes: {
            tenant_slug: tenant.slug,
            tenant_name: tenant.business_name,
            admin_email: tenantAdmin.email,
            admin_id: tenantAdmin.id,
            admin_role: tenantAdmin.role,
            timestamp: new Date().toISOString(),
          },
          ip_address: ipAddress,
          user_agent: userAgent,
        })
        .catch((logError) => {
          // Log error but don't fail impersonation
          console.error('Failed to log impersonation:', logError);
        });

      // Generate token for tenant admin (simplified - in production use proper JWT)
      // For now, return tenant admin email and let frontend handle login
      return new Response(
        JSON.stringify({
          success: true,
          tenant: {
            id: tenant.id,
            business_name: tenant.business_name,
            slug: tenant.slug,
            subscription_plan: tenant.subscription_plan,
            subscription_status: tenant.subscription_status,
            limits: tenant.limits,
            usage: tenant.usage,
            features: tenant.features,
          },
          admin: {
            id: tenantAdmin.id,
            email: tenantAdmin.email,
            name: tenantAdmin.name,
            role: tenantAdmin.role,
            userId: tenantAdmin.user_id,
          },
          message: 'Use tenant admin email to generate token',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'verify') {
      // Check for token in httpOnly cookie first, then fall back to Authorization header
      let token: string | null = null;

      // Try to get token from cookie
      const cookieHeader = req.headers.get('Cookie');
      if (cookieHeader) {
        const cookies = cookieHeader.split(';').map(c => c.trim());
        const accessTokenCookie = cookies.find(c => c.startsWith('tenant_access_token='));
        if (accessTokenCookie) {
          token = accessTokenCookie.split('=')[1];
        }
      }

      // Fall back to Authorization header if no cookie
      if (!token) {
        const authHeader = req.headers.get('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.replace('Bearer ', '');
        }
      }

      if (!token) {
        return new Response(
          JSON.stringify({ error: 'No token provided' }),
          { status: 401, headers: { ...corsHeadersWithOrigin, 'Content-Type': 'application/json' } }
        );
      }

      // Verify token and get user (fast auth check)
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user || !user.email) {
        console.error('Token verification failed:', authError);
        return new Response(
          JSON.stringify({ error: 'Invalid or expired token' }),
          { status: 401, headers: { ...corsHeadersWithOrigin, 'Content-Type': 'application/json' } }
        );
      }

      const userEmail = user.email.toLowerCase();
      console.log('[VERIFY] Checking access for:', userEmail);

      // Optimized: Check tenant ownership first (single query, no joins)
      const { data: ownedTenant, error: ownerError } = await supabase
        .from('tenants')
        .select('id, business_name, slug, owner_email, owner_name, subscription_plan, subscription_status, trial_ends_at, limits, usage, features')
        .eq('owner_email', userEmail)
        .maybeSingle();

      if (ownerError && ownerError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('[VERIFY] Owner lookup error:', ownerError);
      }

      if (ownedTenant) {
        // User is tenant owner - fast path
        console.log('[VERIFY] User is owner of tenant:', ownedTenant.business_name);

        const admin = {
          id: user.id,
          email: userEmail,
          name: ownedTenant.owner_name || userEmail.split('@')[0],
          role: 'owner',
          tenant_id: ownedTenant.id,
          userId: user.id,
        };

        const tenant = {
          id: ownedTenant.id,
          business_name: ownedTenant.business_name,
          slug: ownedTenant.slug,
          owner_email: ownedTenant.owner_email,
          subscription_plan: ownedTenant.subscription_plan,
          subscription_status: ownedTenant.subscription_status,
          trial_ends_at: ownedTenant.trial_ends_at,
          limits: ownedTenant.limits,
          usage: ownedTenant.usage,
          features: ownedTenant.features,
        };

        return new Response(
          JSON.stringify({ user, admin, tenant }),
          { headers: { ...corsHeadersWithOrigin, 'Content-Type': 'application/json' } }
        );
      }

      // Not owner - check tenant_users (optimized: specific fields only, manual join)
      console.log('[VERIFY] User not owner, checking tenant_users');

      const { data: tenantUser, error: tenantUserError } = await supabase
        .from('tenant_users')
        .select('id, email, name, role, tenant_id, status')
        .eq('email', userEmail)
        .eq('status', 'active')
        .maybeSingle();

      if (tenantUserError && tenantUserError.code !== 'PGRST116') {
        console.error('[VERIFY] Tenant user lookup error:', tenantUserError);
      }

      if (!tenantUser) {
        console.log('[VERIFY] No tenant access found for:', userEmail);
        return new Response(
          JSON.stringify({ error: 'No tenant access found' }),
          { status: 403, headers: { ...corsHeadersWithOrigin, 'Content-Type': 'application/json' } }
        );
      }

      // Get tenant info separately (more efficient than nested select)
      const { data: userTenant, error: userTenantError } = await supabase
        .from('tenants')
        .select('id, business_name, slug, owner_email, subscription_plan, subscription_status, trial_ends_at, limits, usage, features')
        .eq('id', tenantUser.tenant_id)
        .single();

      if (userTenantError || !userTenant) {
        console.error('[VERIFY] Tenant lookup error:', userTenantError);
        return new Response(
          JSON.stringify({ error: 'Tenant not found' }),
          { status: 404, headers: { ...corsHeadersWithOrigin, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[VERIFY] User has access to tenant:', userTenant.business_name);

      const admin = {
        id: tenantUser.id,
        email: tenantUser.email,
        name: tenantUser.name,
        role: tenantUser.role,
        tenant_id: tenantUser.tenant_id,
        userId: user.id,
      };

      const tenant = {
        id: userTenant.id,
        business_name: userTenant.business_name,
        slug: userTenant.slug,
        owner_email: userTenant.owner_email,
        subscription_plan: userTenant.subscription_plan,
        subscription_status: userTenant.subscription_status,
        trial_ends_at: userTenant.trial_ends_at,
        limits: userTenant.limits,
        usage: userTenant.usage,
        features: userTenant.features,
      };

      return new Response(
        JSON.stringify({ user, admin, tenant }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in tenant-admin-auth:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeadersWithOrigin, 'Content-Type': 'application/json' } }
    );
  }
}));
