import { hashPassword } from '../../_shared/password.ts';
import { signupSchema } from '../validation.ts';
import { AUTH_ERRORS } from '../../_shared/auth-errors.ts';
import { createServiceClient } from './types.ts';
import type { HandlerContext } from './types.ts';

export async function handleSignup(ctx: HandlerContext): Promise<Response> {
  const { supabase, supabaseUrl, supabaseKey, requestBody } = ctx;

  // Validate input with Zod
  const validationResult = signupSchema.safeParse(requestBody);
  if (!validationResult.success) {
    const zodError = validationResult as { success: false; error: { errors: unknown[] } };
    return new Response(
      JSON.stringify({
        error: "Validation failed",
        details: zodError.error.errors
      }),
      { status: 400, headers: { ...ctx.corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { email, password, firstName, lastName, phone, dateOfBirth, tenantSlug, tenantId, isBusinessBuyer, businessName, businessLicenseNumber } = validationResult.data;

  if (!tenantSlug && !tenantId) {
    return new Response(
      JSON.stringify({ error: "Either tenantSlug or tenantId is required" }),
      { status: 400, headers: { ...ctx.corsHeaders, "Content-Type": "application/json" } }
    );
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
    return new Response(
      JSON.stringify({ error: "Store not found or inactive" }),
      { status: 404, headers: { ...ctx.corsHeaders, "Content-Type": "application/json" } }
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
      JSON.stringify({ error: AUTH_ERRORS.INVALID_CREDENTIALS }),
      { status: 409, headers: { ...ctx.corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Cross-table check: Verify email is not registered as a staff account
  const serviceClient = createServiceClient();

  const { data: tenantUserExists } = await serviceClient
    .from('tenant_users')
    .select('id, role')
    .eq('email', email.toLowerCase())
    .eq('tenant_id', tenant.id)
    .maybeSingle();

  if (tenantUserExists) {
    return new Response(
      JSON.stringify({ error: AUTH_ERRORS.INVALID_CREDENTIALS }),
      { status: 409, headers: { ...ctx.corsHeaders, "Content-Type": "application/json" } }
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
        { status: 403, headers: { ...ctx.corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } else if (tenant.age_verification_required) {
    return new Response(
      JSON.stringify({ error: "Date of birth is required for age verification" }),
      { status: 400, headers: { ...ctx.corsHeaders, "Content-Type": "application/json" } }
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
            { status: 400, headers: { ...ctx.corsHeaders, "Content-Type": "application/json" } }
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
      email_verified: false, // Require email verification
      is_business_buyer: isBusinessBuyer || false,
      business_name: businessName || null,
      business_license_number: businessLicenseNumber || null,
    })
    .select()
    .single();

  if (createError || !customerUser) {
    console.error('Failed to create customer user:', createError);
    return new Response(
      JSON.stringify({ error: "Failed to create account" }),
      { status: 500, headers: { ...ctx.corsHeaders, "Content-Type": "application/json" } }
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
          console.info('Marketplace profile created for business buyer:', businessName);
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

  console.info('Customer signup successful:', email);

  return new Response(
    JSON.stringify({
      success: true,
      message: "Account created successfully. Please check your email to verify your account.",
      requires_verification: true,
      customer_user_id: customerUser.id,
      is_business_buyer: isBusinessBuyer || false,
    }),
    { status: 201, headers: { ...ctx.corsHeaders, "Content-Type": "application/json" } }
  );
}
