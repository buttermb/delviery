import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// List of known disposable email domains
const DISPOSABLE_DOMAINS = [
  'tempmail.com', 'guerrillamail.com', '10minutemail.com', 'mailinator.com',
  'throwaway.email', 'temp-mail.org', 'fakeinbox.com', 'maildrop.cc',
  'yopmail.com', 'sharklasers.com', 'getnada.com', 'mohmal.com'
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          reason: "Invalid email format" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const domain = email.split('@')[1].toLowerCase();

    // Check if disposable
    const isDisposable = DISPOSABLE_DOMAINS.some(d => domain.includes(d));
    if (isDisposable) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          reason: "Disposable email addresses are not allowed" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for suspicious patterns
    const suspiciousPatterns = ['test', 'fake', 'spam', 'noreply', 'bounce'];
    const isSuspicious = suspiciousPatterns.some(pattern => 
      email.toLowerCase().includes(pattern)
    );

    return new Response(
      JSON.stringify({ 
        valid: !isSuspicious,
        isDisposable,
        isSuspicious,
        domain,
        reason: isSuspicious ? "Email contains suspicious patterns" : null
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Email validation error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});