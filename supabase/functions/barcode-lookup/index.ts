import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BARCODE_REGEX = /^\d{6,20}$/;

interface OpenFoodFactsProduct {
  product_name?: string;
  brands?: string;
  image_url?: string;
  categories?: string;
  ingredients_text?: string;
  quantity?: string;
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
    const barcode = typeof body?.barcode === 'string' ? body.barcode.trim() : '';

    if (!barcode || !BARCODE_REGEX.test(barcode)) {
      return new Response(
        JSON.stringify({ error: 'barcode must be 6-20 digits' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const cacheKey = `openfoodfacts:${barcode}`;
    const cached = await getCachedResult(supabase, cacheKey);

    if (cached !== null) {
      return new Response(
        JSON.stringify(cached),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch from Open Food Facts
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}?fields=product_name,brands,image_url,categories,ingredients_text,quantity`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        if (data.status === 1 && data.product) {
          const p: OpenFoodFactsProduct = data.product;
          const result = {
            found: true,
            product: {
              name: p.product_name || null,
              brand: p.brands || null,
              imageUrl: p.image_url || null,
              category: p.categories || null,
              description: p.ingredients_text || null,
            },
          };
          await setCachedResult(supabase, cacheKey, result, 7 * 24);
          return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } catch {
      // API unavailable
    }

    const notFound = { found: false, product: null };
    await setCachedResult(supabase, cacheKey, notFound, 24);

    return new Response(
      JSON.stringify(notFound),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Barcode lookup error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
