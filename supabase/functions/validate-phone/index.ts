import { serve, corsHeaders } from '../_shared/deps.ts';

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();

    if (!phone) {
      throw new Error("Phone number is required");
    }

    // Remove all non-numeric characters
    const cleanPhone = phone.replace(/\D/g, '');

    // Basic validation
    if (cleanPhone.length < 10) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          reason: "Phone number must be at least 10 digits" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for fake numbers (555 prefix in US)
    const isFake = cleanPhone.match(/^1?555\d{7}$/);
    if (isFake) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          reason: "Invalid phone number" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for repeated digits (suspicious)
    const hasRepeatedDigits = /(\d)\1{6,}/.test(cleanPhone);
    if (hasRepeatedDigits) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          reason: "Phone number appears invalid" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        valid: true,
        cleanPhone,
        formatted: formatPhone(cleanPhone)
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Phone validation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

function formatPhone(phone: string): string {
  const match = phone.match(/^1?(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phone;
}