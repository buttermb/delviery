import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { withZenProtection } from '../_shared/zen-firewall.ts';

// Request validation schema
const AccessMenuSchema = z.object({
  url_token: z.string().min(1),
  access_code: z.string().min(6),
  device_fingerprint: z.string().optional(),
  geolocation: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
});

serve(withZenProtection(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing environment variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse and validate request
    const body = await req.json();
    const validationResult = AccessMenuSchema.safeParse(body);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: 'Invalid input',
          details: validationResult.error.errors
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessData = validationResult.data;

    // Hash the provided access code
    const encoder = new TextEncoder();
    const accessCodeData = encoder.encode(accessData.access_code);
    const hashBuffer = await crypto.subtle.digest('SHA-256', accessCodeData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const providedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Find menu by URL token
    const { data: menu, error: menuError } = await supabase
      .from('disposable_menus')
      .select('id, access_code_hash, status, expiration_date, never_expires, security_settings')
      .eq('encrypted_url_token', accessData.url_token)
      .single();

    if (menuError || !menu) {
      console.error('Menu not found:', menuError);
      
      // Log failed access attempt
      await supabase.from('menu_access_logs').insert({
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown',
        access_code_correct: false,
      });

      return new Response(
        JSON.stringify({ error: 'Menu not found or invalid token' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify access code
    if (menu.access_code_hash !== providedHash) {
      // Log failed access attempt
      await supabase.from('menu_access_logs').insert({
        menu_id: menu.id,
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown',
        device_fingerprint: accessData.device_fingerprint,
        access_code_correct: false,
      });

      await supabase.from('menu_security_events').insert({
        menu_id: menu.id,
        event_type: 'failed_access_code',
        severity: 'medium',
        details: { attempted_at: new Date().toISOString() },
      });

      return new Response(
        JSON.stringify({ error: 'Invalid access code' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if menu is burned
    if (menu.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Menu is no longer accessible', status: menu.status }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check expiration
    if (!menu.never_expires && menu.expiration_date) {
      const expirationDate = new Date(menu.expiration_date);
      if (expirationDate < new Date()) {
        // Auto-burn expired menu
        await supabase
          .from('disposable_menus')
          .update({ status: 'soft_burned', burned_at: new Date().toISOString(), burn_reason: 'expired' })
          .eq('id', menu.id);

        return new Response(
          JSON.stringify({ error: 'Menu has expired' }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Verify geofencing if required
    const securitySettings = menu.security_settings as Record<string, any>;
    if (securitySettings?.require_geofence && accessData.geolocation) {
      const { latitude, longitude } = accessData.geolocation;
      const centerLat = securitySettings.geofence_lat;
      const centerLng = securitySettings.geofence_lng;
      const radiusKm = securitySettings.geofence_radius;

      // Calculate distance using Haversine formula
      const R = 6371; // Earth's radius in km
      const dLat = (centerLat - latitude) * Math.PI / 180;
      const dLng = (centerLng - longitude) * Math.PI / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(latitude * Math.PI / 180) * Math.cos(centerLat * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      if (distance > radiusKm) {
        await supabase.from('menu_security_events').insert({
          menu_id: menu.id,
          event_type: 'geofence_violation',
          severity: 'high',
          details: { distance_km: distance, allowed_radius_km: radiusKm },
        });

        return new Response(
          JSON.stringify({ error: 'Access denied: outside allowed location' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ACCESS GRANTED - Decrypt and return menu data
    const { data: decryptedMenu, error: decryptError } = await supabase
      .from('disposable_menus_decrypted')
      .select(`
        id,
        name,
        description,
        security_settings,
        appearance_settings,
        min_order_quantity,
        max_order_quantity,
        status,
        expiration_date,
        never_expires,
        tenant_id,
        business_name
      `)
      .eq('id', menu.id)
      .single();

    if (decryptError || !decryptedMenu) {
      console.error('Decryption failed:', decryptError);
      return new Response(
        JSON.stringify({ error: 'Failed to decrypt menu data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get decrypted products
    const { data: products, error: productsError } = await supabase
      .from('disposable_menu_products_decrypted')
      .select(`
        id,
        product_id,
        custom_price,
        display_availability,
        display_order
      `)
      .eq('menu_id', menu.id)
      .order('display_order', { ascending: true });

    if (productsError) {
      console.error('Failed to fetch products:', productsError);
    }

    // Log successful access
    await supabase.from('menu_access_logs').insert({
      menu_id: menu.id,
      ip_address: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown',
      device_fingerprint: accessData.device_fingerprint,
      location: accessData.geolocation ? JSON.stringify(accessData.geolocation) : null,
      access_code_correct: true,
      geofence_pass: securitySettings?.require_geofence ? true : null,
    });

    // Log decryption for audit
    await supabase.from('menu_decryption_audit').insert({
      menu_id: menu.id,
      access_method: 'api_access',
      ip_address: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown',
      success: true,
    });

    return new Response(
      JSON.stringify({
        success: true,
        menu: {
          ...decryptedMenu,
          products: products || [],
        },
        decrypted: true,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}));
