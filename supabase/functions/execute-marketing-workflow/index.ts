import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { workflowId, triggerData } = await req.json();

    if (!workflowId) {
      throw new Error('Workflow ID is required');
    }

    // Get workflow details
    const { data: workflow, error: workflowError } = await supabaseClient
      .from('marketing_workflows')
      .select('*')
      .eq('id', workflowId)
      .eq('status', 'active')
      .single();

    if (workflowError) throw workflowError;

    // Check trigger conditions
    const conditions = workflow.trigger_conditions as Record<string, any>;
    let conditionsMet = true;

    if (conditions && Object.keys(conditions).length > 0) {
      // Evaluate conditions based on triggerData
      // This is a simplified example
      for (const [key, value] of Object.entries(conditions)) {
        if (triggerData[key] !== value) {
          conditionsMet = false;
          break;
        }
      }
    }

    if (!conditionsMet) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Workflow conditions not met',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Execute actions
    const actions = workflow.actions as Array<Record<string, any>>;
    const results = [];

    for (const action of actions) {
      switch (action.type) {
        case 'send_email':
          // Simulate email send
          results.push({ action: 'send_email', status: 'success' });
          break;
        case 'send_sms':
          // Simulate SMS send
          results.push({ action: 'send_sms', status: 'success' });
          break;
        case 'add_tag':
          // Add tag logic
          results.push({ action: 'add_tag', status: 'success' });
          break;
        case 'award_points':
          // Award loyalty points
          results.push({ action: 'award_points', status: 'success' });
          break;
        default:
          results.push({ action: action.type, status: 'skipped' });
      }
    }

    // Update workflow stats
    const { error: updateError } = await supabaseClient
      .from('marketing_workflows')
      .update({
        last_run_at: new Date().toISOString(),
        run_count: (workflow.run_count || 0) + 1,
      })
      .eq('id', workflowId);

    if (updateError) throw updateError;

    console.log(`Workflow ${workflow.name} executed with ${results.length} actions`);

    return new Response(
      JSON.stringify({
        success: true,
        workflowName: workflow.name,
        actionsExecuted: results.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error executing workflow:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
