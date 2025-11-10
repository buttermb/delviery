import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

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

    const requestBody = await req.json();
    const { 
      name, 
      description,
      product_ids,
      min_order_quantity,
      max_order_quantity,
      security_settings,
      custom_prices
    } = requestBody;

    console.log('Creating disposable menu:', { name, product_count: product_ids?.length });

    // Validate required fields
    if (!name || !product_ids || product_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: name and product_ids' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const generateAccessCode = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      return code;
    };

    const generateUrlToken = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let token = '';
      for (let i = 0; i < 32; i++) {
        token += chars[Math.floor(Math.random() * chars.length)];
      }
      return token;
    };

    const accessCode = security_settings?.access_code || generateAccessCode();
    const urlToken = generateUrlToken();
    
    console.log('Generated access code:', accessCode);
    
    // Hash the access code using SHA-256
    const encoder = new TextEncoder();
    const data = encoder.encode(accessCode);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const accessCodeHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    console.log('Generated hash:', accessCodeHash);

    // Get authenticated user
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

    // Validate that all products belong to this tenant
    const { data: productsCheck, error: productsCheckError } = await supabase
      .from('wholesale_inventory')
      .select('id, tenant_id')
      .in('id', product_ids);

    if (productsCheckError) {
      console.error('Product validation error:', productsCheckError);
      return new Response(
        JSON.stringify({ error: 'Failed to validate products' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!productsCheck || productsCheck.length !== product_ids.length) {
      return new Response(
        JSON.stringify({ error: 'Some products not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify all products belong to the same tenant
    const invalidProducts = productsCheck.filter(p => p.tenant_id !== tenantId);
    if (invalidProducts.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Some products do not belong to your tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating menu with settings:', {
      name,
      description,
      product_count: product_ids.length,
      tenant_id: tenantId,
      security_settings,
      min_order_quantity,
      max_order_quantity
    });

    // Create the menu with all settings
    const { data: menu, error: menuError } = await supabase
      .from('disposable_menus')
      .insert({
        name,
        description,
        tenant_id: tenantId,
        access_code: accessCode,
        access_code_hash: accessCodeHash,
        encrypted_url_token: urlToken,
        status: 'active',
        created_by: user.id,
        min_order_quantity: min_order_quantity || 5,
        max_order_quantity: max_order_quantity || 50,
        security_settings: security_settings || {},
        appearance_style: requestBody.appearance_style || 'professional',
        show_product_images: requestBody.show_product_images !== false,
        show_availability: requestBody.show_availability !== false,
        show_contact_info: requestBody.show_contact_info || false,
        custom_message: requestBody.custom_message || null,
      })
      .select()
      .single();

    if (menuError) {
      console.error('Menu creation error:', menuError);
      throw menuError;
    }

    console.log('Menu created successfully:', menu.id);

    // Create product associations in disposable_menu_products table
    const productAssociations = product_ids.map((productId: string, index: number) => ({
      menu_id: menu.id,
      product_id: productId,
      custom_price: custom_prices?.[productId] || null,
      display_availability: true,
      display_order: index
    }));

    console.log('Creating product associations:', productAssociations.length);

    const { data: products, error: productsError } = await supabase
      .from('disposable_menu_products')
      .insert(productAssociations)
      .select();

    if (productsError) {
      console.error('Product association error:', productsError);
      // Delete the menu if product association fails
      await supabase.from('disposable_menus').delete().eq('id', menu.id);
      throw new Error(`Failed to associate products: ${productsError.message}`);
    }

    console.log('Product associations created:', products.length);

    // Log security event
    await supabase.from('menu_security_events').insert({
      menu_id: menu.id,
      event_type: 'menu_created',
      severity: 'info',
      description: `Menu "${name}" created with ${products.length} products`,
      event_data: { 
        menu_id: menu.id, 
        access_code: accessCode,
        product_count: products.length 
      }
    });

    const shareableUrl = `${req.headers.get('origin') || 'https://your-domain.com'}/m/${urlToken}`;

    return new Response(
      JSON.stringify({ 
        success: true, 
        menu, 
        products,
        access_code: accessCode,
        url_token: urlToken,
        shareable_url: shareableUrl
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in menu-generate:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
