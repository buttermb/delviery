/**
 * Staff Management Edge Function
 * Handles CRUD operations for tenant_users with proper authentication
 */

import { serve, createClient, corsHeaders } from '../_shared/deps.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create client with user token for auth validation
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    let requestBody: Record<string, unknown> = {};
    try {
      requestBody = await req.json();
    } catch {
      requestBody = {};
    }

    const { action, tenant_id, user_id, email, role, name } = requestBody;

    // Get tenant_id from user context if not provided
    let tenantId = tenant_id;
    
    if (!tenantId) {
      // Try to get from tenant_users
      const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
      const { data: tenantUser } = await serviceClient
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (tenantUser) {
        tenantId = tenantUser.tenant_id;
      } else {
        // Check if user is tenant owner
        const { data: tenant } = await serviceClient
          .from('tenants')
          .select('id')
          .eq('owner_email', user.email)
          .maybeSingle();

        if (tenant) {
          tenantId = tenant.id;
        }
      }
    }

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found or user not authorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has admin access to this tenant
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
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
    const { data: currentUser } = await serviceClient
      .from('tenant_users')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .maybeSingle();

    const isAdmin = isOwner || currentUser?.role === 'admin' || currentUser?.role === 'owner';

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle different actions
    if (action === 'list') {
      const { data: staff, error: listError } = await serviceClient
        .from('tenant_users')
        .select('*, auth.users(email)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (listError) {
        return new Response(
          JSON.stringify({ error: 'Failed to list staff', details: listError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ staff: staff || [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'create') {
      if (!email || !role) {
        return new Response(
          JSON.stringify({ error: 'Email and role are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if user already exists in tenant
      const { data: existing } = await serviceClient
        .from('tenant_users')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ error: 'User already exists in this tenant' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get or create auth user
      const { data: authUsers } = await serviceClient.auth.admin.listUsers();
      const authUserId = authUsers?.users?.find(u => u.email === email.toLowerCase())?.id;

      if (!authUserId) {
        // Create auth user (would need to send invitation in real implementation)
        return new Response(
          JSON.stringify({ error: 'User must be invited first via tenant-invite' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create tenant_user record
      const { data: newStaff, error: createError } = await serviceClient
        .from('tenant_users')
        .insert({
          tenant_id: tenantId,
          user_id: authUserId,
          email: email.toLowerCase(),
          role,
          name: name || null,
        })
        .select()
        .single();

      if (createError) {
        return new Response(
          JSON.stringify({ error: 'Failed to create staff member', details: createError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, staff: newStaff }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update') {
      if (!user_id) {
        return new Response(
          JSON.stringify({ error: 'User ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const updateData: Record<string, unknown> = {};
      if (role) updateData.role = role;
      if (name !== undefined) updateData.name = name;

      const { data: updatedStaff, error: updateError } = await serviceClient
        .from('tenant_users')
        .update(updateData)
        .eq('id', user_id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (updateError) {
        return new Response(
          JSON.stringify({ error: 'Failed to update staff member', details: updateError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, staff: updatedStaff }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'delete') {
      if (!user_id) {
        return new Response(
          JSON.stringify({ error: 'User ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Prevent deleting yourself
      if (user_id === currentUser?.id || user_id === user.id) {
        return new Response(
          JSON.stringify({ error: 'Cannot delete your own account' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: deleteError } = await serviceClient
        .from('tenant_users')
        .delete()
        .eq('id', user_id)
        .eq('tenant_id', tenantId);

      if (deleteError) {
        return new Response(
          JSON.stringify({ error: 'Failed to delete staff member', details: deleteError.message }),
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

  } catch (error: unknown) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

