import { serve, createClient, corsHeaders } from '../_shared/deps.ts';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('VITE_SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.error('Checking for expired trials...');

    // Find tenants with expired trials
    const { data: expiredTrials, error: selectError } = await supabaseClient
      .from('tenants')
      .select('id, business_name, owner_email, trial_ends_at')
      .eq('subscription_status', 'trial')
      .lt('trial_ends_at', new Date().toISOString());

    if (selectError) {
      console.error('Error fetching expired trials:', selectError);
      throw selectError;
    }

    console.error(`Found ${expiredTrials?.length || 0} expired trials`);

    // Update status to 'suspended' for expired trials
    const results = [];
    for (const tenant of expiredTrials || []) {
      console.error(`Suspending tenant: ${tenant.business_name} (${tenant.id})`);
      
      const { error: updateError } = await supabaseClient
        .from('tenants')
        .update({ subscription_status: 'suspended' })
        .eq('id', tenant.id);

      if (updateError) {
        console.error(`Error updating tenant ${tenant.id}:`, updateError);
        results.push({
          tenant_id: tenant.id,
          success: false,
          error: updateError.message
        });
      } else {
        results.push({
          tenant_id: tenant.id,
          business_name: tenant.business_name,
          success: true
        });
        
        // TODO: Send trial expiration notification email
        console.error(`Successfully suspended tenant ${tenant.business_name}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        processed: expiredTrials?.length || 0,
        results,
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
    console.error('Error in check-expired-trials function:', error);
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
