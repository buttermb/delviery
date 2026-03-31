import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { errorResponse } from "../_shared/error-response.ts";

const CURRENCY_REGEX = /^[A-Z]{3}$/;

async function getCachedResult(supabase: ReturnType<typeof createClient>, cacheKey: string): Promise<unknown | null> {
  const { data } = await supabase
    .from('api_cache')
    .select('response')
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  return data?.response ?? null;
}

async function setCachedResult(supabase: ReturnType<typeof createClient>, cacheKey: string, response: unknown, ttlHours: number): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
  await supabase
    .from('api_cache')
    .upsert({ cache_key: cacheKey, response, expires_at: expiresAt }, { onConflict: 'cache_key' });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body?.action as string | undefined;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // List currencies mode
    if (action === 'currencies') {
      const cacheKey = 'frankfurter:currencies';
      const cached = await getCachedResult(supabase, cacheKey);
      if (cached !== null) {
        return new Response(
          JSON.stringify({ currencies: cached }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch('https://api.frankfurter.dev/currencies', {
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.ok) {
          const currencies = await response.json();
          await setCachedResult(supabase, cacheKey, currencies, 24);
          return new Response(
            JSON.stringify({ currencies }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch {
        // API unavailable
      }

      return errorResponse(503, 'Currency service unavailable');
    }

    // Convert mode
    const from = typeof body?.from === 'string' ? body.from.toUpperCase() : '';
    const to = typeof body?.to === 'string' ? body.to.toUpperCase() : '';
    const amount = typeof body?.amount === 'number' ? body.amount : 0;

    if (!from || !CURRENCY_REGEX.test(from)) {
      return errorResponse(400, 'from must be a 3-letter currency code');
    }
    if (!to || !CURRENCY_REGEX.test(to)) {
      return errorResponse(400, 'to must be a 3-letter currency code');
    }

    if (from === to) {
      return new Response(
        JSON.stringify({ convertedAmount: amount, rate: 1, from, to, date: new Date().toISOString().split('T')[0] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `frankfurter:${from}:${to}:${today}`;
    const cached = await getCachedResult(supabase, cacheKey);

    if (cached !== null) {
      const c = cached as { rate: number; date: string };
      const convertedAmount = Math.round(amount * c.rate * 100) / 100;
      return new Response(
        JSON.stringify({ convertedAmount, rate: c.rate, from, to, date: c.date }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(
        `https://api.frankfurter.dev/latest?from=${from}&to=${to}&amount=${amount}`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        const convertedAmount = data.rates?.[to] ?? 0;
        const rate = amount > 0 ? convertedAmount / amount : 0;
        const date = data.date ?? today;

        await setCachedResult(supabase, cacheKey, { rate, date }, 4);

        return new Response(
          JSON.stringify({ convertedAmount, rate, from, to, date }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch {
      // API unavailable
    }

    return errorResponse(503, 'Currency service unavailable');
  } catch (error: unknown) {
    console.error('Currency convert error:', error);
    return errorResponse(500, error instanceof Error ? error.message : 'Unknown error');
  }
});
