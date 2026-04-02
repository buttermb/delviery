import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { CREDIT_ACTIONS } from '../_shared/creditGate.ts';

interface EmailNotification {
  tenant_id: string;
  business_name: string;
  owner_email: string;
  owner_name: string;
  trial_ends_at: string;
  days_remaining: number;
  is_free_tier: boolean;
}

interface EmailResult {
  email: string;
  days: number;
  sent: boolean;
  credits_deducted: boolean;
  skipped_reason?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.error('Checking for trial expiration notices...');

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const threeDaysFromNow = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));

    // Find trials expiring within the next 3 days, include is_free_tier for credit gating
    // The loop below filters for exactly 1 or 3 days remaining
    const { data: expiringTrials, error: selectError } = await supabaseClient
      .from('tenants')
      .select('id, business_name, owner_email, owner_name, trial_ends_at, is_free_tier')
      .eq('subscription_status', 'trial')
      .not('trial_ends_at', 'is', null)
      .gte('trial_ends_at', now.toISOString())
      .lte('trial_ends_at', threeDaysFromNow.toISOString());

    if (selectError) {
      console.error('Error fetching expiring trials:', selectError);
      throw selectError;
    }

    console.error(`Found ${expiringTrials?.length || 0} expiring trials`);

    const notifications: EmailNotification[] = [];

    for (const tenant of expiringTrials || []) {
      const trialEndDate = new Date(tenant.trial_ends_at);
      const daysRemaining = Math.ceil((trialEndDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

      // Only send for 3 days and 1 day warnings
      if (daysRemaining === 3 || daysRemaining === 1) {
        notifications.push({
          tenant_id: tenant.id,
          business_name: tenant.business_name,
          owner_email: tenant.owner_email,
          owner_name: tenant.owner_name || 'there',
          trial_ends_at: tenant.trial_ends_at,
          days_remaining: daysRemaining,
          is_free_tier: tenant.is_free_tier ?? false,
        });
      }
    }

    console.error(`Sending ${notifications.length} trial expiration notices`);

    // Send notifications with per-tenant credit deduction
    const emailTasks = notifications.map(async (notification): Promise<EmailResult> => {
      // Deduct credits for free tier tenants before sending
      if (notification.is_free_tier) {
        const referenceId = `trial-expiry-${notification.tenant_id}-${notification.days_remaining}d-${todayStr}`;

        const { data: creditResult, error: creditError } = await supabaseClient
          .rpc('consume_credits', {
            p_tenant_id: notification.tenant_id,
            p_amount: 0,
            p_action_key: CREDIT_ACTIONS.SEND_EMAIL,
            p_description: `Trial expiration notice - ${notification.days_remaining} day(s) remaining`,
            p_reference_id: referenceId,
            p_metadata: { notification_type: 'trial_expiration', days_remaining: notification.days_remaining },
          });

        if (creditError) {
          console.error(`Credit deduction error for tenant ${notification.tenant_id}:`, creditError);
          return {
            email: notification.owner_email,
            days: notification.days_remaining,
            sent: false,
            credits_deducted: false,
            skipped_reason: `Credit error: ${creditError.message}`,
          };
        }

        if (!creditResult?.success) {
          console.error(`Insufficient credits for tenant ${notification.tenant_id}: ${creditResult?.error}`);
          return {
            email: notification.owner_email,
            days: notification.days_remaining,
            sent: false,
            credits_deducted: false,
            skipped_reason: creditResult?.error || 'Insufficient credits',
          };
        }

        console.error(`Deducted ${creditResult.consumed} credits for tenant ${notification.tenant_id}, balance: ${creditResult.balance}`);
      }

      const emailSubject = notification.days_remaining === 1
        ? `⏰ Your trial ends tomorrow - ${notification.business_name}`
        : `🚀 Your trial ends in ${notification.days_remaining} days - ${notification.business_name}`;

      const emailBody = `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">Trial Ending Soon</h1>
            </div>

            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; color: #374151;">Hi ${notification.owner_name},</p>

              <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                Your trial for <strong>${notification.business_name}</strong> will expire in
                <strong style="color: #dc2626;">${notification.days_remaining} day${notification.days_remaining > 1 ? 's' : ''}</strong>.
              </p>

              <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                Don't lose access to your data and features! Subscribe now to continue enjoying:
              </p>

              <ul style="font-size: 15px; color: #4b5563; line-height: 2;">
                <li>Customer management & analytics</li>
                <li>Product & inventory tracking</li>
                <li>Order processing & fulfillment</li>
                <li>Multi-location support</li>
                <li>Team collaboration tools</li>
              </ul>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${Deno.env.get('SUPABASE_URL')?.replace('https://', 'https://app.')}/${notification.tenant_id}/admin/billing"
                   style="background: #667eea; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                  Subscribe Now
                </a>
              </div>

              <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #991b1b; font-size: 14px;">
                  <strong>⚠️ Important:</strong> After your trial expires, you'll lose access to all features until you subscribe.
                </p>
              </div>

              <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
                Have questions? Contact our support team anytime.
              </p>

              <p style="font-size: 14px; color: #6b7280;">
                Best regards,<br>
                Your Platform Team
              </p>
            </div>
          </body>
        </html>
      `;

      // Here you would integrate with your email service (SendGrid, etc.)
      // For now, we'll log it
      console.error(`Would send email to ${notification.owner_email}: ${emailSubject}`);

      return {
        email: notification.owner_email,
        days: notification.days_remaining,
        sent: true,
        credits_deducted: notification.is_free_tier,
      };
    });

    const results = await Promise.allSettled(emailTasks);
    const fulfilled = results
      .filter((r): r is PromiseFulfilledResult<EmailResult> => r.status === 'fulfilled')
      .map(r => r.value);
    const successful = fulfilled.filter(r => r.sent).length;
    const skipped = fulfilled.filter(r => !r.sent).length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return new Response(
      JSON.stringify({
        total: notifications.length,
        successful,
        skipped,
        failed,
        timestamp: new Date().toISOString()
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    )
  } catch (error) {
    console.error('Error in send-trial-expiration-notice:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        error: errorMessage,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    )
  }
})
