import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailNotification {
  tenant_id: string;
  business_name: string;
  owner_email: string;
  owner_name: string;
  trial_ends_at: string;
  days_remaining: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('VITE_SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Checking for trial expiration notices...');

    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));
    const oneDayFromNow = new Date(now.getTime() + (24 * 60 * 60 * 1000));

    // Find trials expiring in 3 days or 1 day
    const { data: expiringTrials, error: selectError } = await supabaseClient
      .from('tenants')
      .select('id, business_name, owner_email, owner_name, trial_ends_at')
      .eq('subscription_status', 'trial')
      .not('trial_ends_at', 'is', null)
      .or(`trial_ends_at.lte.${threeDaysFromNow.toISOString()},trial_ends_at.lte.${oneDayFromNow.toISOString()}`);

    if (selectError) {
      console.error('Error fetching expiring trials:', selectError);
      throw selectError;
    }

    console.log(`Found ${expiringTrials?.length || 0} expiring trials`);

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
          days_remaining: daysRemaining
        });
      }
    }

    console.log(`Sending ${notifications.length} trial expiration notices`);

    // Send notifications via background tasks
    const emailTasks = notifications.map(async (notification) => {
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
                <a href="${Deno.env.get('VITE_SUPABASE_URL')?.replace('https://', 'https://app.')}/${notification.tenant_id}/admin/billing" 
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
      console.log(`Would send email to ${notification.owner_email}: ${emailSubject}`);
      
      // Example SendGrid integration (if SENDGRID_API_KEY is set):
      // const sendGridKey = Deno.env.get('SENDGRID_API_KEY');
      // if (sendGridKey) {
      //   await fetch('https://api.sendgrid.com/v3/mail/send', {
      //     method: 'POST',
      //     headers: {
      //       'Authorization': `Bearer ${sendGridKey}`,
      //       'Content-Type': 'application/json',
      //     },
      //     body: JSON.stringify({
      //       personalizations: [{ to: [{ email: notification.owner_email }] }],
      //       from: { email: 'noreply@yourplatform.com', name: 'Your Platform' },
      //       subject: emailSubject,
      //       content: [{ type: 'text/html', value: emailBody }]
      //     })
      //   });
      // }

      return { email: notification.owner_email, days: notification.days_remaining, sent: true };
    });

    const results = await Promise.allSettled(emailTasks);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return new Response(
      JSON.stringify({ 
        total: notifications.length,
        successful,
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
