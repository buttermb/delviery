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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Verify authenticated user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      name,
      description,
      product_ids,
      security_settings,
      appearance_settings,
      min_order_quantity = 5,
      max_order_quantity = 50,
      custom_prices = {}
    } = await req.json();

    // Validate input
    if (!name || !product_ids || product_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: name, product_ids' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique encrypted URL token (12 characters)
    const generateToken = () => {
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let token = '';
      for (let i = 0; i < 12; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return token;
    };

    // Generate unique access code (4 digits)
    const generateAccessCode = () => {
      return Math.floor(1000 + Math.random() * 9000).toString();
    };

    // Hash access code using Web Crypto API
    const hashAccessCode = async (code: string) => {
      const encoder = new TextEncoder();
      const data = encoder.encode(code);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    let encrypted_url_token = generateToken();
    let accessCode = generateAccessCode();
    const accessCodeHash = await hashAccessCode(accessCode);

    // Ensure token is unique
    let tokenExists = true;
    let attempts = 0;
    while (tokenExists && attempts < 10) {
      const { data: existing } = await supabaseClient
        .from('disposable_menus')
        .select('id')
        .eq('encrypted_url_token', encrypted_url_token)
        .single();
      
      if (!existing) {
        tokenExists = false;
      } else {
        encrypted_url_token = generateToken();
        attempts++;
      }
    }

    // Create menu
    const { data: menu, error: menuError } = await supabaseClient
      .from('disposable_menus')
      .insert({
        name,
        description,
        encrypted_url_token,
        access_code_hash: accessCodeHash,
        security_settings: security_settings || {},
        appearance_settings: appearance_settings || {},
        min_order_quantity,
        max_order_quantity,
        created_by: user.id
      })
      .select()
      .single();

    if (menuError) {
      console.error('Menu creation error:', menuError);
      throw menuError;
    }

    // Add products to menu
    const menuProducts = product_ids.map((product_id: string, index: number) => ({
      menu_id: menu.id,
      product_id,
      custom_price: custom_prices[product_id] || null,
      display_order: index
    }));

    const { error: productsError } = await supabaseClient
      .from('disposable_menu_products')
      .insert(menuProducts);

    if (productsError) {
      console.error('Products insertion error:', productsError);
      // Rollback menu creation
      await supabaseClient.from('disposable_menus').delete().eq('id', menu.id);
      throw productsError;
    }

    console.log(`Menu created successfully: ${menu.id}, token: ${encrypted_url_token}`);

    return new Response(
      JSON.stringify({
        success: true,
        menu_id: menu.id,
        encrypted_url: `${Deno.env.get('SUPABASE_URL')?.replace('/rest/v1', '')}/m/${encrypted_url_token}`,
        access_code: accessCode, // Return plain text code for admin
        token: encrypted_url_token
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
