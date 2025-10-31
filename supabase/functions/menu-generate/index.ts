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

    const { name, product_id, expires_in_hours, max_uses } = await req.json();

    console.log('Creating disposable menu:', { name, product_id, expires_in_hours, max_uses });

    const generateAccessCode = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      return code;
    };

    let accessCode = generateAccessCode();
    let isUnique = false;

    while (!isUnique) {
      const { data: existing } = await supabase
        .from('disposable_menus')
        .select('id')
        .eq('access_code', accessCode)
        .single();
      
      if (!existing) {
        isUnique = true;
      } else {
        accessCode = generateAccessCode();
      }
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (expires_in_hours || 24));

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { data: menu, error: menuError } = await supabase
      .from('disposable_menus')
      .insert({
        name,
        product_id,
        access_code: accessCode,
        expires_at: expiresAt.toISOString(),
        max_uses: max_uses || null,
        status: 'active',
        created_by: user.id
      })
      .select()
      .single();

    if (menuError) {
      console.error('Menu creation error:', menuError);
      throw menuError;
    }

    console.log('Menu created successfully:', menu.id);

    await supabase.from('menu_security_events').insert({
      menu_id: menu.id,
      event_type: 'menu_created',
      severity: 'info',
      description: `Menu "${name}" created`,
      event_data: { menu_id: menu.id, access_code: accessCode }
    });

    return new Response(
      JSON.stringify({ success: true, menu, access_code: accessCode }),
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
