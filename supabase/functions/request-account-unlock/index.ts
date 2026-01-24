import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';

const requestSchema = z.object({
  email: z.string().email(),
  tenantSlug: z.string().min(1),
});

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      // Return 200 to prevent email enumeration
      return new Response(
        JSON.stringify({ success: true, message: 'If this email is associated with an account, the admin will be notified.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, tenantSlug } = validation.data;

    // Create service role client to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find the tenant
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, business_name, owner_email, slug')
      .eq('slug', tenantSlug.toLowerCase())
      .maybeSingle();

    if (!tenant || tenantError) {
      // Return success to prevent enumeration
      console.log('[UNLOCK] Tenant not found for slug:', tenantSlug);
      return new Response(
        JSON.stringify({ success: true, message: 'Request received.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user exists as a tenant admin
    const { data: adminUser } = await supabaseAdmin
      .from('tenant_admins')
      .select('id, name, email')
      .eq('tenant_id', tenant.id)
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (!adminUser) {
      // Return success to prevent enumeration
      console.log('[UNLOCK] Admin user not found:', email);
      return new Response(
        JSON.stringify({ success: true, message: 'Request received.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send unlock request notification to tenant owner
    const ownerEmail = tenant.owner_email;
    if (ownerEmail) {
      // Log the unlock request for audit trail
      console.log('[UNLOCK] Account unlock requested', {
        requestedBy: email,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        ownerEmail,
      });

      // Attempt to send notification email via Supabase's built-in email
      // or an external email service if configured
      try {
        const { error: notifyError } = await supabaseAdmin
          .from('notifications')
          .insert({
            tenant_id: tenant.id,
            type: 'account_unlock_request',
            title: `Account Unlock Request - ${adminUser.name || email}`,
            message: `User ${adminUser.name || email} (${email}) has requested their account to be unlocked for ${tenant.business_name}. Their account was locked due to too many failed login attempts.`,
            metadata: {
              requested_email: email,
              requested_name: adminUser.name,
              tenant_slug: tenantSlug,
              requested_at: new Date().toISOString(),
            },
            read: false,
          });

        if (notifyError) {
          console.error('[UNLOCK] Failed to create notification:', notifyError);
        }
      } catch (notifyErr) {
        // Non-critical: notification creation failed but we still return success
        console.error('[UNLOCK] Notification insert error:', notifyErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Request received.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[UNLOCK] Unexpected error:', error);
    // Still return 200 to prevent information leakage
    return new Response(
      JSON.stringify({ success: true, message: 'Request received.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
