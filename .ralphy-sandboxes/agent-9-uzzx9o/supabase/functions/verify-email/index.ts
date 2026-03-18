import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Request schema
const RequestSchema = z.object({
  email: z.string().email(),
  checkMx: z.boolean().optional().default(true),
  checkDisposable: z.boolean().optional().default(true),
});

// Common disposable email domains
const DISPOSABLE_DOMAINS = new Set([
  'tempmail.com', 'throwaway.email', 'guerrillamail.com', 'mailinator.com',
  'temp-mail.org', '10minutemail.com', 'fakeinbox.com', 'trashmail.com',
  'dispostable.com', 'sharklasers.com', 'guerrillamail.info', 'grr.la',
  'guerrillamail.biz', 'guerrillamail.de', 'guerrillamail.net', 'guerrillamail.org',
  'spam4.me', 'yopmail.com', 'yopmail.fr', 'yopmail.net', 'cool.fr.nf',
  'jetable.fr.nf', 'nospam.ze.tc', 'nomail.xl.cx', 'mega.zik.dj',
  'speed.1s.fr', 'courriel.fr.nf', 'moncourrier.fr.nf', 'monemail.fr.nf',
  'monmail.fr.nf', 'tempinbox.com', 'tmpeml.info', 'tmpmail.net',
  'tmpmail.org', 'emailondeck.com', 'getnada.com', 'mohmal.com',
  'minutemail.com', 'tempail.com', 'emailfake.com', 'generator.email',
  'inboxkitten.com', 'emailnax.com', 'mailsac.com', 'maildrop.cc',
  'getairmail.com', 'fakemailgenerator.com', 'throwawaymail.com',
]);

// Common free email providers (not necessarily bad, but useful info)
const FREE_PROVIDERS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com', 'gmx.com',
  'yandex.com', 'live.com', 'msn.com',
]);

interface VerificationResult {
  email: string;
  isValid: boolean;
  isDisposable: boolean;
  isFreeProvider: boolean;
  hasMxRecords: boolean;
  domain: string;
  mxRecords: string[];
  syntaxValid: boolean;
  score: number; // 0-100 confidence score
  reason?: string;
}

async function checkMxRecords(domain: string): Promise<{ hasMx: boolean; records: string[] }> {
  try {
    const records = await Deno.resolveDns(domain, "MX");
    const mxHosts = records.map((r) => r.exchange);
    return { hasMx: mxHosts.length > 0, records: mxHosts };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.log(`MX lookup failed for ${domain}:`, errorMsg);
    return { hasMx: false, records: [] };
  }
}

function calculateScore(result: Partial<VerificationResult>): number {
  let score = 0;
  
  // Syntax valid: +30
  if (result.syntaxValid) score += 30;
  
  // Has MX records: +40
  if (result.hasMxRecords) score += 40;
  
  // Not disposable: +20
  if (!result.isDisposable) score += 20;
  
  // Business email (not free provider): +10
  if (!result.isFreeProvider) score += 10;
  
  return Math.min(score, 100);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { email, checkMx, checkDisposable } = RequestSchema.parse(body);
    
    console.log(`Verifying email: ${email}`);
    
    // Extract domain
    const [, domain] = email.toLowerCase().split('@');
    
    if (!domain) {
      return new Response(JSON.stringify({
        email,
        isValid: false,
        reason: 'Invalid email format - no domain found',
        score: 0,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result: Partial<VerificationResult> = {
      email: email.toLowerCase(),
      domain,
      syntaxValid: true,
      isDisposable: false,
      isFreeProvider: false,
      hasMxRecords: false,
      mxRecords: [],
    };

    // Check if disposable
    if (checkDisposable) {
      result.isDisposable = DISPOSABLE_DOMAINS.has(domain);
    }

    // Check if free provider
    result.isFreeProvider = FREE_PROVIDERS.has(domain);

    // Check MX records
    if (checkMx) {
      const mxResult = await checkMxRecords(domain);
      result.hasMxRecords = mxResult.hasMx;
      result.mxRecords = mxResult.records;
    }

    // Calculate overall validity and score
    result.score = calculateScore(result);
    result.isValid = result.syntaxValid && result.hasMxRecords && !result.isDisposable;

    // Add reason if not valid
    if (!result.isValid) {
      if (!result.hasMxRecords) {
        result.reason = 'Domain does not have valid mail servers';
      } else if (result.isDisposable) {
        result.reason = 'Disposable email addresses are not allowed';
      }
    }

    console.log(`Email verification result for ${email}:`, result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Email verification error:', error);
    
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({
        error: 'Invalid request',
        details: error.errors,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      error: 'Verification failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
