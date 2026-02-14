// Edge Function: report-security-event
// Receives client-side security events (screenshot detection, devtools, etc.)
// and logs them + triggers auto-burn when appropriate
import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';

const securityEventSchema = z.object({
  menu_id: z.string().uuid(),
  event_type: z.enum([
    'screenshot_detected',
    'print_screen_key',
    'devtools_opened',
    'clipboard_copy_attempt',
    'print_attempt',
    'visibility_hidden',
    'snipping_tool_detected',
  ]),
  metadata: z.record(z.unknown()).optional(),
  device_fingerprint: z.string().optional(),
});

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const rawBody = await req.json();
    const validationResult = securityEventSchema.safeParse(rawBody);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid event data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { menu_id, event_type, metadata, device_fingerprint } = validationResult.data;
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';

    // Determine severity based on event type
    const severityMap: Record<string, string> = {
      screenshot_detected: 'high',
      print_screen_key: 'high',
      snipping_tool_detected: 'high',
      devtools_opened: 'high',
      clipboard_copy_attempt: 'medium',
      print_attempt: 'medium',
      visibility_hidden: 'low',
    };

    const severity = severityMap[event_type] || 'medium';

    // Log the security event
    const { error: insertError } = await supabase.from('menu_security_events').insert({
      menu_id,
      event_type,
      severity,
      event_data: {
        ...metadata,
        ip_address: clientIp,
        device_fingerprint,
        user_agent: req.headers.get('user-agent'),
        reported_at: new Date().toISOString(),
      },
    });

    if (insertError) {
      console.error('Failed to insert security event:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to log event' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check menu security settings for auto-burn configuration
    const { data: menu } = await supabase
      .from('disposable_menus')
      .select('id, security_settings, status')
      .eq('id', menu_id)
      .maybeSingle();

    if (menu && menu.status === 'active') {
      const securitySettings = menu.security_settings || {};
      const screenshotAction = securitySettings.screenshot_attempt_action;

      // Auto-burn if configured for screenshot events
      const burnTriggerEvents = ['screenshot_detected', 'print_screen_key', 'snipping_tool_detected'];
      if (burnTriggerEvents.includes(event_type) && screenshotAction === 'burn') {
        // Burn the menu
        await supabase
          .from('disposable_menus')
          .update({
            status: 'burned',
            burned_at: new Date().toISOString(),
            burn_reason: `auto_burn:${event_type}`,
          })
          .eq('id', menu_id);

        // Log the auto-burn event
        await supabase.from('menu_security_events').insert({
          menu_id,
          event_type: 'auto_burn_triggered',
          severity: 'critical',
          event_data: {
            trigger: event_type,
            burn_type: 'soft',
            ip_address: clientIp,
            device_fingerprint,
          },
        });

        return new Response(
          JSON.stringify({ logged: true, action: 'burned' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Block if configured
      if (burnTriggerEvents.includes(event_type) && screenshotAction === 'block') {
        return new Response(
          JSON.stringify({ logged: true, action: 'blocked' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ logged: true, action: 'logged' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in report-security-event:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
