import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { withZenProtection } from '../_shared/zen-firewall.ts';
import { CREDIT_ACTIONS } from '../_shared/creditGate.ts';

const CHANNEL_CREDIT_MAP: Record<string, string> = {
  email: CREDIT_ACTIONS.SEND_EMAIL,
  sms: CREDIT_ACTIONS.SEND_SMS,
  push: CREDIT_ACTIONS.SEND_PUSH_NOTIFICATION,
};

const notificationSchema = z.object({
  user_id: z.string().uuid().optional(),
  tenant_id: z.string().uuid().optional(),
  type: z.enum(['order_status', 'order_cancelled', 'payment', 'inventory', 'system']),
  title: z.string().min(1).max(255),
  message: z.string().min(1).max(1000),
  metadata: z.record(z.unknown()).optional(),
  channels: z.array(z.enum(['database', 'email', 'sms', 'push'])).default(['database']),
});

serve(
  withZenProtection(async (req) => {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Verify authentication
      const authHeader = req.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Resolve tenant from JWT
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: tenantUser } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .maybeSingle();

      const tenantId = tenantUser?.tenant_id;
      if (!tenantId) {
        return new Response(
          JSON.stringify({ error: 'No tenant found for user' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if tenant is on free tier
      const { data: tenant } = await supabase
        .from('tenants')
        .select('is_free_tier')
        .eq('id', tenantId)
        .maybeSingle();

      const isFreeTier = tenant?.is_free_tier ?? false;

      // Parse and validate request
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return new Response(
          JSON.stringify({ error: 'Invalid JSON body' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const parseResult = notificationSchema.safeParse(body);
      if (!parseResult.success) {
        return new Response(
          JSON.stringify({
            error: 'Validation failed',
            details: parseResult.error.issues,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const notificationData = parseResult.data;

      // Determine which channels need credit deduction
      // Only charge for billable channels that will actually deliver (require user_id)
      const billableChannels = notificationData.channels.filter(
        (ch) => ch in CHANNEL_CREDIT_MAP && notificationData.user_id
      );

      // Deduct credits for each billable channel (free tier only)
      let totalCreditsConsumed = 0;
      let creditsRemaining = -1;

      if (isFreeTier && billableChannels.length > 0) {
        for (const channel of billableChannels) {
          const actionKey = CHANNEL_CREDIT_MAP[channel];

          const { data, error: rpcError } = await supabase
            .rpc('consume_credits', {
              p_tenant_id: tenantId,
              p_action_key: actionKey,
              p_reference_type: 'notification',
              p_description: `Send ${channel} notification: ${notificationData.title}`,
            });

          if (rpcError) {
            console.error(`Credit deduction error for ${channel}:`, rpcError);
            return new Response(
              JSON.stringify({
                error: 'Credit deduction failed',
                channel,
                message: rpcError.message,
              }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const result = data?.[0];
          if (!result?.success) {
            return new Response(
              JSON.stringify({
                error: 'Insufficient credits',
                code: 'INSUFFICIENT_CREDITS',
                message: result?.error_message || 'Not enough credits for this notification',
                channel,
                actionKey,
                creditsRequired: result?.credits_cost ?? 0,
                currentBalance: result?.new_balance ?? 0,
              }),
              { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          totalCreditsConsumed += result.credits_cost ?? 0;
          creditsRemaining = result.new_balance ?? 0;
        }
      }

      const results: Record<string, unknown> = {};

      // Send to database (always)
      if (notificationData.channels.includes('database')) {
        const { data: notification, error: dbError } = await supabase
          .from('notifications')
          .insert({
            user_id: notificationData.user_id || null,
            tenant_id: tenantId,
            type: notificationData.type,
            title: notificationData.title,
            message: notificationData.message,
            metadata: notificationData.metadata || {},
            read: false,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (dbError) {
          results.database = { error: dbError.message };
        } else {
          results.database = { success: true, id: notification.id };
        }
      }

      // Send email (if requested and user_id provided)
      if (notificationData.channels.includes('email') && notificationData.user_id) {
        const { data: targetUser } = await supabase.auth.admin.getUserById(notificationData.user_id);

        if (targetUser?.user?.email) {
          // In production, integrate with email service (SendGrid, Resend, etc.)
          console.log('Email notification would be sent to:', targetUser.user.email);
          results.email = { success: true, sent: false, note: 'Email service not configured' };
        } else {
          results.email = { error: 'User email not found' };
        }
      }

      // Send SMS (if requested and user_id provided)
      if (notificationData.channels.includes('sms') && notificationData.user_id) {
        // In production, integrate with Twilio/SMS service
        console.log('SMS notification would be sent to user:', notificationData.user_id);
        results.sms = { success: true, sent: false, note: 'SMS service not configured' };
      }

      // Send push notification (if requested and user_id provided)
      if (notificationData.channels.includes('push') && notificationData.user_id) {
        // In production, integrate with FCM/APNS
        console.log('Push notification would be sent to user:', notificationData.user_id);
        results.push = { success: true, sent: false, note: 'Push service not configured' };
      }

      const responseHeaders: Record<string, string> = {
        ...corsHeaders,
        'Content-Type': 'application/json',
      };

      if (totalCreditsConsumed > 0) {
        responseHeaders['X-Credits-Consumed'] = String(totalCreditsConsumed);
        responseHeaders['X-Credits-Remaining'] = String(creditsRemaining);
      }

      return new Response(
        JSON.stringify({
          success: true,
          results,
          credits: totalCreditsConsumed > 0
            ? { consumed: totalCreditsConsumed, remaining: creditsRemaining }
            : undefined,
        }),
        { status: 200, headers: responseHeaders }
      );
    } catch (error) {
      console.error('Send notification error:', error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Failed to send notification',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  })
);
