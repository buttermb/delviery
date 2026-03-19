import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BIN_REGEX = /^\d{6,8}$/;

interface BinlistResponse {
  scheme?: string;
  type?: string;
  brand?: string;
  prepaid?: boolean;
  country?: { alpha2?: string; name?: string };
  bank?: { name?: string };
}

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const bin = typeof body?.bin === 'string' ? body.bin.trim() : '';

    if (!bin || !BIN_REGEX.test(bin)) {
      return new Response(
        JSON.stringify({ error: 'bin must be 6-8 digits' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const cacheKey = `binlist:${bin}`;
    const cached = await getCachedResult(supabase, cacheKey);

    if (cached !== null) {
      return new Response(
        JSON.stringify(cached),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch from Binlist (rate limited: 5-10 req/min — caching is critical)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`https://lookup.binlist.net/${bin}`, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data: BinlistResponse = await response.json();
        const result = {
          found: true,
          card: {
            scheme: data.scheme || null,
            type: data.type || null,
            brand: data.brand || null,
            prepaid: data.prepaid ?? null,
            country: data.country ? { alpha2: data.country.alpha2 || null, name: data.country.name || null } : null,
            bank: data.bank ? { name: data.bank.name || null } : null,
          },
        };

        // Cache with 30-day TTL (BIN data rarely changes)
        await setCachedResult(supabase, cacheKey, result, 30 * 24);

        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch {
      // API unavailable
    }

    const notFound = { found: false, card: null };
    return new Response(
      JSON.stringify(notFound),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('BIN lookup error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
