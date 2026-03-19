import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Hardcoded disposable domains as sync fast-path
const DISPOSABLE_DOMAINS = [
  'tempmail.com', 'guerrillamail.com', '10minutemail.com', 'mailinator.com',
  'throwaway.email', 'temp-mail.org', 'fakeinbox.com', 'maildrop.cc',
  'yopmail.com', 'sharklasers.com', 'getnada.com', 'mohmal.com'
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface DisifyResponse {
  format: boolean;
  disposable: boolean;
  dns: boolean;
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
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email || !EMAIL_REGEX.test(email)) {
      return new Response(
        JSON.stringify({ valid: false, isDisposable: false, isSuspicious: false, reason: 'Invalid email format' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const domain = email.split('@')[1];

    // Fast-path: check hardcoded list
    const hardcodedDisposable = DISPOSABLE_DOMAINS.some(d => domain.includes(d));
    if (hardcodedDisposable) {
      return new Response(
        JSON.stringify({ valid: false, isDisposable: true, isSuspicious: false, reason: 'Disposable email addresses are not allowed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check Disify via cache
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const cacheKey = `disify:${domain}`;
    let isDisposable = false;

    const cached = await getCachedResult(supabase, cacheKey);
    if (cached !== null) {
      isDisposable = (cached as { disposable: boolean }).disposable === true;
    } else {
      // Call Disify API
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(`https://disify.com/api/email/${encodeURIComponent(email)}`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.ok) {
          const data: DisifyResponse = await response.json();
          isDisposable = data.disposable === true;
          // Cache by domain with 24h TTL
          await setCachedResult(supabase, cacheKey, { disposable: isDisposable }, 24);
        }
      } catch {
        // Disify unavailable — fall through with hardcoded result only
      }
    }

    if (isDisposable) {
      return new Response(
        JSON.stringify({ valid: false, isDisposable: true, isSuspicious: false, reason: 'Disposable email addresses are not allowed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check suspicious patterns
    const suspiciousPatterns = ['test', 'fake', 'spam', 'noreply', 'bounce'];
    const isSuspicious = suspiciousPatterns.some(p => email.includes(p));

    return new Response(
      JSON.stringify({
        valid: !isSuspicious,
        isDisposable: false,
        isSuspicious,
        domain,
        reason: isSuspicious ? 'Email contains suspicious patterns' : null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Email validation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
