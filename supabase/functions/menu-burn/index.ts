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

    const { menu_id, burn_type, reason, regenerate } = await req.json();

    console.log('Burning menu:', { menu_id, burn_type, reason, regenerate });

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { data: menu, error: fetchError } = await supabase
      .from('disposable_menus')
      .select('*')
      .eq('id', menu_id)
      .single();

    if (fetchError || !menu) {
      throw new Error('Menu not found');
    }

    let updateData: any = {
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

    let response: any = { success: true, burn_type };

    if (regenerate && menu.product_id) {
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
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let token = '';
        for (let i = 0; i < 32; i++) {
          token += chars[Math.floor(Math.random() * chars.length)];
        }
        return token;
      };

      const newAccessCode = generateAccessCode();
      const newUrlToken = generateUrlToken();
      const newExpiresAt = new Date();
      newExpiresAt.setHours(newExpiresAt.getHours() + 24);

      const { data: newMenu, error: createError } = await supabase
        .from('disposable_menus')
        .insert({
          name: menu.name + ' (Regenerated)',
          access_code: newAccessCode,
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
        response.regenerated_menu = newMenu;
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
