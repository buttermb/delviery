// Handler: health check
import type { HandlerContext } from '../utils.ts';

export async function handleHealth(
  ctx: HandlerContext,
): Promise<Response> {
  return new Response(
    JSON.stringify({
      status: 'ok',
      function: 'super-admin-auth',
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json' },
    },
  );
}
