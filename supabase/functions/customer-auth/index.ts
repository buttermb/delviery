import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { hashPassword, comparePassword } from '../_shared/password.ts';
import { encode as base64Encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";
import { signupSchema, loginSchema, updatePasswordSchema } from './validation.ts';

const JWT_SECRET = Deno.env.get("JWT_SECRET") || "your-secret-key-change-in-production";

interface JWTPayload {
  customer_user_id: string;
  customer_id: string;
  tenant_id: string;
  type: "customer";
  exp: number;
  iat: number;
}

function encodeJWT(payload: Omit<JWTPayload, "exp" | "iat">): string {
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload: JWTPayload = {
    ...payload,
    exp: now + 30 * 24 * 60 * 60, // 30 days
    iat: now,
  };

  const encoder = new TextEncoder();
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64Encode(encoder.encode(JSON.stringify(header)).buffer).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const encodedPayload = base64Encode(encoder.encode(JSON.stringify(jwtPayload)).buffer).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signature = base64Encode(encoder.encode(`${encodedHeader}.${encodedPayload}.${JWT_SECRET}`).buffer).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64Decode(parts[1])));
    
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    if (payload.type !== "customer") return null;
    
    return payload as JWTPayload;
  } catch {
    return null;
  }
}

function base64Decode(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Uint8Array.from(atob(str).split("").map((c) => c.charCodeAt(0)));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    
    let requestBody: any = {};
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
        return new Response(
          JSON.stringify({ 
            error: "Validation failed", 
            details: validationResult.error.errors 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { email, password, firstName, lastName, phone, dateOfBirth, tenantSlug, isBusinessBuyer, businessName, businessLicenseNumber } = validationResult.data;

      console.log('Customer signup attempt:', { email, tenantSlug });

      // Find tenant by slug
      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .select("*")
        .eq("slug", tenantSlug.toLowerCase())
        .eq("status", "active")
        .maybeSingle();

      if (tenantError || !tenant) {
        return new Response(
          JSON.stringify({ error: "Store not found or inactive" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if customer user already exists
      const { data: existingUser } = await supabase
        .from("customer_users")
        .select("id")
        .eq("email", email.toLowerCase())
        .eq("tenant_id", tenant.id)
        .maybeSingle();

      if (existingUser) {
        return new Response(
          JSON.stringify({ error: "An account with this email already exists" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Cross-table check: Verify email is not registered as a staff account
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { data: tenantUserExists } = await serviceClient
        .from('tenant_users')
        .select('id, role')
        .eq('email', email.toLowerCase())
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (tenantUserExists) {
        return new Response(
          JSON.stringify({ 
            error: "This email is registered as a staff account",
            message: `This email is registered as a staff account. Please use the staff login at /${tenant.slug}/admin/login instead.`
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
          return new Response(
            JSON.stringify({ error: `You must be at least ${minimumAge} years old to create an account` }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else if (tenant.age_verification_required) {
        return new Response(
          JSON.stringify({ error: "Date of birth is required for age verification" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
              return new Response(
                JSON.stringify({ error: phoneResult.reason || "Invalid phone number" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
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
          status: 'active',
          email_verified: false, // Require email verification
        })
        .select()
        .single();

      if (createError || !customerUser) {
        console.error('Failed to create customer user:', createError);
        return new Response(
          JSON.stringify({ error: "Failed to create account" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
        // Don't fail signup if email sending fails
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
            // Create new marketplace profile (buyer profile)
            const { error: profileError } = await supabase
              .from('marketplace_profiles')
              .insert({
                tenant_id: tenant.id,
                business_name: businessName,
                license_number: businessLicenseNumber || null,
                marketplace_status: 'pending',
                license_verified: false,
                can_sell: false, // Buyers can't sell, only purchase
              });

            if (profileError) {
              console.error('Failed to create marketplace profile:', profileError);
              // Don't fail signup if profile creation fails - user can complete it later
            } else {
              console.log('Marketplace profile created for business buyer:', businessName);
            }
          } else {
            // Update existing profile with business buyer info
            const { error: updateError } = await supabase
              .from('marketplace_profiles')
              .update({
                business_name: businessName,
                license_number: businessLicenseNumber || '',
              })
              .eq('id', existingProfile.id);

            if (updateError) {
              console.error('Failed to update marketplace profile:', updateError);
            }
          }
        } catch (profileErr) {
          console.error('Error creating marketplace profile:', profileErr);
          // Don't fail signup if profile creation fails
        }
      }

      console.log('Customer signup successful:', email);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Account created successfully. Please check your email to verify your account.",
          requires_verification: true,
          customer_user_id: customerUser.id,
          is_business_buyer: isBusinessBuyer || false,
        }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "login") {
      // Validate input with Zod
      const validationResult = loginSchema.safeParse(requestBody);
      if (!validationResult.success) {
        return new Response(
          JSON.stringify({ 
            error: "Validation failed", 
            details: validationResult.error.errors 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { email, password, tenantSlug } = validationResult.data;

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
        .eq("status", "active")
        .maybeSingle();

      if (customerError || !customerUser) {
        return new Response(
          JSON.stringify({ error: "Invalid credentials" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify password
      const validPassword = await comparePassword(password, customerUser.password_hash);
      if (!validPassword) {
        return new Response(
          JSON.stringify({ error: "Invalid credentials" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check email verification
      if (!customerUser.email_verified) {
        return new Response(
          JSON.stringify({ 
            error: "Email not verified",
            requires_verification: true,
            customer_user_id: customerUser.id,
            message: "Please verify your email address before logging in. Check your inbox for the verification code."
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

      // Generate JWT token
      const token = encodeJWT({
        customer_user_id: customerUser.id,
        customer_id: customerUser.customer_id || customerUser.id,
        tenant_id: tenant.id,
        type: "customer",
      });

      // Create session record
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

      const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
      const userAgent = req.headers.get("user-agent") || "unknown";

      await supabase.from("customer_sessions").insert({
        customer_user_id: customerUser.id,
        tenant_id: tenant.id,
        token,
        ip_address: clientIp,
        user_agent: userAgent,
        expires_at: expiresAt.toISOString(),
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

    if (action === "verify") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "No token provided" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const token = authHeader.replace("Bearer ", "");
      const payload = verifyJWT(token);

      if (!payload) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify session exists and is valid
      const { data: session, error: sessionError } = await supabase
        .from("customer_sessions")
        .select("*")
        .eq("token", token)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (sessionError || !session) {
        return new Response(
          JSON.stringify({ error: "Session expired or invalid" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get customer user
      const { data: customerUser, error: customerError } = await supabase
        .from("customer_users")
        .select("*")
        .eq("id", payload.customer_user_id)
        .eq("status", "active")
        .maybeSingle();

      if (customerError || !customerUser) {
        return new Response(
          JSON.stringify({ error: "User not found or inactive" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get tenant
      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", payload.tenant_id)
        .eq("status", "active")
        .maybeSingle();

      if (tenantError || !tenant) {
        return new Response(
          JSON.stringify({ error: "Tenant not found or inactive" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
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
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "logout") {
      const authHeader = req.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "");
        await supabase.from("customer_sessions").delete().eq("token", token);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update-password") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "Authorization required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const rawBody = await req.json();
      
      // Validate input with Zod
      const validationResult = updatePasswordSchema.safeParse(rawBody);
      if (!validationResult.success) {
        return new Response(
          JSON.stringify({ 
            error: "Validation failed", 
            details: validationResult.error.errors 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { currentPassword, newPassword } = validationResult.data;

      const token = authHeader.replace("Bearer ", "");
      const payload = verifyJWT(token);

      if (!payload) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get customer user
      const { data: customerUser, error: customerError } = await supabase
        .from("customer_users")
        .select("*")
        .eq("id", payload.customer_user_id)
        .eq("status", "active")
        .maybeSingle();

      if (customerError || !customerUser) {
        return new Response(
          JSON.stringify({ error: "User not found or inactive" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify current password
      const validPassword = await comparePassword(currentPassword, customerUser.password_hash);
      if (!validPassword) {
        return new Response(
          JSON.stringify({ error: "Current password is incorrect" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Hash new password
      const newPasswordHash = await hashPassword(newPassword);

      // Update password
      const { error: updateError } = await supabase
        .from("customer_users")
        .update({ password_hash: newPasswordHash })
        .eq("id", customerUser.id);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Failed to update password" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Password updated successfully" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Customer auth error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Authentication failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

