import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrackAccessRequest {
  userId: string;
  fingerprint: string;
  deviceType?: string;
  browser?: string;
  os?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, fingerprint, deviceType, browser, os } = await req.json() as TrackAccessRequest;

    // Get IP address from request headers
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                      req.headers.get('x-real-ip') || 
                      'unknown';

    console.log('Tracking access:', { userId, fingerprint, ipAddress });

    // Check if IP is blocked
    const { data: ipBlocked } = await supabase
      .rpc('is_ip_blocked', { _ip_address: ipAddress });

    if (ipBlocked) {
      return new Response(
        JSON.stringify({ blocked: true, reason: 'IP address is blocked' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403
        }
      );
    }

    // Check if device is blocked
    const { data: deviceBlocked } = await supabase
      .rpc('is_device_blocked', { _fingerprint: fingerprint });

    if (deviceBlocked) {
      return new Response(
        JSON.stringify({ blocked: true, reason: 'Device is blocked' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403
        }
      );
    }

    // Track IP address usage
    await supabase.rpc('track_ip_address', {
      _user_id: userId,
      _ip_address: ipAddress,
    });

    // Track device access
    await supabase
      .from('device_fingerprints')
      .update({ last_seen: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('fingerprint', fingerprint);

    // Log account access
    await supabase
      .from('account_logs')
      .insert({
        user_id: userId,
        action_type: 'login',
        description: 'User accessed the site',
        ip_address: ipAddress,
        device_fingerprint: fingerprint,
      });

    return new Response(
      JSON.stringify({ blocked: false, ipAddress }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('Error in track-access function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});