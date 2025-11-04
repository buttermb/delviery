import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

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
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { action, tenantId, email, role, token: inviteToken, invitationId } = await req.json();

    // Public actions that don't require authentication
    const publicActions = ['get_invitation_details'];
    
    // Skip auth for public actions
    let user = null;
    if (!publicActions.includes(action)) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Missing authorization header' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !authUser) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      user = authUser;
    }

    if (action === 'send_invitation') {
      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Logging removed - using centralized logger would require client-side only

      // Verify user is tenant owner or admin
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { data: tenant, error: tenantError } = await serviceClient
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single();

      if (tenantError || !tenant) {
        return new Response(
          JSON.stringify({ error: 'Tenant not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if user is tenant owner
      const isOwner = tenant.owner_email?.toLowerCase() === user.email?.toLowerCase();
      
      // Check if user is tenant admin
      const { data: tenantUser } = await serviceClient
        .from('tenant_users')
        .select('role')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .maybeSingle();

      const isAdmin = tenantUser?.role === 'admin' || tenantUser?.role === 'owner';
      
      if (!isOwner && !isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Only tenant owners and admins can send invitations' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if user is already a tenant user
      const { data: existingUser } = await supabase
        .from('tenant_users')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('email', email.toLowerCase())
        .single();

      if (existingUser) {
        return new Response(
          JSON.stringify({ error: 'User is already a member of this tenant' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create invitation
      const { data: invitation, error: inviteError } = await supabase
        .from('tenant_invitations')
        .insert({
          tenant_id: tenantId,
          email: email.toLowerCase(),
          role,
          invited_by: user.id,
        })
        .select()
        .single();

      if (inviteError) {
        return new Response(
          JSON.stringify({ error: 'Failed to create invitation', details: inviteError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Invitation created successfully

      // TODO: Send email with invitation link
      // For now, we'll return the invitation details
      const inviteLink = `${Deno.env.get('SUPABASE_URL')}/invite/${invitation.token}`;

      return new Response(
        JSON.stringify({
          success: true,
          invitation,
          inviteLink,
          message: `Invitation sent to ${email}`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'accept_invitation') {
      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Accepting invitation

      // Verify token is valid and not expired
      const { data: invitation, error: inviteError } = await supabase
        .from('tenant_invitations')
        .select('*, tenants(slug, business_name)')
        .eq('token', inviteToken)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (inviteError || !invitation) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired invitation' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if user email matches invitation email
      if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
        return new Response(
          JSON.stringify({ 
            error: 'Email mismatch', 
            detail: `This invitation was sent to ${invitation.email}. Please sign in with that email.` 
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create tenant_users record
      const { error: userError } = await supabase
        .from('tenant_users')
        .insert({
          tenant_id: invitation.tenant_id,
          user_id: user.id,
          email: invitation.email,
          role: invitation.role,
        });

      if (userError) {
        return new Response(
          JSON.stringify({ error: 'Failed to accept invitation', details: userError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Mark invitation as accepted
      await supabase
        .from('tenant_invitations')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invitation.id);

      // Invitation accepted successfully

      return new Response(
        JSON.stringify({
          success: true,
          tenant: invitation.tenants,
          message: 'Invitation accepted successfully',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'list_invitations') {
      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify user has access to this tenant
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { data: tenant } = await serviceClient
        .from('tenants')
        .select('id, owner_email')
        .eq('id', tenantId)
        .single();

      if (!tenant) {
        return new Response(
          JSON.stringify({ error: 'Tenant not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const isOwner = tenant.owner_email?.toLowerCase() === user.email?.toLowerCase();
      const { data: tenantUser } = await serviceClient
        .from('tenant_users')
        .select('role')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!isOwner && !tenantUser) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: invitations, error: listError } = await supabase
        .from('tenant_invitations')
        .select('*')
        .eq('tenant_id', tenantId)
        .is('accepted_at', null)
        .order('created_at', { ascending: false });

      if (listError) {
        return new Response(
          JSON.stringify({ error: 'Failed to list invitations' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ invitations }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get_invitation_details') {

      // This is a public action - no auth required
      const { data: invitation, error: inviteError } = await supabase
        .from('tenant_invitations')
        .select('*, tenants(slug, business_name)')
        .eq('token', inviteToken)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (inviteError || !invitation) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired invitation' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          invitation: {
            email: invitation.email,
            role: invitation.role,
            tenant_name: invitation.tenants.business_name,
            tenant_slug: invitation.tenants.slug,
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'cancel_invitation') {
      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: deleteError } = await supabase
        .from('tenant_invitations')
        .delete()
        .eq('id', invitationId)
        .eq('tenant_id', tenantId);

      if (deleteError) {
        return new Response(
          JSON.stringify({ error: 'Failed to cancel invitation' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
