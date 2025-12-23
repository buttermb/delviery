import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[RETRY_EMAILS] Starting retry job...');

    // Get failed emails ready for retry
    const { data: failedEmails, error: fetchError } = await supabase
      .from('failed_emails')
      .select('*')
      .lt('next_retry', new Date().toISOString())
      .lt('retry_count', 3)
      .limit(50);

    if (fetchError) {
      throw new Error(`Failed to fetch emails: ${fetchError.message}`);
    }

    if (!failedEmails || failedEmails.length === 0) {
      console.log('[RETRY_EMAILS] No emails to retry');
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[RETRY_EMAILS] Found ${failedEmails.length} emails to retry`);

    let successCount = 0;
    let failCount = 0;

    for (const email of failedEmails) {
      try {
        // TODO: Integrate with actual email provider (Resend/SendGrid)
        // For now, simulate email send
        console.log(`[RETRY_EMAILS] Retrying email to ${email.recipient}, template: ${email.template}`);
        
        // Log success
        await supabase.from('email_logs').insert({
          tenant_id: email.tenant_id,
          template: email.template,
          recipient: email.recipient,
          status: 'sent',
          metadata: { retry_attempt: email.retry_count + 1, ...email.email_data },
          sent_at: new Date().toISOString(),
        });

        // Remove from failed queue
        await supabase.from('failed_emails').delete().eq('id', email.id);
        successCount++;

      } catch (sendError: any) {
        console.error(`[RETRY_EMAILS] Failed to send to ${email.recipient}:`, sendError.message);
        
        // Exponential backoff: 5min, 15min, 45min
        const backoffMinutes = 5 * Math.pow(3, email.retry_count);
        const nextRetry = new Date(Date.now() + backoffMinutes * 60 * 1000);

        await supabase
          .from('failed_emails')
          .update({
            retry_count: email.retry_count + 1,
            next_retry: nextRetry.toISOString(),
            error_message: sendError.message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', email.id);
        
        failCount++;
      }
    }

    console.log(`[RETRY_EMAILS] Completed. Success: ${successCount}, Failed: ${failCount}`);

    return new Response(
      JSON.stringify({ success: true, processed: failedEmails.length, successCount, failCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[RETRY_EMAILS] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
