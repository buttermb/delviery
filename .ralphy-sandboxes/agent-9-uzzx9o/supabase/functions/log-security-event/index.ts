import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const {
      menu_id,
      customer_id,
      event_type,
      event_data,
      severity = 'medium',
    } = await req.json();

    // Determine severity based on event type
    let eventSeverity = severity;
    if (event_type === 'screenshot_attempt') {
      eventSeverity = 'high';
    } else if (event_type === 'devtools') {
      eventSeverity = 'medium';
    } else if (event_type === 'right_click') {
      eventSeverity = 'low';
    }

    // Insert security event
    const { data, error } = await supabase
      .from('menu_security_events')
      .insert({
        menu_id,
        customer_id,
        event_type,
        event_data: event_data || {},
        severity: eventSeverity,
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        device_fingerprint: event_data?.device_fingerprint,
      })
      .select()
      .single();

    if (error) {
      console.error('Error logging security event:', error);
      throw error;
    }

    // If high severity, also update menu access logs
    if (eventSeverity === 'high' && customer_id) {
      await supabase
        .from('menu_access_logs')
        .update({
          actions_taken: supabase.rpc('jsonb_append', {
            array_field: 'actions_taken',
            value: { type: event_type, timestamp: new Date().toISOString() },
          }),
        })
        .eq('customer_id', customer_id)
        .eq('menu_id', menu_id);
    }

    return new Response(
      JSON.stringify({ success: true, event_id: data.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in log-security-event:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

