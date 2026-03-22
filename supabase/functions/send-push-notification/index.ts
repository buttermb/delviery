import { corsHeaders } from '../_shared/deps.ts';
import { withCreditGate, CREDIT_ACTIONS } from '../_shared/creditGate.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return withCreditGate(
    req,
    CREDIT_ACTIONS.SEND_PUSH_NOTIFICATION,
    async (_tenantId, supabase) => {
      const { userId, title, body, data } = await req.json();

      if (!userId || !title || !body) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: userId, title, body' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check user's notification preferences
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('push_enabled, push_all_updates, push_critical_only')
        .eq('user_id', userId)
        .maybeSingle();

      // Default to enabled if no preferences set
      const pushEnabled = prefs?.push_enabled !== false;
      const isCritical = data?.critical === true;
      const allowPush = pushEnabled && (prefs?.push_all_updates || (prefs?.push_critical_only && isCritical));

      if (!allowPush) {
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: 'User preferences' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get FCM tokens for the user from push_tokens table
      const { data: tokens, error: tokenError } = await supabase
        .from('push_tokens')
        .select('token, platform')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (tokenError) {
        console.error('Error fetching push tokens:', tokenError);
      }

      let sentCount = 0;
      let failedCount = 0;

      if (tokens && tokens.length > 0) {
        const fcmServerKey = Deno.env.get('FCM_SERVER_KEY');

        if (fcmServerKey) {
          for (const tokenRecord of tokens) {
            try {
              const fcmPayload = {
                to: tokenRecord.token,
                notification: {
                  title,
                  body,
                  click_action: 'OPEN_APP',
                },
                data: {
                  ...data,
                  route: data?.route || '/',
                },
              };

              const response = await fetch('https://fcm.googleapis.com/fcm/send', {
                method: 'POST',
                headers: {
                  'Authorization': `key=${fcmServerKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(fcmPayload),
              });

              if (response.ok) {
                sentCount++;
              } else {
                failedCount++;
                const errorText = await response.text();
                console.error(`FCM error for token: ${errorText}`);

                // Mark token as inactive if it's invalid
                if (errorText.includes('NotRegistered') || errorText.includes('InvalidRegistration')) {
                  await supabase
                    .from('push_tokens')
                    .update({ is_active: false })
                    .eq('token', tokenRecord.token);
                }
              }
            } catch (sendError) {
              failedCount++;
              console.error('Error sending to device:', sendError);
            }
          }
        } else {
          console.error('FCM_SERVER_KEY not configured, skipping push send');
        }
      }

      // Log the notification
      await supabase.from('notifications_log').insert({
        notification_type: 'push',
        order_id: data?.orderId,
        notification_stage: data?.stage || 0,
        message_content: `${title}: ${body}`,
        status: sentCount > 0 ? 'sent' : (tokens?.length ? 'failed' : 'no_tokens'),
        sent_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: sentCount > 0 ? 'Push notification sent' : 'No tokens to send to',
          userId,
          title,
          sentCount,
          failedCount,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    },
    {
      description: 'Send push notification via FCM',
    }
  );
});
