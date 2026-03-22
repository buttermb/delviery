import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { CREDIT_ACTIONS } from '../_shared/creditGate.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.error('Sending expired trial notifications...');

    // Find recently suspended accounts (suspended in last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const { data: suspendedTenants, error: selectError } = await supabaseClient
      .from('tenants')
      .select('id, business_name, owner_email, owner_name, trial_ends_at, is_free_tier')
      .eq('subscription_status', 'suspended')
      .gte('updated_at', oneDayAgo.toISOString());

    if (selectError) {
      console.error('Error fetching suspended tenants:', selectError);
      throw selectError;
    }

    console.error(`Found ${suspendedTenants?.length || 0} recently suspended tenants`);

    const emailTasks = (suspendedTenants || []).map(async (tenant) => {
      // Deduct credits for free-tier tenants before sending email
      if (tenant.is_free_tier) {
        const { data: creditResult, error: creditError } = await supabaseClient
          .rpc('consume_credits', {
            p_tenant_id: tenant.id,
            p_action_key: CREDIT_ACTIONS.SEND_EMAIL,
            p_reference_id: tenant.id,
            p_reference_type: 'trial_expiration_notice',
            p_description: `Trial expiration email to ${tenant.owner_email}`,
          });

        if (creditError) {
          console.error(`Credit deduction error for tenant ${tenant.id}:`, creditError);
          return { email: tenant.owner_email, sent: false, reason: 'credit_error' };
        }

        const result = creditResult?.[0];
        if (!result?.success) {
          console.error(`Insufficient credits for tenant ${tenant.id}: ${result?.error_message}`);
          return { email: tenant.owner_email, sent: false, reason: 'insufficient_credits' };
        }

        console.error(`Credits deducted for tenant ${tenant.id}: cost=${result.credits_cost}, remaining=${result.new_balance}`);
      }

      const emailBody = `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 30px; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">Trial Expired</h1>
            </div>

            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; color: #374151;">Hi ${tenant.owner_name || 'there'},</p>

              <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                Your trial for <strong>${tenant.business_name}</strong> has expired.
                Your account has been temporarily suspended.
              </p>

              <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #991b1b; font-size: 14px;">
                  <strong>⚠️ Account Suspended:</strong> All features are currently locked. Subscribe now to regain access.
                </p>
              </div>

              <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                We've saved all your data! Subscribe today to continue managing:
              </p>

              <ul style="font-size: 15px; color: #4b5563; line-height: 2;">
                <li>✓ All your customers and orders</li>
                <li>✓ Product catalog and inventory</li>
                <li>✓ Analytics and reports</li>
                <li>✓ Team member access</li>
                <li>✓ Location settings</li>
              </ul>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${Deno.env.get('SUPABASE_URL')?.replace('https://', 'https://app.')}/${tenant.id}/admin/billing"
                   style="background: #667eea; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px;">
                  Reactivate Now
                </a>
              </div>

              <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #1e40af; font-size: 14px;">
                  <strong>💡 Special Offer:</strong> Subscribe within 7 days and get 20% off your first month!
                </p>
              </div>

              <h3 style="color: #374151; margin-top: 30px;">Choose Your Plan:</h3>

              <div style="display: flex; gap: 15px; margin: 20px 0;">
                <div style="flex: 1; border: 2px solid #e5e7eb; border-radius: 8px; padding: 15px; text-align: center;">
                  <h4 style="color: #667eea; margin: 0 0 10px 0;">Basic</h4>
                  <p style="font-size: 24px; font-weight: bold; color: #374151; margin: 5px 0;">$79<span style="font-size: 14px; font-weight: normal;">/mo</span></p>
                  <p style="font-size: 12px; color: #6b7280;">28 features</p>
                </div>

                <div style="flex: 1; border: 2px solid #667eea; border-radius: 8px; padding: 15px; text-align: center; position: relative;">
                  <div style="position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: #667eea; color: white; padding: 2px 12px; border-radius: 10px; font-size: 11px; font-weight: bold;">POPULAR</div>
                  <h4 style="color: #667eea; margin: 0 0 10px 0;">Professional</h4>
                  <p style="font-size: 24px; font-weight: bold; color: #374151; margin: 5px 0;">$150<span style="font-size: 14px; font-weight: normal;">/mo</span></p>
                  <p style="font-size: 12px; color: #6b7280;">55 features</p>
                </div>

                <div style="flex: 1; border: 2px solid #e5e7eb; border-radius: 8px; padding: 15px; text-align: center;">
                  <h4 style="color: #667eea; margin: 0 0 10px 0;">Enterprise</h4>
                  <p style="font-size: 24px; font-weight: bold; color: #374151; margin: 5px 0;">$499<span style="font-size: 14px; font-weight: normal;">/mo</span></p>
                  <p style="font-size: 12px; color: #6b7280;">87 features</p>
                </div>
              </div>

              <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
                Questions? Our support team is here to help!
              </p>

              <p style="font-size: 14px; color: #6b7280;">
                Best regards,<br>
                Your Platform Team
              </p>
            </div>
          </body>
        </html>
      `;

      console.error(`Would send expiration email to ${tenant.owner_email}`);

      // Example SendGrid integration
      // const sendGridKey = Deno.env.get('SENDGRID_API_KEY');
      // if (sendGridKey) { ... }

      return { email: tenant.owner_email, sent: true };
    });

    const results = await Promise.allSettled(emailTasks);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.sent).length;
    const skipped = results.filter(r => r.status === 'fulfilled' && !r.value.sent).length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return new Response(
      JSON.stringify({
        total: suspendedTenants?.length || 0,
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
    console.error('Error in send-trial-expired-notice:', error);
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
