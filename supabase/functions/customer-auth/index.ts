// Edge Function: customer-auth
import { serve, createClient, z } from '../_shared/deps.ts';
import { secureHeadersMiddleware } from '../_shared/secure-headers.ts';
import { hashPassword, comparePassword } from '../_shared/password.ts';
import { signJWT, verifyJWT as verifyJWTSecure } from '../_shared/jwt.ts';
import { signupSchema, loginSchema, updatePasswordSchema, updateProfileSchema } from './validation.ts';
import { checkBruteForce, logAuthEvent, getClientIP, GENERIC_AUTH_ERROR } from '../_shared/bruteForceProtection.ts';

interface CustomerJWTPayload {
  customer_user_id: string;
  customer_id: string;
  tenant_id: string;
  type: "customer";
}

// Wrapper for signing customer tokens
async function createCustomerToken(payload: { customer_user_id: string; customer_id: string; tenant_id: string; type: "customer" }): Promise<string> {
  return await signJWT({ ...payload }, 7 * 24 * 60 * 60); // 7 days
}

// Wrapper for verifying customer tokens
async function verifyCustomerToken(token: string): Promise<CustomerJWTPayload | null> {
  const payload = await verifyJWTSecure(token);
  if (!payload) return null;
  if (payload.type !== "customer") return null;
  return payload as unknown as CustomerJWTPayload;
}

