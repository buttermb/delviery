/**
 * Auth user creation, duplicate checking, and session generation for tenant signup.
 */

import { createClient, corsHeaders } from '../_shared/deps.ts';

/**
 * Check if the email already exists in Supabase Auth, tenant_users, or customer_users.
 * Returns a Response if a duplicate is found, or null if the email is available.
 */
export async function checkDuplicateEmail(
  supabase: ReturnType<typeof createClient>,
  email: string
): Promise<Response | null> {
  // Check if email already exists in Supabase Auth
  const { data: existingAuthUser } = await supabase.auth.admin.listUsers({ perPage: 1000 });
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

  return null;
}

/**
 * Create a Supabase Auth user with auto-confirmed email.
 */
export async function createAuthUser(
  supabase: ReturnType<typeof createClient>,
  email: string,
  password: string,
  ownerName: string,
  businessName: string
): Promise<{ user: Record<string, unknown> | null; error: Response | null }> {
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: email.toLowerCase(),
    password: password,
    email_confirm: true,
    user_metadata: {
      name: ownerName,
      business_name: businessName,
      signup_date: new Date().toISOString(),
    },
  });

  if (authError || !authData.user) {
    console.error('[SIGNUP] Auth user creation error:', authError);
    return {
      user: null,
      error: new Response(
        JSON.stringify({ error: authError?.message || 'Failed to create user account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      ),
    };
  }

  console.error('[SIGNUP] Auth user created', { userId: authData.user.id });
  return { user: authData.user as unknown as Record<string, unknown>, error: null };
}

/**
 * Generate a Supabase session for immediate login after signup.
 */
export async function generateSession(
  supabaseUrl: string,
  supabaseAnonKey: string,
  email: string,
  password: string
): Promise<{ session: Record<string, unknown> | null }> {
  const anonClient = createClient(supabaseUrl, supabaseAnonKey);

  const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
    email: email.toLowerCase(),
    password: password,
  });

  if (signInError || !signInData.session) {
    console.error('[SIGNUP] Failed to generate session', signInError);
    console.warn('[SIGNUP] Auto-login failed, user will need to log in manually');
    return { session: null };
  }

  console.error('[SIGNUP] Supabase session generated successfully');
  return { session: signInData.session as unknown as Record<string, unknown> };
}
