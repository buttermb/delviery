import { corsHeaders } from '../../_shared/deps.ts';
import { comparePassword } from '../../_shared/password.ts';
import { loginSchema } from '../validation.ts';
import { checkBruteForce, logAuthEvent, getClientIP, GENERIC_AUTH_ERROR } from '../../_shared/bruteForceProtection.ts';
import { AUTH_ERRORS } from '../../_shared/auth-errors.ts';
import { createCustomerToken } from './types.ts';
import type { HandlerContext } from './types.ts';

export async function handleLogin(ctx: HandlerContext): Promise<Response> {
  const { req, supabase, requestBody } = ctx;

  // Validate input with Zod
  const validationResult = loginSchema.safeParse(requestBody);
  if (!validationResult.success) {
    const zodError = validationResult as { success: false; error: { errors: unknown[] } };
    return new Response(
      JSON.stringify({
        error: "Validation failed",
        details: zodError.error.errors
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { email, password, tenantSlug } = validationResult.data;

  // Extract client IP for brute force protection
  const clientIP = getClientIP(req);
  const userAgent = req.headers.get("user-agent") || "unknown";

  // Brute force protection: Block IP after repeated failed attempts
  const bruteForceResult = await checkBruteForce(clientIP);
  if (bruteForceResult.blocked) {
    await logAuthEvent({
      eventType: 'customer_login_attempt',
      ipAddress: clientIP,
      email: email.toLowerCase(),
      success: false,
      failureReason: 'ip_blocked_brute_force',
      userAgent,
      metadata: { tenantSlug, failedAttempts: bruteForceResult.failedAttempts },
    });
    return new Response(
      JSON.stringify({ error: GENERIC_AUTH_ERROR }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Find tenant by slug
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("*")
    .eq("slug", tenantSlug.toLowerCase())
    .eq("status", "active")
    .maybeSingle();

  if (tenantError || !tenant) {
    return new Response(
      JSON.stringify({ error: "Tenant not found or inactive" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Find customer user
  const { data: customerUser, error: customerError } = await supabase
    .from("customer_users")
    .select("*")
    .eq("email", email.toLowerCase())
    .eq("tenant_id", tenant.id)
    .eq("is_active", true)
    .maybeSingle();

  if (customerError || !customerUser) {
    await logAuthEvent({
      eventType: 'customer_login_attempt',
      ipAddress: clientIP,
      email: email.toLowerCase(),
      success: false,
      failureReason: 'user_not_found',
      userAgent,
      metadata: { tenantSlug },
    });
    return new Response(
      JSON.stringify({ error: GENERIC_AUTH_ERROR }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Verify password
  const validPassword = await comparePassword(password, customerUser.password_hash);
  if (!validPassword) {
    await logAuthEvent({
      eventType: 'customer_login_attempt',
      ipAddress: clientIP,
      email: email.toLowerCase(),
      success: false,
      failureReason: 'invalid_password',
      userAgent,
      metadata: { tenantSlug, tenantId: tenant.id },
    });
    return new Response(
      JSON.stringify({ error: GENERIC_AUTH_ERROR }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check email verification
  if (!customerUser.email_verified) {
    return new Response(
      JSON.stringify({
        error: AUTH_ERRORS.EMAIL_NOT_VERIFIED,
        requires_verification: true,
        customer_user_id: customerUser.id,
        message: AUTH_ERRORS.EMAIL_NOT_VERIFIED
      }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get linked customer record if exists
  let customer = null;
  if (customerUser.customer_id) {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerUser.customer_id)
      .maybeSingle();
    customer = data;
  }

  // Session fixation protection: Invalidate all pre-existing sessions for this customer
  // This ensures a fresh session state on authentication, preventing session hijacking
  try {
    await supabase
      .from('customer_sessions')
      .delete()
      .eq('customer_user_id', customerUser.id)
      .eq('tenant_id', tenant.id);
    console.error('[SESSION_FIXATION] Previous customer sessions invalidated:', customerUser.id);
  } catch (sessionCleanupError) {
    // Log but don't block login - session cleanup is best-effort
    console.warn('[SESSION_FIXATION] Failed to invalidate previous customer sessions:', sessionCleanupError);
  }

  // Generate JWT token
  const token = await createCustomerToken({
    customer_user_id: customerUser.id,
    customer_id: customerUser.customer_id || customerUser.id,
    tenant_id: tenant.id,
    type: "customer",
  });

  // Create session record
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await supabase.from("customer_sessions").insert({
    customer_user_id: customerUser.id,
    tenant_id: tenant.id,
    token,
    ip_address: clientIP,
    user_agent: userAgent,
    expires_at: expiresAt.toISOString(),
  });

  // Log successful login for brute force tracking
  await logAuthEvent({
    eventType: 'customer_login_attempt',
    ipAddress: clientIP,
    email: email.toLowerCase(),
    success: true,
    userAgent,
    metadata: { tenantSlug, tenantId: tenant.id },
  });

  return new Response(
    JSON.stringify({
      token,
      customer: {
        id: customerUser.id,
        email: customerUser.email,
        first_name: customerUser.first_name,
        last_name: customerUser.last_name,
        customer_id: customerUser.customer_id,
        tenant_id: tenant.id,
      },
      tenant: {
        id: tenant.id,
        business_name: tenant.business_name,
        slug: tenant.slug,
      },
      customerRecord: customer,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