serve(secureHeadersMiddleware(async (req) => {
  // Get origin from request for CORS
  const origin = req.headers.get('origin');
  const hasCredentials = req.headers.get('cookie') || req.headers.get('authorization');

  // Allowed origins for CORS
  const allowedOrigins: (string | RegExp)[] = [
    'https://floraiqcrm.com',
    'https://www.floraiqcrm.com',
    'http://localhost:8080',
    'http://localhost:5173',
    // Lovable preview domains
    /^https:\/\/[a-f0-9-]+\.lovableproject\.com$/,
    /^https:\/\/[a-f0-9-]+\.lovable\.app$/,
    'https://lovable.app',
    'https://lovable.dev',
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

  const responseHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': requestOrigin || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cookie',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  };

  // Add credentials header when we have a valid origin
  if (requestOrigin) {
    responseHeaders['Access-Control-Allow-Credentials'] = 'true';
  }

  // Helper to create JSON responses with consistent headers
  const jsonResponse = (body: Record<string, unknown>, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...responseHeaders, 'Content-Type': 'application/json' },
    });

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: responseHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Health check endpoint - no auth required, verifies function is deployed and running
    if (action === 'health') {
      const hasSupabaseUrl = !!Deno.env.get('SUPABASE_URL');
      const hasServiceRoleKey = !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const hasJwtSecret = !!Deno.env.get('JWT_SECRET');

      return jsonResponse({
        status: 'ok',
        function: 'customer-auth',
        timestamp: new Date().toISOString(),
        env: {
          SUPABASE_URL: hasSupabaseUrl,
          SUPABASE_SERVICE_ROLE_KEY: hasServiceRoleKey,
          JWT_SECRET: hasJwtSecret,
        },
      }, 200);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let requestBody: Record<string, unknown> = {};
    if (action !== 'verify' && action !== 'logout' && req.method === 'POST') {
      try {
        requestBody = await req.json();
      } catch (e) {
        console.error('Failed to parse JSON body:', e);
        requestBody = {};
      }
    }

    if (action === "signup") {
      // Validate input with Zod
      const validationResult = signupSchema.safeParse(requestBody);
      if (!validationResult.success) {
        const zodError = validationResult as { success: false; error: { errors: unknown[] } };
        return jsonResponse({ error: "Validation failed", details: zodError.error.errors }, 400);
      }

      const { email, password, firstName, lastName, phone, dateOfBirth, tenantSlug, tenantId, isBusinessBuyer, businessName, businessLicenseNumber } = validationResult.data;

      if (!tenantSlug && !tenantId) {
        return jsonResponse({ error: "Either tenantSlug or tenantId is required" }, 400);
      }

      // Find tenant by slug or ID
      let tenantQuery = supabase.from("tenants").select("*").eq("status", "active");
      if (tenantId) {
        tenantQuery = tenantQuery.eq("id", tenantId);
      } else if (tenantSlug) {
        tenantQuery = tenantQuery.eq("slug", tenantSlug.toLowerCase());
      }
      const { data: tenant, error: tenantError } = await tenantQuery.maybeSingle();

      if (tenantError || !tenant) {
        return jsonResponse({ error: "Store not found or inactive" }, 404);
      }

      // Check if customer user already exists
      const { data: existingUser } = await supabase
        .from("customer_users")
        .select("id")
        .eq("email", email.toLowerCase())
        .eq("tenant_id", tenant.id)
        .maybeSingle();

      if (existingUser) {
        return jsonResponse({ error: "An account with this email already exists" }, 409);
      }

      // Cross-table check: Verify email is not registered as a staff account
      const { data: tenantUserExists } = await supabase
        .from('tenant_users')
        .select('id, role')
        .eq('email', email.toLowerCase())
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (tenantUserExists) {
        return jsonResponse({
          error: "This email is registered as a staff account",
          message: `This email is registered as a staff account. Please use the staff login at /${tenant.slug}/admin/login instead.`
        }, 409);
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Validate age if DOB provided
      if (dateOfBirth) {
        const birthDate = new Date(dateOfBirth);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age;

        const minimumAge = tenant.minimum_age || 21;
        if (actualAge < minimumAge) {
          return jsonResponse({ error: `You must be at least ${minimumAge} years old to create an account` }, 403);
        }
      } else if (tenant.age_verification_required) {
        return jsonResponse({ error: "Date of birth is required for age verification" }, 400);
      }

      // Validate phone if provided
      if (phone) {
        try {
          const phoneResponse = await fetch(`${supabaseUrl}/functions/v1/validate-phone`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ phone }),
          });

          if (phoneResponse.ok) {
            const phoneResult = await phoneResponse.json();
            if (!phoneResult.valid) {
              return jsonResponse({ error: phoneResult.reason || "Invalid phone number" }, 400);
            }
          }
        } catch (phoneError) {
          console.error('Phone validation error:', phoneError);
          // Don't block signup if phone validation service is down
        }
      }

      // Create customer user (email not verified initially)
      const { data: customerUser, error: createError } = await supabase
        .from("customer_users")
        .insert({
          email: email.toLowerCase(),
          password_hash: passwordHash,
          first_name: firstName || null,
          last_name: lastName || null,
          phone: phone || null,
          date_of_birth: dateOfBirth || null,
          tenant_id: tenant.id,
          email_verified: false, // Require email verification
          is_business_buyer: isBusinessBuyer || false,
          business_name: businessName || null,
          business_license_number: businessLicenseNumber || null,
        })
        .select()
        .single();

      if (createError || !customerUser) {
        console.error('Failed to create customer user:', createError);
        return jsonResponse({ error: "Failed to create account" }, 500);
      }

      // Send verification email (async, don't wait for it)
      fetch(`${supabaseUrl}/functions/v1/send-verification-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_user_id: customerUser.id,
          tenant_id: tenant.id,
          email: email.toLowerCase(),
          tenant_name: tenant.business_name,
        }),
      }).catch((err: unknown) => {
        console.error('Failed to send verification email:', err);
      });

      // Create marketplace profile for business buyers
      if (isBusinessBuyer && businessName) {
        try {
          // Check if marketplace profile already exists for this tenant
          const { data: existingProfile } = await supabase
            .from('marketplace_profiles')
            .select('id')
            .eq('tenant_id', tenant.id)
            .maybeSingle();

          if (!existingProfile) {
            const { error: profileError } = await supabase
              .from('marketplace_profiles')
              .insert({
                tenant_id: tenant.id,
                business_name: businessName,
                license_number: businessLicenseNumber || null,
                marketplace_status: 'pending',
                license_verified: false,
                can_sell: false,
              });

            if (profileError) {
              console.error('Failed to create marketplace profile:', profileError);
            }
          } else {
            const { error: updateError } = await supabase
              .from('marketplace_profiles')
              .update({
                business_name: businessName,
                license_number: businessLicenseNumber || null,
              })
              .eq('id', existingProfile.id);

            if (updateError) {
              console.error('Failed to update marketplace profile:', updateError);
            }
          }
        } catch (profileErr) {
          console.error('Error creating marketplace profile:', profileErr);
        }
      }

      console.log('Customer signup successful:', customerUser.id);

      return jsonResponse({
        success: true,
        message: "Account created successfully. Please check your email to verify your account.",
        requires_verification: true,
        customer_user_id: customerUser.id,
        is_business_buyer: isBusinessBuyer || false,
      }, 201);
    }

    if (action === "login") {
      // Validate input with Zod
      const validationResult = loginSchema.safeParse(requestBody);
      if (!validationResult.success) {
        const zodError = validationResult as { success: false; error: { errors: unknown[] } };
        return jsonResponse({ error: "Validation failed", details: zodError.error.errors }, 400);
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
        return jsonResponse({ error: GENERIC_AUTH_ERROR }, 401);
      }

      // Find tenant by slug
      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .select("*")
        .eq("slug", tenantSlug.toLowerCase())
        .eq("status", "active")
        .maybeSingle();

      if (tenantError || !tenant) {
        return jsonResponse({ error: "Tenant not found or inactive" }, 404);
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
        return jsonResponse({ error: GENERIC_AUTH_ERROR }, 401);
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
        return jsonResponse({ error: GENERIC_AUTH_ERROR }, 401);
      }

      // Check email verification
      if (!customerUser.email_verified) {
        return jsonResponse({
          error: "Email not verified",
          requires_verification: true,
          customer_user_id: customerUser.id,
          message: "Please verify your email address before logging in. Check your inbox for the verification code."
        }, 403);
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
      try {
        await supabase
          .from('customer_sessions')
          .delete()
          .eq('customer_user_id', customerUser.id)
          .eq('tenant_id', tenant.id);
      } catch (sessionCleanupError) {
        console.warn('Failed to invalidate previous customer sessions:', sessionCleanupError);
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

      return jsonResponse({
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
      }, 200);
    }

    if (action === "verify") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return jsonResponse({ error: "No token provided" }, 401);
      }

      const token = authHeader.replace("Bearer ", "");
      const payload = await verifyCustomerToken(token);

      if (!payload) {
        return jsonResponse({ error: "Invalid or expired token" }, 401);
      }

      // Verify session exists and is valid
      const { data: session, error: sessionError } = await supabase
        .from("customer_sessions")
        .select("*")
        .eq("token", token)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (sessionError || !session) {
        return jsonResponse({ error: "Session expired or invalid" }, 401);
      }

      // Get customer user - use is_active (boolean column), not status
      const { data: customerUser, error: customerError } = await supabase
        .from("customer_users")
        .select("*")
        .eq("id", payload.customer_user_id)
        .eq("tenant_id", payload.tenant_id)
        .eq("is_active", true)
        .maybeSingle();

      if (customerError || !customerUser) {
        return jsonResponse({ error: "User not found or inactive" }, 401);
      }

      // Get tenant
      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", payload.tenant_id)
        .eq("status", "active")
        .maybeSingle();

      if (tenantError || !tenant) {
        return jsonResponse({ error: "Tenant not found or inactive" }, 401);
      }

      return jsonResponse({
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
      }, 200);
    }

    if (action === "logout") {
      const authHeader = req.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "");
        // Verify token ownership before deleting session
        const payload = await verifyCustomerToken(token);
        if (payload) {
          await supabase
            .from("customer_sessions")
            .delete()
            .eq("token", token)
            .eq("customer_user_id", payload.customer_user_id);
        }
      }

      return jsonResponse({ success: true }, 200);
    }

    if (action === "update-password") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return jsonResponse({ error: "Authorization required" }, 401);
      }

      const rawBody = await req.json();

      // Validate input with Zod
      const validationResult = updatePasswordSchema.safeParse(rawBody);
      if (!validationResult.success) {
        const zodError = validationResult as { success: false; error: { errors: unknown[] } };
        return jsonResponse({ error: "Validation failed", details: zodError.error.errors }, 400);
      }

      const { currentPassword, newPassword } = validationResult.data;

      const token = authHeader.replace("Bearer ", "");
      const payload = await verifyCustomerToken(token);

      if (!payload) {
        return jsonResponse({ error: "Invalid or expired token" }, 401);
      }

      // Get customer user - use is_active (boolean column), add tenant_id filter
      const { data: customerUser, error: customerError } = await supabase
        .from("customer_users")
        .select("*")
        .eq("id", payload.customer_user_id)
        .eq("tenant_id", payload.tenant_id)
        .eq("is_active", true)
        .maybeSingle();

      if (customerError || !customerUser) {
        return jsonResponse({ error: "User not found or inactive" }, 401);
      }

      // Verify current password
      const validPassword = await comparePassword(currentPassword, customerUser.password_hash);
      if (!validPassword) {
        return jsonResponse({ error: "Current password is incorrect" }, 401);
      }

      // Hash new password
      const newPasswordHash = await hashPassword(newPassword);

      // Update password with tenant_id filter for defense-in-depth
      const { error: updateError } = await supabase
        .from("customer_users")
        .update({ password_hash: newPasswordHash })
        .eq("id", customerUser.id)
        .eq("tenant_id", payload.tenant_id);

      if (updateError) {
        return jsonResponse({ error: "Failed to update password" }, 500);
      }

      return jsonResponse({ success: true, message: "Password updated successfully" }, 200);
    }

    if (action === "update-profile") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return jsonResponse({ error: "Authorization required" }, 401);
      }

      const rawBody = await req.json();
      const validationResult = updateProfileSchema.safeParse(rawBody);
      if (!validationResult.success) {
        const zodError = validationResult as { success: false; error: { errors: unknown[] } };
        return jsonResponse({ error: "Validation failed", details: zodError.error.errors }, 400);
      }

      const { firstName, lastName, phone } = validationResult.data;
      const token = authHeader.replace("Bearer ", "");
      const payload = await verifyCustomerToken(token);

      if (!payload) {
        return jsonResponse({ error: "Invalid or expired token" }, 401);
      }

      const { error: updateError } = await supabase
        .from("customer_users")
        .update({
          first_name: firstName ?? null,
          last_name: lastName ?? null,
          phone: phone ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payload.customer_user_id)
        .eq("tenant_id", payload.tenant_id);

      if (updateError) {
        return jsonResponse({ error: "Failed to update profile" }, 500);
      }

      return jsonResponse({ success: true, message: "Profile updated successfully" }, 200);
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (error) {
    console.error("Customer auth error:", error);
    return jsonResponse({ error: "Authentication failed" }, 500);
  }
}));
