import { serve, createClient, corsHeaders } from '../_shared/deps.ts';

interface NagerHoliday {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  fixed: boolean;
  global: boolean;
  types: string[];
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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const countryCode = typeof body?.countryCode === 'string' ? body.countryCode.toUpperCase() : '';
    const year = typeof body?.year === 'number' ? body.year : new Date().getFullYear();

    if (!countryCode || countryCode.length !== 2) {
      return new Response(
        JSON.stringify({ error: 'countryCode must be a 2-letter ISO code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (year < 2020 || year > 2035) {
      return new Response(
        JSON.stringify({ error: 'year must be between 2020 and 2035' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const cacheKey = `nager:${countryCode}:${year}`;
    const cached = await getCachedResult(supabase, cacheKey);

    if (cached !== null) {
      return new Response(
        JSON.stringify({ holidays: cached }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch from Nager.Date
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(
        `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (response.ok) {
        const data: NagerHoliday[] = await response.json();
        const holidays = data.map(h => ({
          date: h.date,
          name: h.name,
          localName: h.localName,
          fixed: h.fixed,
        }));

        // Cache with 30-day TTL
        await setCachedResult(supabase, cacheKey, holidays, 30 * 24);

        return new Response(
          JSON.stringify({ holidays }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch {
      // API unavailable — return empty
    }

    // Fallback: empty array
    return new Response(
      JSON.stringify({ holidays: [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Public holidays error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
