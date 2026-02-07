import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { VelocityChecker } from '../_shared/velocity-check.ts';

/**
 * Hash an IP address for privacy-preserving velocity tracking
 */
async function hashIp(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b: number) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * In-memory velocity tracking (fallback when Redis is unavailable)
 * Tracks requests per hashed IP per minute
 */
const inMemoryVelocity = new Map<string, number[]>();
const IN_MEMORY_WINDOW_MS = 60000; // 1 minute
const IN_MEMORY_MAX_REQUESTS = 10;

function checkInMemoryVelocity(menuId: string, ipHash: string): { allowed: boolean; count: number } {
  const key = `${menuId}:${ipHash}`;
  const now = Date.now();
  const existing = inMemoryVelocity.get(key) || [];

  // Clean expired entries
  const recent = existing.filter(ts => now - ts < IN_MEMORY_WINDOW_MS);

  if (recent.length >= IN_MEMORY_MAX_REQUESTS) {
    inMemoryVelocity.set(key, recent);
    return { allowed: false, count: recent.length };
  }

  recent.push(now);
  inMemoryVelocity.set(key, recent);
  return { allowed: true, count: recent.length };
}

// Periodic cleanup of stale entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of inMemoryVelocity.entries()) {
    const recent = timestamps.filter(ts => now - ts < IN_MEMORY_WINDOW_MS);
    if (recent.length === 0) {
      inMemoryVelocity.delete(key);
    } else {
      inMemoryVelocity.set(key, recent);
    }
  }
}, 300000);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== EDGE FUNCTION INVOKED ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Request method:', req.method);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Initialize velocity checker (Redis-based)
    const redisHost = Deno.env.get('REDIS_HOST') || 'localhost';
    const redisPort = parseInt(Deno.env.get('REDIS_PORT') || '6379');
    const redisPassword = Deno.env.get('REDIS_PASSWORD');
    const velocity = new VelocityChecker(redisHost, redisPort, redisPassword);

    const requestBody = await req.json();
    console.log('Received request body:', JSON.stringify(requestBody));

    const {
      encrypted_url_token,
      access_code,
      unique_access_token,
      device_fingerprint,
      location,
      ip_address,
      user_agent
    } = requestBody;

    // Validate input
    if (!encrypted_url_token) {
      console.error('Missing encrypted_url_token');
      return new Response(
        JSON.stringify({
          error: 'Missing menu token',
          field: 'encrypted_url_token'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === VELOCITY CHECK (before DB lookup to protect against enumeration) ===
    const clientIp = req.headers.get('x-forwarded-for') || ip_address || 'unknown';
    const ipHash = await hashIp(clientIp);

    // Try Redis-based velocity check first, fall back to in-memory
    let velocityAllowed = true;
    let velocityAction: string | undefined;

    try {
      const velocityCheck = await velocity.checkVelocity(encrypted_url_token, ipHash);
      velocityAllowed = velocityCheck.allowed;
      velocityAction = velocityCheck.action;

      if (velocityAllowed) {
        await velocity.recordAccess(encrypted_url_token, ipHash);
      }
    } catch (velocityError) {
      // Redis unavailable - use in-memory fallback
      console.warn('Redis velocity check failed, using in-memory fallback:', velocityError);
      const memCheck = checkInMemoryVelocity(encrypted_url_token, ipHash);
      velocityAllowed = memCheck.allowed;
      if (!velocityAllowed) {
        velocityAction = 'soft_burn';
      }
    }

    if (!velocityAllowed) {
      console.log('Velocity limit exceeded for token:', encrypted_url_token, 'IP hash:', ipHash);

      // Log security event
      await supabaseClient.from('menu_security_events').insert({
        menu_id: encrypted_url_token, // Will be overridden if menu found
        event_type: 'velocity_exceeded',
        severity: 'high',
        event_data: {
          ip_hash: ipHash,
          action: velocityAction,
          timestamp: new Date().toISOString(),
          user_agent,
        },
      });

      return new Response(
        JSON.stringify({
          error: 'Too many requests',
          access_granted: false,
          violations: ['Rate limit exceeded - too many access attempts'],
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find menu by token with complete product data including cannabis info
    console.log('Looking up menu with token:', encrypted_url_token);
    const { data: menu, error: menuError } = await supabaseClient
      .from('disposable_menus')
      .select(`
        *,
        disposable_menu_products(
          *,
          product:wholesale_inventory(
            id,
            product_name,
            description,
            category,
            quantity_lbs,
            warehouse_location,
            image_url,
            images,
            base_price,
            prices,
            strain_type,
            thc_percentage,
            cbd_percentage,
            terpenes,
            effects,
            flavors,
            lineage,
            grow_info
          )
        )
      `)
      .eq('encrypted_url_token', encrypted_url_token)
      .maybeSingle();

    console.log('Query result:', JSON.stringify({
      hasMenu: !!menu,
      menuProductsCount: menu?.disposable_menu_products?.length || 0,
      firstProduct: menu?.disposable_menu_products?.[0]
    }));

    if (menuError) {
      console.error('Menu lookup error:', menuError);
      return new Response(
        JSON.stringify({
          access_granted: false,
          violations: ['Database error'],
          error: menuError.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!menu) {
      console.log('Menu not found for token:', encrypted_url_token);
      return new Response(
        JSON.stringify({
          access_granted: false,
          violations: ['Invalid menu URL']
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Menu found:', menu.name);

    // Check menu status
    if (menu.status !== 'active') {
      return new Response(
        JSON.stringify({
          access_granted: false,
          violations: ['Menu is no longer available']
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check expiration
    if (!menu.never_expires && menu.expiration_date) {
      const now = new Date();
      const expiration = new Date(menu.expiration_date);
      if (now > expiration) {
        return new Response(
          JSON.stringify({
            access_granted: false,
            violations: ['Menu has expired']
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validate access code if menu requires it
    let access_code_correct = true;
    if (menu.access_code_hash) {
      // Menu requires access code
      if (!access_code) {
        console.error('Menu requires access code but none provided');
        return new Response(
          JSON.stringify({
            error: 'Access code required',
            field: 'access_code',
            access_granted: false,
            violations: ['Access code required for this menu']
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const hashAccessCode = async (code: string) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(code);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      };

      const codeHash = await hashAccessCode(access_code);
      access_code_correct = codeHash === menu.access_code_hash;

      if (!access_code_correct) {
        // Log failed attempt
        await supabaseClient.from('menu_security_events').insert({
          menu_id: menu.id,
          event_type: 'failed_access_code',
          severity: 'medium',
          event_data: { ip_address, device_fingerprint }
        });

        // Record failed attempt for velocity tracking
        try {
          await velocity.recordFailedAttempt(menu.id, ipHash);
        } catch {
          // Redis unavailable - continue
        }

        return new Response(
          JSON.stringify({
            access_granted: false,
            violations: ['Incorrect access code']
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      console.log('No access code required for this menu');
    }

    const violations: string[] = [];
    const security_settings = menu.security_settings || {};
    let whitelist_entry: Record<string, unknown> | null = null;

    // Check geofencing
    let geofence_pass = true;
    if (security_settings.geofencing?.enabled && location) {
      const zones = security_settings.geofencing.zones || [];
      geofence_pass = zones.some((zone: { lat: number; lng: number; radius_miles: number }) => {
        const distance = calculateDistance(
          location.lat, location.lng,
          zone.lat, zone.lng
        );
        return distance <= zone.radius_miles;
      });

      if (!geofence_pass) {
        violations.push('Outside allowed area');
        await supabaseClient.from('menu_security_events').insert({
          menu_id: menu.id,
          event_type: 'geofence_violation',
          severity: 'high',
          event_data: { location, ip_address }
        });
      }
    }

    // Check time restrictions
    let time_restriction_pass = true;
    if (security_settings.time_restrictions?.enabled) {
      const now = new Date();
      const currentHour = now.getHours();

      const hours = security_settings.time_restrictions.hours || {};
      const startHour = parseInt(hours.start?.split(':')[0] || '0');
      const endHour = parseInt(hours.end?.split(':')[0] || '23');

      time_restriction_pass = currentHour >= startHour && currentHour <= endHour;

      if (!time_restriction_pass) {
        violations.push('Outside allowed hours');
      }
    }

    // Check whitelist if invite-only
    // SECURITY FIX: For invite_only menus, ALWAYS require unique_access_token
    if (security_settings.access_type === 'invite_only') {
      // Token is REQUIRED for invite-only menus
      if (!unique_access_token) {
        violations.push('Invite token required for this menu');
        await supabaseClient.from('menu_security_events').insert({
          menu_id: menu.id,
          event_type: 'missing_invite_token',
          severity: 'high',
          event_data: { ip_address, device_fingerprint }
        });
      } else {
        // Validate the provided token
        const { data: whitelist } = await supabaseClient
          .from('menu_access_whitelist')
          .select('*')
          .eq('menu_id', menu.id)
          .eq('unique_access_token', unique_access_token)
          .single();

        if (!whitelist || whitelist.status === 'revoked' || whitelist.status === 'blocked') {
          violations.push('Access revoked or not invited');
        } else {
          whitelist_entry = whitelist as Record<string, unknown>;

          // Check device locking
          if (security_settings.device_locking?.enabled && whitelist.device_fingerprint) {
            if (whitelist.device_fingerprint !== device_fingerprint) {
              violations.push('Different device detected');
              await supabaseClient.from('menu_security_events').insert({
                menu_id: menu.id,
                access_whitelist_id: whitelist.id,
                event_type: 'new_device_detected',
                severity: 'high',
                event_data: {
                  old_fingerprint: whitelist.device_fingerprint,
                  new_fingerprint: device_fingerprint
                }
              });
            }
          }

          // Check view limits
          if (security_settings.view_limits?.enabled) {
            const maxViews = security_settings.view_limits.max_views_per_week || 5;
            if (whitelist.view_count >= maxViews) {
              violations.push(`View limit reached (${maxViews} per week)`);
              await supabaseClient.from('menu_security_events').insert({
                menu_id: menu.id,
                access_whitelist_id: whitelist.id,
                event_type: 'excessive_views',
                severity: 'medium',
                event_data: { view_count: whitelist.view_count, max_views: maxViews }
              });
            }
          }
        }
      }
    }

    // Log access attempt
    await supabaseClient.from('menu_access_logs').insert({
      menu_id: menu.id,
      access_whitelist_id: whitelist_entry?.id || null,
      ip_address,
      user_agent,
      device_fingerprint,
      location,
      geofence_pass,
      time_restriction_pass,
      access_code_correct,
      suspicious_flags: violations.length > 0 ? violations : null
    });

    const access_granted = violations.length === 0;

    if (access_granted) {
      // Transform products: flatten the nested structure and include cannabis data
      const products = (menu.disposable_menu_products || []).map((mp: Record<string, unknown>) => {
        const product = (mp.product || {}) as Record<string, unknown>;
        return {
          id: mp.product_id,
          name: product.product_name || 'Unknown Product',
          description: product.description || `Premium ${product.category || 'cannabis'} product`,
          price: mp.custom_price || product.base_price || 0,
          prices: mp.prices || product.prices || null,
          quantity_lbs: product.quantity_lbs || 0,
          category: product.category || '',
          display_order: mp.display_order,
          image_url: product.image_url || null,
          images: product.images || [],
          strain_type: product.strain_type,
          thc_percentage: product.thc_percentage,
          cbd_percentage: product.cbd_percentage,
          terpenes: product.terpenes || [],
          effects: product.effects || [],
          flavors: product.flavors || [],
          lineage: product.lineage,
          grow_info: product.grow_info,
        };
      });

      console.log('Transformed products:', products.length, 'items');

      return new Response(
        JSON.stringify({
          access_granted: true,
          menu_data: {
            id: menu.id,
            name: menu.name,
            description: menu.description,
            products: products,
            menu_id: menu.id,
            whitelist_id: whitelist_entry?.id || null,
            min_order_quantity: menu.min_order_quantity,
            max_order_quantity: menu.max_order_quantity,
            expiration_date: menu.expiration_date,
            never_expires: menu.never_expires,
            appearance_settings: menu.appearance_settings || {
              show_product_images: true,
              show_availability: true
            },
            security_settings: security_settings // Include security_settings so frontend can check menu_type
          },
          remaining_views: whitelist_entry
            ? (security_settings.view_limits?.max_views_per_week || 999) - ((whitelist_entry.view_count as number) || 0)
            : null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({
          access_granted: false,
          violations
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Unhandled error in menu-access-validate:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Haversine formula to calculate distance between two coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
