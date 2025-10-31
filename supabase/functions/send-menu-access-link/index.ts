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

    const { whitelistId, method = 'email' } = await req.json();

    if (!whitelistId) {
      throw new Error('Whitelist ID is required');
    }

    // Get whitelist entry and menu details
    const { data: whitelist, error: whitelistError } = await supabase
      .from('menu_access_whitelist')
      .select(`
        *,
        disposable_menus (
          id,
          title,
          description,
          expires_at,
          access_code_required
        )
      `)
      .eq('id', whitelistId)
      .single();

    if (whitelistError) throw whitelistError;

    const menu = whitelist.disposable_menus;
    const accessUrl = `${Deno.env.get('SUPABASE_URL')?.replace('supabase.co', 'lovable.app')}/menu/${whitelist.unique_access_token}${
      menu.access_code_required ? '?code=XXXXX' : ''
    }`;

    // Prepare notification content
    const subject = `Access to ${menu.title}`;
    const message = `
Hello ${whitelist.customer_name || 'Valued Customer'},

You have been granted access to our exclusive menu: ${menu.title}

${menu.description || ''}

Access your menu here:
${accessUrl}

${menu.access_code_required ? 'Note: You will need an access code to view this menu. Please check your messages or contact us.' : ''}

This link expires on: ${new Date(menu.expires_at).toLocaleDateString()}

Best regards,
Your Team
    `.trim();

    if (method === 'email' && whitelist.customer_email) {
      // Send email (placeholder - would integrate with email service)
      console.log('Email notification:', {
        to: whitelist.customer_email,
        subject,
        message,
      });

      // Log the notification
      await supabase.from('account_logs').insert({
        menu_id: menu.id,
        whitelist_entry_id: whitelistId,
        action: 'access_link_sent',
        details: {
          method: 'email',
          recipient: whitelist.customer_email,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Access link sent via email',
          preview: { subject, message },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (method === 'sms' && whitelist.customer_phone) {
      // Send SMS (placeholder - would integrate with SMS service)
      const smsMessage = `${menu.title}: Access your menu at ${accessUrl}${
        menu.access_code_required ? ' (Access code required)' : ''
      }`;

      console.log('SMS notification:', {
        to: whitelist.customer_phone,
        message: smsMessage,
      });

      // Log the notification
      await supabase.from('account_logs').insert({
        menu_id: menu.id,
        whitelist_entry_id: whitelistId,
        action: 'access_link_sent',
        details: {
          method: 'sms',
          recipient: whitelist.customer_phone,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Access link sent via SMS',
          preview: { message: smsMessage },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid method or missing contact information');
  } catch (error: any) {
    console.error('Error sending access link:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
