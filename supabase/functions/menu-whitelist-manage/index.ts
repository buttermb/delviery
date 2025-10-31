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
      menu_id,
      action,
      customer_data,
      whitelist_id
    } = await req.json();

    // Validate input
    if (!menu_id || !action) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: menu_id, action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const generateToken = () => {
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let token = '';
      for (let i = 0; i < 12; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return token;
    };

    // Handle different actions
    switch (action) {
      case 'add': {
        if (!customer_data?.name || !customer_data?.phone) {
          return new Response(
            JSON.stringify({ error: 'Missing customer data' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const uniqueToken = generateToken();

        const { data: whitelist, error: addError } = await supabaseClient
          .from('menu_access_whitelist')
          .insert({
            menu_id,
            customer_id: customer_data.customer_id || null,
            customer_name: customer_data.name,
            customer_phone: customer_data.phone,
            customer_email: customer_data.email || null,
            unique_access_token: uniqueToken,
            invited_by: user.id
          })
          .select()
          .single();

        if (addError) throw addError;

        // Get menu URL
        const { data: menu } = await supabaseClient
          .from('disposable_menus')
          .select('encrypted_url_token')
          .eq('id', menu_id)
          .single();

        return new Response(
          JSON.stringify({
            success: true,
            whitelist_id: whitelist.id,
            access_url: `${Deno.env.get('SUPABASE_URL')?.replace('/rest/v1', '')}/m/${menu?.encrypted_url_token}?u=${uniqueToken}`,
            invitation_sent: false // SMS/email sending would be implemented separately
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'revoke': {
        if (!whitelist_id) {
          return new Response(
            JSON.stringify({ error: 'Missing whitelist_id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: revokeError } = await supabaseClient
          .from('menu_access_whitelist')
          .update({
            status: 'revoked',
            revoked_at: new Date().toISOString(),
            revoked_reason: customer_data?.reason || 'Manually revoked'
          })
          .eq('id', whitelist_id);

        if (revokeError) throw revokeError;

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'regenerate_token': {
        if (!whitelist_id) {
          return new Response(
            JSON.stringify({ error: 'Missing whitelist_id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const newToken = generateToken();

        const { error: updateError } = await supabaseClient
          .from('menu_access_whitelist')
          .update({
            unique_access_token: newToken,
            status: 'pending',
            view_count: 0
          })
          .eq('id', whitelist_id);

        if (updateError) throw updateError;

        const { data: menu } = await supabaseClient
          .from('disposable_menus')
          .select('encrypted_url_token')
          .eq('id', menu_id)
          .single();

        return new Response(
          JSON.stringify({
            success: true,
            new_access_url: `${Deno.env.get('SUPABASE_URL')?.replace('/rest/v1', '')}/m/${menu?.encrypted_url_token}?u=${newToken}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
