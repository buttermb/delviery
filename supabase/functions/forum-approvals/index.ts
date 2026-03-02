import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { createLogger } from '../_shared/logger.ts';

const logger = createLogger('forum-approvals');

// Zod validation schema
const forumApprovalSchema = z.object({
  action: z.enum(['approve', 'reject']),
  approval_id: z.string().uuid('Invalid approval ID'),
  rejection_reason: z.string().max(500).optional(),
});

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
      logger.warn('Missing authorization header');
      throw new Error('No authorization header');
    }

    // Verify the user is authenticated
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      logger.warn('Authentication failed', { error: userError?.message });
      throw new Error('Not authenticated');
    }

    // Verify user is a super admin
    const { data: adminUser, error: adminError } = await supabaseClient
      .from('admin_users')
      .select('role, is_active')
      .eq('user_id', user.id)
      .single();

    if (adminError || !adminUser || !adminUser.is_active) {
      logger.warn('Non-admin attempted forum approval', { userId: user.id });
      throw new Error('Not authorized');
    }

    // Parse and validate request body
    const rawBody = await req.json();
    const validationResult = forumApprovalSchema.safeParse(rawBody);

    if (!validationResult.success) {
      const zodError = validationResult as { success: false; error: { flatten: () => { fieldErrors: Record<string, string[]> } } };
      logger.warn('Validation failed', { errors: zodError.error.flatten(), userId: user.id });
      return new Response(
        JSON.stringify({
          error: 'Validation failed',
          details: zodError.error.flatten().fieldErrors,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, approval_id, rejection_reason } = validationResult.data;

    if (action === 'approve') {
      // Get the approval record
      const { data: approval, error: approvalError } = await supabaseClient
        .from('forum_user_approvals')
        .select('customer_user_id, status')
        .eq('id', approval_id)
        .single();

      if (approvalError || !approval) {
        logger.warn('Approval not found', { approval_id });
        throw new Error('Approval not found');
      }

      if (approval.status !== 'pending') {
        logger.warn('Approval already processed', { approval_id, status: approval.status });
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

      if (updateError) throw updateError;

      // Check if user already has a forum profile
      const { data: existingProfile } = await supabaseClient
        .from('forum_user_profiles')
        .select('id')
        .eq('user_id', approval.customer_user_id)
        .single();

      // Only create profile if it doesn't exist
      if (!existingProfile) {
        const { data: userProfile } = await supabaseClient
          .from('profiles')
          .select('email, full_name')
          .eq('user_id', approval.customer_user_id)
          .single();

        const { error: profileError } = await supabaseClient
          .from('forum_user_profiles')
          .insert({
            user_id: approval.customer_user_id,
            username: userProfile?.email?.split('@')[0] || `user_${approval.customer_user_id.slice(0, 8)}`,
            display_name: userProfile?.full_name || 'Anonymous User',
          });

        if (profileError) {
          logger.error('Error creating forum profile', { error: profileError.message });
        }
      }

      logger.info('Forum approval granted', { approval_id, approvedBy: user.id });

      return new Response(
        JSON.stringify({ success: true, message: 'User approved successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (action === 'reject') {
      const { error: updateError } = await supabaseClient
        .from('forum_user_approvals')
        .update({
          status: 'rejected',
          rejected_by: user.id,
          rejected_at: new Date().toISOString(),
          rejection_reason: rejection_reason || 'No reason provided',
        })
        .eq('id', approval_id);

      if (updateError) throw updateError;

      logger.info('Forum approval rejected', { approval_id, rejectedBy: user.id });

      return new Response(
        JSON.stringify({ success: true, message: 'User rejected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action');
  } catch (error) {
    logger.error('Forum approval error', { error: error instanceof Error ? error.message : 'Unknown' });
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
