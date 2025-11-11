// @ts-nocheck
import { serve, createClient, corsHeaders } from "../_shared/deps.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// JWT Token generation (simplified for Edge Functions)
function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function encodeJWT(payload: any, secret: string, expiresIn: number = 7 * 24 * 60 * 60): string {
  const encoder = new TextEncoder();
  const now = Math.floor(Date.now() / 1000);
  
  const jwtPayload = {
    ...payload,
    exp: now + expiresIn,
    iat: now,
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(encoder.encode(JSON.stringify(jwtPayload)));
  
  // Simple signature (in production, use proper HMAC)
  const signature = base64UrlEncode(encoder.encode(`${encodedHeader}.${encodedPayload}.${secret}`));
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

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

    // Parse and validate request body
    const rawBody = await req.json();
    const body = TenantSignupSchema.parse(rawBody);
    const { email, password, business_name, owner_name, phone, state, industry, company_size } = body;

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

    // Create Supabase Auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.toLowerCase(),
      password: password,
      email_confirm: true, // Auto-confirm email for signup
      user_metadata: {
        name: owner_name,
        business_name: business_name,
      },
    });

    if (authError || !authData.user) {
      console.error('Auth user creation error:', authError);
      return new Response(
        JSON.stringify({ error: authError?.message || 'Failed to create user account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate trial end date (14 days from now)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    // Create tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        business_name,
        slug,
        owner_email: email.toLowerCase(),
        owner_name,
        phone: phone || null,
        state: state || null,
        industry: industry || null,
        company_size: company_size || null,
        subscription_plan: 'starter',
        subscription_status: 'trial',
        trial_ends_at: trialEndsAt.toISOString(),
        limits: {
          customers: 50,
          menus: 3,
          products: 100,
          locations: 2,
          users: 3,
        },
        usage: {
          customers: 0,
          menus: 0,
          products: 0,
          locations: 0,
          users: 1,
        },
        features: {
          api_access: false,
          custom_branding: false,
          white_label: false,
          advanced_analytics: false,
          sms_enabled: false,
        },
        mrr: 99,
      })
      .select()
      .single();

    if (tenantError || !tenant) {
      console.error('Tenant creation error:', tenantError);
      // Try to clean up auth user if tenant creation failed
      await supabase.auth.admin.deleteUser(authData.user.id);
      
      return new Response(
        JSON.stringify({ error: tenantError?.message || 'Failed to create tenant' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create tenant user (owner)
    // Note: Password is handled by Supabase Auth, no need to store hash separately
    const { data: tenantUser, error: userError } = await supabase
      .from('tenant_users')
      .insert({
        tenant_id: tenant.id,
        user_id: authData.user.id,
        email: email.toLowerCase(),
        name: owner_name,
        role: 'owner',
        status: 'active',
        invited_at: new Date().toISOString(),
        accepted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (userError || !tenantUser) {
      console.error('Tenant user creation error:', userError);
      // Try to clean up
      await supabase.from('tenants').delete().eq('id', tenant.id);
      await supabase.auth.admin.deleteUser(authData.user.id);
      
      return new Response(
        JSON.stringify({ error: userError?.message || 'Failed to create tenant user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create subscription event
    await supabase.from('subscription_events').insert({
      tenant_id: tenant.id,
      event_type: 'trial_started',
      to_plan: 'starter',
      amount: 0,
    });

    // Generate JWT tokens for auto-login
    const jwtSecret = Deno.env.get('JWT_SECRET') || 'default-secret-change-in-production';
    
    const accessToken = encodeJWT(
      {
        user_id: tenantUser.id,
        email: tenantUser.email,
        name: tenantUser.name,
        role: tenantUser.role,
        tenant_id: tenant.id,
        tenant_slug: tenant.slug,
      },
      jwtSecret,
      7 * 24 * 60 * 60 // 7 days
    );

    const refreshToken = encodeJWT(
      {
        user_id: tenantUser.id,
        tenant_id: tenant.id,
        type: 'refresh',
      },
      jwtSecret,
      30 * 24 * 60 * 60 // 30 days
    );

    // Return success response with tokens
    return new Response(
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
        tokens: {
          access_token: accessToken,
          refresh_token: refreshToken,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

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

