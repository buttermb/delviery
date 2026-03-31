import type { HandlerContext } from './types.ts';

export async function handleHealth(ctx: HandlerContext): Promise<Response> {
  const hasSupabaseUrl = !!Deno.env.get('SUPABASE_URL');
  const hasServiceRoleKey = !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const hasJwtSecret = !!Deno.env.get('JWT_SECRET');

  return new Response(
    JSON.stringify({
      status: 'ok',
      function: 'customer-auth',
      timestamp: new Date().toISOString(),
      env: {
        SUPABASE_URL: hasSupabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: hasServiceRoleKey,
        JWT_SECRET: hasJwtSecret,
      },
    }),
    { status: 200, headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json' } }
  );
}
