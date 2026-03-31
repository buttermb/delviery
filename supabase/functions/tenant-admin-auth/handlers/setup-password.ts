import { corsHeaders } from '../../_shared/deps.ts';
import type { SupabaseClient } from '../../_shared/deps.ts';
import { setupPasswordSchema } from '../validation.ts';
import { hashPassword } from '../../_shared/password.ts';
import type { CorsHeaders } from '../utils.ts';
import { errorResponse } from '../utils.ts';

export async function handleSetupPassword(
  _req: Request,
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  corsHeadersWithOrigin: CorsHeaders,
): Promise<Response> {
  // Setup password for newly created tenant user (during signup)

  // Validate input with Zod
  const validationResult = setupPasswordSchema.safeParse(body);
  if (!validationResult.success) {
    const zodError = validationResult as { success: false; error: { errors: unknown[] } };
    return errorResponse(corsHeadersWithOrigin, 400, 'Validation failed', {
      details: zodError.error.errors,
    });
  }

  const { email, password, tenantSlug } = validationResult.data;

  // Find tenant by slug
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', tenantSlug.toLowerCase())
    .maybeSingle();

  if (tenantError || !tenant) {
    return new Response(
      JSON.stringify({ error: 'Tenant not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Find tenant admin user (can be pending status)
  const { data: adminUser, error: adminError } = await supabase
    .from('tenant_users')
    .select('*')
    .eq('email', email.toLowerCase())
    .eq('tenant_id', tenant.id)
    .maybeSingle();

  if (adminError || !adminUser) {
    return new Response(
      JSON.stringify({ error: 'User not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if password already set
  if (adminUser.password_hash) {
    return new Response(
      JSON.stringify({ error: 'Password already set. Use login instead.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Update password_hash and activate user
  const { error: updateError } = await supabase
    .from('tenant_users')
    .update({
      password_hash: passwordHash,
      status: 'active',
    })
    .eq('id', adminUser.id);

  if (updateError) {
    return new Response(
      JSON.stringify({ error: 'Failed to setup password' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, message: 'Password setup successful' }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
