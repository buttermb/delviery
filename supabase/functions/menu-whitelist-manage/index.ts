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

    const { action, menu_id, whitelist_id, customer_name, customer_phone, customer_email } = await req.json();

    console.log('Managing whitelist:', { action, menu_id, whitelist_id });

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

    // Verify menu belongs to tenant (for all actions)
    if (menu_id) {
      const { data: menu, error: menuError } = await supabase
        .from('disposable_menus')
        .select('id, tenant_id')
        .eq('id', menu_id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (menuError || !menu) {
        return new Response(
          JSON.stringify({ error: 'Menu not found or access denied' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const response: any = { success: true };

    switch (action) {
      case 'add':
        const generateToken = () => {
          return Array.from({ length: 32 }, () => 
            Math.random().toString(36)[2] || '0'
          ).join('');
        };

        const accessToken = generateToken();

        const { data: whitelistEntry, error: addError } = await supabase
          .from('menu_whitelist')
          .insert({
            menu_id,
            customer_name,
            customer_phone,
            customer_email,
            access_token: accessToken,
            status: 'active'
          })
          .select()
          .single();

        if (addError) {
          throw addError;
        }

        response.whitelist_entry = whitelistEntry;
        response.access_token = accessToken;

        await supabase.from('menu_security_events').insert({
          menu_id,
          event_type: 'whitelist_added',
          severity: 'info',
          description: `Customer ${customer_name} added to whitelist`,
          event_data: { whitelist_id: whitelistEntry.id, customer_name }
        });

        console.log('Whitelist entry created:', whitelistEntry.id);
        break;

      case 'revoke':
        const { error: revokeError } = await supabase
          .from('menu_whitelist')
          .update({ 
            status: 'revoked',
            revoked_at: new Date().toISOString()
          })
          .eq('id', whitelist_id);

        if (revokeError) {
          throw revokeError;
        }

        await supabase.from('menu_security_events').insert({
          menu_id,
          event_type: 'whitelist_revoked',
          severity: 'medium',
          description: 'Whitelist access revoked',
          event_data: { whitelist_id }
        });

        console.log('Whitelist entry revoked:', whitelist_id);
        break;

      case 'regenerate':
        const newToken = Array.from({ length: 32 }, () => 
          Math.random().toString(36)[2] || '0'
        ).join('');

        const { data: updatedEntry, error: regenError } = await supabase
          .from('menu_whitelist')
          .update({ 
            access_token: newToken,
            status: 'active',
            revoked_at: null
          })
          .eq('id', whitelist_id)
          .select()
          .single();

        if (regenError) {
          throw regenError;
        }

        response.whitelist_entry = updatedEntry;
        response.access_token = newToken;

        await supabase.from('menu_security_events').insert({
          menu_id,
          event_type: 'token_regenerated',
          severity: 'info',
          description: 'Access token regenerated',
          event_data: { whitelist_id }
        });

        console.log('Token regenerated for:', whitelist_id);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in menu-whitelist-manage:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
