import type { SupabaseClient } from '../../_shared/deps.ts';
import { refreshSchema } from '../validation.ts';
import type { CorsHeaders } from '../utils.ts';
import { errorResponse } from '../utils.ts';

export async function handleRefresh(
  req: Request,
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  corsHeaders: CorsHeaders,
): Promise<Response> {
  // STEP 1: Get refresh token from request body or cookie (fallback)
  let refresh_token: string | null = null;

  // Try to get from request body first
  const validationResult = refreshSchema.safeParse(body);
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

    return errorResponse(corsHeaders, 400, 'Refresh token is required', {
      reason: 'missing_refresh_token',
      details: 'No valid refresh token was provided in the request body or cookies',
    });
  }

  console.error('Attempting token refresh', {
    tokenLength: refresh_token.length,
    tokenPrefix: refresh_token.substring(0, 10) + '...',
  });

  // STEP 3: Attempt to refresh the session
  const { data, error } = await supabase.auth.refreshSession({
    refresh_token,
  });

  if (error || !data.session) {
    console.error('Token refresh error:', error);
    console.error('Refresh request details:', {
      hasRefreshToken: !!refresh_token,
      tokenLength: refresh_token?.length,
      errorMsg: error?.message,
      errorCode: error?.status,
      hasSession: !!data?.session,
    });

    return errorResponse(corsHeaders, 401, 'Failed to refresh token', {
      reason: error?.message?.includes('Invalid Refresh Token') ? 'invalid_refresh_token' : 'refresh_failed',
      details: error?.message || 'Session refresh returned no data',
    });
  }

  // STEP 4: Prepare httpOnly cookie options
  const cookieOptions = [
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${7 * 24 * 60 * 60}`,
  ].join('; ');

  // Use longer expiry for refresh token cookie
  const refreshCookieOptions = [
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${30 * 24 * 60 * 60}`,
  ].join('; ');

  console.error('Token refresh successful', {
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
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Set-Cookie': `tenant_access_token=${data.session?.access_token}; ${cookieOptions}`,
      },
    }
  );

  // Add refresh token cookie with longer expiry
  response.headers.append('Set-Cookie', `tenant_refresh_token=${data.session?.refresh_token}; ${refreshCookieOptions}`);

  return response;
}
