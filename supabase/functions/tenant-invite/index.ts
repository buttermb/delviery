// @ts-nocheck
import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { checkUserPermission } from '../_shared/permissions.ts';
import { validateTenantInvite, type TenantInviteInput } from './validation.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Service client for admin operations - declared once at top
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse and validate request body
    let requestBody: TenantInviteInput;
    try {
      const rawBody = await req.json();
      requestBody = validateTenantInvite(rawBody);
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: 'Invalid request body',
          details: error instanceof Error ? error.message : 'Validation failed'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract validated fields
    const action = requestBody.action;
    const tenantId = 'tenantId' in requestBody ? requestBody.tenantId : undefined;
    const email = 'email' in requestBody ? requestBody.email : undefined;
    const role = 'role' in requestBody ? requestBody.role : undefined;
    const inviteToken = 'token' in requestBody ? requestBody.token : undefined;
    const invitationId = 'invitationId' in requestBody ? requestBody.invitationId : undefined;

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

      // Check if user has permission to invite team members
      // Use permission system if available, fallback to role check
      let hasInvitePermission = false;
      try {
        hasInvitePermission = await checkUserPermission(
          serviceClient,
          user.id,
          tenantId,
          'team:invite',
          user.email
        );
      } catch (error) {
        // Fallback to role check if permission system not available
        const { data: tenantUser } = await serviceClient
          .from('tenant_users')
          .select('role')
          .eq('tenant_id', tenantId)
          .eq('user_id', user.id)
          .maybeSingle();
        hasInvitePermission = tenantUser?.role === 'admin' || tenantUser?.role === 'owner' || isOwner;
      }

      if (!hasInvitePermission) {
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

      // Cross-table check: Verify email is not registered as a customer account
      const { data: customerUserExists } = await serviceClient
        .from('customer_users')
        .select('id')
        .eq('email', email.toLowerCase())
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (customerUserExists) {
        return new Response(
          JSON.stringify({
            error: 'This email is registered as a customer account',
            message: 'This email is registered as a customer account. Please use the customer login or invite a different email address.'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check user limit before creating invitation
      // Enterprise plan has unlimited users (skip check)
      if (tenant.subscription_plan !== 'enterprise') {
        // Count active users (excluding pending invitations)
        const { count: activeUsers, error: countError } = await serviceClient
          .from('tenant_users')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'active');

        if (countError) {
          console.error('Error counting users:', countError);
          // Don't block on count error, but log it
        } else {
          // Get user limit from tenant.limits (supports both 'users' and 'team_members')
          const userLimit = (tenant.limits as any)?.users || (tenant.limits as any)?.team_members || 3;

          if (activeUsers !== null && activeUsers >= userLimit) {
            return new Response(
              JSON.stringify({
                error: 'User limit reached',
                message: `You have reached your plan's user limit of ${userLimit} users. Please upgrade your plan to invite more team members.`,
                current_users: activeUsers,
                limit: userLimit,
                upgrade_required: true
              }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }

      // Set expiration (default 7 days)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Create invitation
      const { data: invitation, error: inviteError } = await supabase
        .from('tenant_invitations')
        .insert({
          tenant_id: tenantId,
          email: email.toLowerCase(),
          role,
          invited_by: user.id,
          expires_at: expiresAt.toISOString(),
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

      // Send email with invitation link
      const siteUrl = Deno.env.get('SITE_URL') || Deno.env.get('SUPABASE_URL') || 'https://app.example.com';
      const inviteLink = `${siteUrl}/${tenant.slug}/invite/accept?token=${invitation.token}`;

      // Call send-invitation-email edge function (non-blocking)
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

      // Send email asynchronously (don't wait for response)
      fetch(`${supabaseUrl}/functions/v1/send-invitation-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: email.toLowerCase(),
          tenant_name: tenant.business_name,
          tenant_slug: tenant.slug,
          role,
          invite_link: inviteLink,
          expires_at: expiresAt.toISOString(),
          invited_by: user.email,
        }),
      }).catch((emailError) => {
        // Log error but don't fail the invitation creation
        console.error('Failed to send invitation email:', emailError);
      });

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

      // Verify user has access to this tenant (uses top-level serviceClient)
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

      const { data: invitations, error: listError } = await serviceClient
        .from('tenant_invitations')
        .select('*')
        .eq('tenant_id', tenantId)
        .is('accepted_at', null)
        .order('created_at', { ascending: false });

      if (listError) {
        console.error('List invitations error:', listError);
        return new Response(
          JSON.stringify({ error: 'Failed to list invitations', details: listError.message }),
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
