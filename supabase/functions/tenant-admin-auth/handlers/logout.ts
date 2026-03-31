import type { SupabaseClient } from '../../_shared/deps.ts';
import type { CorsHeaders } from '../utils.ts';

export async function handleLogout(
  req: Request,
  supabase: SupabaseClient,
  corsHeaders: CorsHeaders,
): Promise<Response> {
  // Clear session if token provided (backwards compatibility)
  const authHeader = req.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    await supabase.from('tenant_admin_sessions').delete().eq('token', token);
  }

  // Clear httpOnly cookies by setting them with expired Max-Age
  const clearAccessCookie = [
    'tenant_access_token=',
    'Max-Age=0',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    'Path=/',
  ].join('; ');

  const clearRefreshCookie = [
    'tenant_refresh_token=',
    'Max-Age=0',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    'Path=/',
  ].join('; ');

  const response = new Response(
    JSON.stringify({ success: true }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Set-Cookie': clearAccessCookie,
      },
    }
  );

  // Add second cookie
  response.headers.append('Set-Cookie', clearRefreshCookie);

  return response;
}
