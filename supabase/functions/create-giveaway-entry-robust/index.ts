import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const {
      giveawayId,
      email,
      phone,
      firstName,
      lastName,
      borough,
      instagram,
      deviceFingerprint,
      ipAddress,
      userAgent,
      entryType = 'manual',
      orderId = null
    } = await req.json();

    // Validate required fields
    if (!giveawayId) {
      throw new Error("Giveaway ID is required");
    }

    // Retry logic
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Use database function for atomic operation
        const { data, error } = await supabase.rpc('create_giveaway_entry_safe', {
          p_giveaway_id: giveawayId,
          p_email: email || '',
          p_phone: phone || '',
          p_first_name: firstName || '',
          p_last_name: lastName || '',
          p_borough: borough || '',
          p_instagram: instagram || '',
          p_device_fingerprint: deviceFingerprint || '',
          p_ip_address: ipAddress || 'unknown',
          p_user_agent: userAgent || '',
          p_entry_type: entryType,
          p_order_id: orderId
        });

        if (error) {
          throw error;
        }

        console.log(`Entry created successfully on attempt ${attempt + 1}`);

        return new Response(
          JSON.stringify({
            success: true,
            ...data,
            message: entryType === 'purchase' 
              ? 'Thank you for your purchase! You earned 5 giveaway entries!' 
              : 'Entry created successfully'
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      } catch (error: any) {
        lastError = error;
        console.error(`Attempt ${attempt + 1} failed:`, error.message);

        // Check if error is retryable
        const isRetryable = 
          error.message?.includes('timeout') ||
          error.message?.includes('connection') ||
          error.message?.includes('network') ||
          error.code === 'PGRST301'; // PostgREST timeout

        if (!isRetryable || attempt === MAX_RETRIES - 1) {
          // Non-retryable error or last attempt - break
          break;
        }

        // Wait before retry with exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, attempt))
        );
      }
    }

    // All retries failed - queue for later processing
    console.error('All retry attempts failed, queuing entry');
    
    await supabase.from('giveaway_queue').insert({
      order_id: orderId,
      email: email || '',
      phone: phone || '',
      status: 'pending',
      attempts: 0,
      last_error: lastError?.message
    });

    return new Response(
      JSON.stringify({
        success: true,
        queued: true,
        message: 'Your entry has been received and will be processed shortly'
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Entry creation error:", error);

    // Log error to database
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      await supabase.from('giveaway_errors').insert({
        error_type: 'CREATE_ENTRY_FAILED',
        error_message: error.message,
        error_stack: error.stack,
        attempt_data: await req.json().catch(() => null)
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({ 
        error: 'Unable to process entry. Please try again.',
        errorId: crypto.randomUUID().split('-')[0] // Short error ID for support
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});