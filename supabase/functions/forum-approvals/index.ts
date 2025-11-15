import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify the user is authenticated
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Not authenticated');
    }

    // Verify user is a super admin
    const { data: adminUser, error: adminError } = await supabaseClient
      .from('admin_users')
      .select('role, is_active')
      .eq('user_id', user.id)
      .single();

    if (adminError || !adminUser || !adminUser.is_active) {
      throw new Error('Not authorized');
    }

    const { action, approval_id, rejection_reason } = await req.json();

    if (!action || !approval_id) {
      throw new Error('Missing required parameters');
    }

    if (action === 'approve') {
      // Get the approval record
      const { data: approval, error: approvalError } = await supabaseClient
        .from('forum_user_approvals')
        .select('customer_user_id, status')
        .eq('id', approval_id)
        .single();

      if (approvalError || !approval) {
        throw new Error('Approval not found');
      }

      if (approval.status !== 'pending') {
        throw new Error('Approval already processed');
      }

      // Update approval status
      const { error: updateError } = await supabaseClient
        .from('forum_user_approvals')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', approval_id);

      if (updateError) {
        throw updateError;
      }

      // Check if user already has a forum profile
      const { data: existingProfile } = await supabaseClient
        .from('forum_user_profiles')
        .select('id')
        .eq('user_id', approval.customer_user_id)
        .single();

      // Only create profile if it doesn't exist
      if (!existingProfile) {
        // Get user's profile info
        const { data: userProfile } = await supabaseClient
          .from('profiles')
          .select('email, full_name')
          .eq('user_id', approval.customer_user_id)
          .single();

        // Create forum profile
        const { error: profileError } = await supabaseClient
          .from('forum_user_profiles')
          .insert({
            user_id: approval.customer_user_id,
            username: userProfile?.email?.split('@')[0] || `user_${approval.customer_user_id.slice(0, 8)}`,
            display_name: userProfile?.full_name || 'Anonymous User',
          });

        if (profileError) {
          console.error('Error creating forum profile:', profileError);
          // Don't throw - approval is already updated
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: 'User approved successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'reject') {
      // Update approval status
      const { error: updateError } = await supabaseClient
        .from('forum_user_approvals')
        .update({
          status: 'rejected',
          rejected_by: user.id,
          rejected_at: new Date().toISOString(),
          rejection_reason: rejection_reason || 'No reason provided',
        })
        .eq('id', approval_id);

      if (updateError) {
        throw updateError;
      }

      return new Response(
        JSON.stringify({ success: true, message: 'User rejected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      throw new Error('Invalid action');
    }

  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
