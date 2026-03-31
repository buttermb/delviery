/**
 * Tenant creation: slug generation, atomic DB record creation,
 * free tier setup, and credit granting.
 */

import { createClient, corsHeaders } from '../_shared/deps.ts';
import { generateSlug } from './validation.ts';

/**
 * Generate a unique slug for the new tenant.
 * Tries the base slug, then appends timestamp, then UUID as fallback.
 */
export async function generateUniqueSlug(
  supabase: ReturnType<typeof createClient>,
  businessName: string
): Promise<string> {
  let slug = generateSlug(businessName);
  let slugExists = true;
  let attempts = 0;

  while (slugExists && attempts < 10) {
    const { count, error: slugError } = await supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .eq('slug', slug);

    if (slugError) {
      console.error('[SIGNUP] Slug check failed', slugError);
      throw new Error('Failed to verify slug uniqueness');
    }

    if (count === 0 || count === null) {
      slugExists = false;
    } else {
      slug = `${generateSlug(businessName)}-${Date.now()}`;
      attempts++;
    }
  }

  // If still exists after 10 attempts, use UUID fallback to ensure uniqueness
  if (slugExists) {
    const baseSlug = generateSlug(businessName);
    const uuidSuffix = crypto.randomUUID().split('-')[0];
    slug = `${baseSlug}-${uuidSuffix}`;

    console.warn('Slug generation fallback used:', {
      business_name: businessName,
      original_slug: baseSlug,
      final_slug: slug,
      attempts,
    });
  }

  return slug;
}

interface CreateTenantParams {
  authUserId: string;
  email: string;
  businessName: string;
  ownerName: string;
  phone: string | undefined;
  state: string | undefined;
  industry: string | undefined;
  companySize: string | undefined;
  slug: string;
}

/**
 * Create tenant records atomically via the create_tenant_atomic RPC.
 * Rolls back auth user if DB creation fails.
 */
export async function createTenantAtomic(
  supabase: ReturnType<typeof createClient>,
  params: CreateTenantParams
): Promise<{ result: Record<string, unknown> | null; error: Response | null }> {
  console.error('[SIGNUP] Creating tenant records atomically', { slug: params.slug });

  const { data: atomicResult, error: atomicError } = await supabase
    .rpc('create_tenant_atomic', {
      p_auth_user_id: params.authUserId,
      p_email: params.email.toLowerCase(),
      p_business_name: params.businessName,
      p_owner_name: params.ownerName,
      p_phone: params.phone || null,
      p_state: params.state || null,
      p_industry: params.industry || null,
      p_company_size: params.companySize || null,
      p_slug: params.slug,
    });

  if (atomicError) {
    console.error('[SIGNUP] Atomic creation failed', {
      error: atomicError,
      slug: params.slug,
      userId: params.authUserId
    });

    // Rollback: Delete auth user since DB creation failed
    try {
      await supabase.auth.admin.deleteUser(params.authUserId);
      console.error('[SIGNUP] Rolled back auth user creation', { userId: params.authUserId });
    } catch (rollbackError) {
      console.error('[SIGNUP] Rollback failed', { error: rollbackError });
    }

    return {
      result: null,
      error: new Response(
        JSON.stringify({
          error: 'Failed to create tenant. Please try again.',
          details: atomicError.message,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      ),
    };
  }

  console.error('[SIGNUP] Tenant created atomically', {
    tenantId: atomicResult.tenant_id,
    slug: params.slug
  });

  return { result: atomicResult as Record<string, unknown>, error: null };
}

/**
 * Grant initial free credits and set free tier status for the new tenant.
 */
export async function setupFreeTier(
  supabase: ReturnType<typeof createClient>,
  tenantId: string
): Promise<void> {
  try {
    const { error: tierError } = await supabase
      .from('tenants')
      .update({ is_free_tier: true, credits_enabled: true })
      .eq('id', tenantId);

    if (tierError) {
      console.error('[SIGNUP] Failed to set free tier status', tierError);
    } else {
      console.error('[SIGNUP] Free tier status set', { tenantId });
    }

    const { error: creditError } = await supabase.rpc('grant_free_credits', {
      p_tenant_id: tenantId,
    });

    if (creditError) {
      console.error('[SIGNUP] Failed to grant initial credits', creditError);
    } else {
      console.error('[SIGNUP] Initial credits granted', { tenantId });
    }
  } catch (creditErr) {
    console.error('[SIGNUP] Credit granting error (non-blocking)', creditErr);
  }
}
