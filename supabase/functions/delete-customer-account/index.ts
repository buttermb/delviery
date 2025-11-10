/**
 * Delete Customer Account (GDPR Compliance)
 * Anonymizes customer data while preserving order history
 */

import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';

const deleteAccountSchema = z.object({
  customer_user_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  reason: z.string().optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { customer_user_id, tenant_id, reason } = deleteAccountSchema.parse(body);

    // Verify customer exists and belongs to tenant
    const { data: customerUser, error: customerError } = await supabase
      .from('customer_users')
      .select('id, email, tenant_id, deleted_at')
      .eq('id', customer_user_id)
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    if (customerError || !customerUser) {
      return new Response(
        JSON.stringify({ error: 'Customer account not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (customerUser.deleted_at) {
      return new Response(
        JSON.stringify({ error: 'Account already deleted' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Anonymize customer data using database function
    const { error: anonymizeError } = await supabase.rpc('anonymize_customer_data', {
      customer_user_id_param: customer_user_id,
    });

    if (anonymizeError) {
      console.error('Failed to anonymize customer data:', anonymizeError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update deletion metadata
    await supabase
      .from('customer_users')
      .update({
        deletion_requested_at: new Date().toISOString(),
        deletion_reason: reason || null,
        status: 'inactive',
      })
      .eq('id', customer_user_id);

    // Revoke all active sessions
    await supabase
      .from('customer_sessions')
      .update({ expires_at: new Date().toISOString() })
      .eq('customer_user_id', customer_user_id)
      .gt('expires_at', new Date().toISOString());

    // Log deletion in audit trail
    await supabase.from('activity_logs').insert({
      user_id: null, // System action
      tenant_id: tenant_id,
      action: 'customer_account_deleted',
      resource: 'customer_users',
      resource_id: customer_user_id,
      metadata: {
        reason: reason || 'No reason provided',
        deleted_at: new Date().toISOString(),
      },
    }).catch(err => {
      console.error('Failed to log deletion:', err);
      // Don't fail if logging fails
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Account deleted successfully. Your data has been anonymized in accordance with GDPR requirements.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Delete account error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to delete account',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

