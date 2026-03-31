/**
 * Response construction for tenant signup: JSON body, cookies, and headers.
 */

import { corsHeaders } from '../_shared/deps.ts';
import { signJWT } from '../_shared/jwt.ts';

interface ResponseParams {
  tenant: Record<string, unknown>;
  tenantUser: Record<string, unknown>;
  signInSession: Record<string, unknown> | null;
}

interface TokenResult {
  accessToken: string | null;
  refreshToken: string | null;
}

/**
 * Generate JWT access and refresh tokens for auto-login.
 */
export async function generateTokens(
  tenant: Record<string, unknown>,
  tenantUser: Record<string, unknown>
): Promise<TokenResult> {
  let accessToken: string | null = null;
  let refreshToken: string | null = null;

  try {
    accessToken = await signJWT(
      {
        user_id: tenantUser.id,
        email: tenantUser.email,
        name: tenantUser.name,
        role: tenantUser.role,
        tenant_id: tenant.id,
        tenant_slug: tenant.slug,
      },
      7 * 24 * 60 * 60
    );

    refreshToken = await signJWT(
      {
        user_id: tenantUser.id,
        tenant_id: tenant.id,
        type: 'refresh',
      },
      30 * 24 * 60 * 60
    );
  } catch (jwtError) {
    console.warn('[SIGNUP] JWT generation failed (non-blocking, Supabase session used instead)', jwtError);
  }

  return { accessToken, refreshToken };
}

/**
 * Build the final signup success response with JSON body and httpOnly cookies.
 */
export function buildSuccessResponse(
  params: ResponseParams,
  tokens: TokenResult
): Response {
  const { tenant, tenantUser, signInSession } = params;
  const { accessToken, refreshToken } = tokens;

  const responseHeaders: Record<string, string> = {
    ...corsHeaders,
    'Content-Type': 'application/json',
  };

  const response = new Response(
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
      session: signInSession ? {
        access_token: signInSession.access_token,
        refresh_token: signInSession.refresh_token,
      } : null,
      auto_login_ready: !!signInSession,
      auto_login_failed: !signInSession,
    }),
    { status: 200, headers: responseHeaders }
  );

  // Set httpOnly cookies for tokens
  if (accessToken) {
    const accessCookie = [
      `tenant_access_token=${accessToken}`,
      `Max-Age=${7 * 24 * 60 * 60}`,
      'HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/',
    ].join('; ');
    response.headers.append('Set-Cookie', accessCookie);
  }

  if (refreshToken) {
    const refreshCookie = [
      `tenant_refresh_token=${refreshToken}`,
      `Max-Age=${30 * 24 * 60 * 60}`,
      'HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/',
    ].join('; ');
    response.headers.append('Set-Cookie', refreshCookie);
  }

  return response;
}
