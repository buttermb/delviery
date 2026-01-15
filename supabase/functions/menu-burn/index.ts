import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';

// Input validation schema
const BurnMenuSchema = z.object({
  menu_id: z.string().uuid('Invalid menu ID format'),
  burn_type: z.enum(['soft', 'hard']).default('soft'),
  reason: z.string().max(500).optional(),
  regenerate: z.boolean().optional().default(false),
  auto_regenerate: z.boolean().optional().default(false),
  migrate_customers: z.boolean().optional().default(false),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Validate input
    const body = await req.json();
    const validationResult = BurnMenuSchema.safeParse(body);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: 'Invalid input',
          details: validationResult.error.errors
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { menu_id, burn_type, reason, regenerate, auto_regenerate, migrate_customers } = validationResult.data;

    console.log('Burning menu:', { menu_id, burn_type, reason, regenerate });

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized');
    }

    // Get tenant_id from user
    let tenantId: string | null = null;

    // Try to get from tenant_users table
    const { data: tenantUser } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (tenantUser) {
      tenantId = tenantUser.tenant_id;
    } else {
      // Check if user is tenant owner
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('owner_email', user.email)
        .maybeSingle();

      if (tenant) {
        tenantId = tenant.id;
      }
    }

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found or user not authorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: menu, error: fetchError } = await supabase
      .from('disposable_menus')
      .select('*')
      .eq('id', menu_id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !menu) {
      return new Response(
        JSON.stringify({ error: 'Menu not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const updateData: any = {
      status: 'burned',
      burned_at: new Date().toISOString(),
      burned_by: user.id,
      burn_reason: reason || 'Manual burn'
    };

    if (burn_type === 'hard') {
      console.log('Performing hard burn - deleting menu data');

      await supabase.from('menu_access_logs').delete().eq('menu_id', menu_id);
      await supabase.from('menu_whitelist').delete().eq('menu_id', menu_id);
      await supabase.from('menu_orders').delete().eq('menu_id', menu_id);
      await supabase.from('menu_security_events').delete().eq('menu_id', menu_id);

      const { error: deleteError } = await supabase
        .from('disposable_menus')
        .delete()
        .eq('id', menu_id);

      if (deleteError) {
        throw deleteError;
      }

      console.log('Hard burn completed');
    } else {
      console.log('Performing soft burn - marking as burned');

      const { error: updateError } = await supabase
        .from('disposable_menus')
        .update(updateData)
        .eq('id', menu_id);

      if (updateError) {
        throw updateError;
      }

      console.log('Soft burn completed');
    }

    await supabase.from('menu_security_events').insert({
      menu_id: menu_id,
      event_type: 'menu_burned',
      severity: burn_type === 'hard' ? 'high' : 'medium',
      description: `Menu "${menu.name}" ${burn_type} burned: ${reason || 'Manual burn'}`,
      event_data: { menu_id, burn_type, reason, burned_by: user.id }
    });

    const response: any = { success: true, burn_type };

    // Get whitelist entries for auto-reinvite
    const { data: whitelistEntries } = await supabase
      .from('menu_access_whitelist')
      .select('*')
      .eq('menu_id', menu_id)
      .eq('status', 'active');

    if (regenerate) {
      console.log('Regenerating menu');

      const generateAccessCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
          code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
      };

      const generateUrlToken = () => {
        // Use cryptographic randomness for URL tokens
        return crypto.randomUUID().replace(/-/g, '');
      };

      const newAccessCode = generateAccessCode();
      const newUrlToken = generateUrlToken();

      // Hash the new access code
      const encoder = new TextEncoder();
      const data = encoder.encode(newAccessCode);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const newAccessCodeHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const newExpiresAt = new Date();
      newExpiresAt.setHours(newExpiresAt.getHours() + 24);

      const { data: newMenu, error: createError } = await supabase
        .from('disposable_menus')
        .insert({
          name: menu.name + ' (Regenerated)',
          access_code: newAccessCode,
          access_code_hash: newAccessCodeHash,
          encrypted_url_token: newUrlToken,
          expiration_date: newExpiresAt.toISOString(),
          status: 'active',
          created_by: user.id
        })
        .select()
        .single();

      if (createError) {
        console.error('Regeneration error:', createError);
      } else {
        const shareableUrl = `${req.headers.get('origin') || Deno.env.get('SITE_URL') || 'https://your-domain.com'}/menu/${newUrlToken}`;

        // Copy products from old menu
        const { data: oldProducts } = await supabase
          .from('disposable_menu_products')
          .select('product_id, custom_price, display_order, display_availability')
          .eq('menu_id', menu_id);

        if (oldProducts && oldProducts.length > 0) {
          const newProducts = oldProducts.map(p => ({
            menu_id: newMenu.id,
            product_id: p.product_id,
            custom_price: p.custom_price,
            display_order: p.display_order,
            display_availability: p.display_availability,
          }));

          await supabase
            .from('disposable_menu_products')
            .insert(newProducts);
        }

        // Auto-reinvite customers if requested
        const customersToNotify: any[] = [];

        if (auto_regenerate && migrate_customers && whitelistEntries && whitelistEntries.length > 0) {
          console.log(`Auto-reinviting ${whitelistEntries.length} customers`);

          for (const entry of whitelistEntries) {
            // Create new access token
            const newToken = crypto.randomUUID();

            // Create new whitelist entry
            const { data: newEntry } = await supabase
              .from('menu_access_whitelist')
              .insert({
                menu_id: newMenu.id,
                customer_id: entry.customer_id,
                customer_name: entry.customer_name,
                customer_phone: entry.customer_phone,
                customer_email: entry.customer_email,
                unique_access_token: newToken,
                status: 'pending',
              })
              .select()
              .single();

            if (newEntry) {
              // Send SMS invite via send-menu-access-link function
              const inviteUrl = `${req.headers.get('origin') || Deno.env.get('SITE_URL')}/menu/${newToken}`;
              const smsMessage = `Menu updated for security.\n\nNew Link: ${inviteUrl}\nNew Code: ${newAccessCode}\n\nOld link no longer works.`;

              if (entry.customer_phone) {
                // Invoke SMS function
                try {
                  await supabase.functions.invoke('send-sms', {
                    body: {
                      phone: entry.customer_phone,
                      message: smsMessage,
                    },
                  });

                  // Log invitation
                  await supabase.from('invitations').insert({
                    menu_id: newMenu.id,
                    customer_id: entry.customer_id,
                    phone: entry.customer_phone,
                    method: 'sms',
                    message: smsMessage,
                    unique_link: inviteUrl,
                    status: 'sent',
                  });

                  customersToNotify.push({
                    name: entry.customer_name,
                    phone: entry.customer_phone,
                    status: 'sent',
                  });
                } catch (smsError) {
                  console.error('SMS send error:', smsError);
                  customersToNotify.push({
                    name: entry.customer_name,
                    phone: entry.customer_phone,
                    status: 'failed',
                  });
                }
              }
            }
          }
        }

        response.regenerated_menu = newMenu;
        response.regenerated_menu_id = newMenu.id;
        response.access_code = newAccessCode;
        response.shareable_url = shareableUrl;
        response.customers_to_notify = customersToNotify;
        console.log('Menu regenerated:', newMenu.id);
      }
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in menu-burn:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
