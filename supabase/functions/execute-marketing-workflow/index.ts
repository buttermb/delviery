import { createClient, corsHeaders } from '../_shared/deps.ts';
import { validateExecuteMarketingWorkflow, type ExecuteMarketingWorkflowInput } from './validation.ts';
import { calculateWorkflowCreditCost } from './creditCost.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // User-scoped client for reading workflow data
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Service-role client for credit operations
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    const rawBody = await req.json();
    const { workflowId, triggerData, dryRun }: ExecuteMarketingWorkflowInput =
      validateExecuteMarketingWorkflow(rawBody);

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
    const conditions = workflow.trigger_conditions as Record<string, unknown>;
    let conditionsMet = true;

    if (conditions && Object.keys(conditions).length > 0) {
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

    // --- Credit deduction ---

    // Resolve tenant from JWT
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: tenantUser } = await serviceClient
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!tenantUser?.tenant_id) {
      return new Response(
        JSON.stringify({ error: 'No tenant found for user' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = tenantUser.tenant_id;

    // Check if tenant is free tier (paid tiers skip credit deduction)
    const { data: tenant } = await serviceClient
      .from('tenants')
      .select('is_free_tier')
      .eq('id', tenantId)
      .maybeSingle();

    const isFreeTier = tenant?.is_free_tier ?? false;

    // Calculate total credit cost from workflow actions
    const actions = workflow.actions as Array<Record<string, unknown>>;
    const { totalCost, costBreakdown } = calculateWorkflowCreditCost(actions);

    let creditsConsumed = 0;
    let creditsRemaining = -1;
    let creditReferenceId: string | null = null;

    // Only deduct credits for free tier tenants with non-zero cost
    if (isFreeTier && totalCost > 0) {
      // Dry run: return cost estimate without executing
      if (dryRun) {
        return new Response(
          JSON.stringify({
            success: true,
            dryRun: true,
            creditCost: totalCost,
            costBreakdown,
            workflowName: workflow.name,
            actionsCount: actions.length,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Pre-deduct total credits before executing workflow
      const { data: creditResult, error: creditError } = await serviceClient
        .rpc('consume_credits', {
          p_tenant_id: tenantId,
          p_amount: totalCost,
          p_action_key: 'workflow_execute',
          p_description: `Marketing workflow: ${workflow.name}`,
          p_reference_id: workflowId,
          p_metadata: { workflow_name: workflow.name, cost_breakdown: costBreakdown },
        });

      if (creditError) {
        console.error('Credit consumption error:', creditError);
        return new Response(
          JSON.stringify({ error: 'Credit system error', message: creditError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = creditResult;
      if (!result?.success) {
        // Track the blocked action
        await serviceClient
          .from('credit_analytics')
          .insert({
            tenant_id: tenantId,
            event_type: 'action_blocked_insufficient_credits',
            credits_at_event: result?.balance ?? 0,
            action_attempted: 'workflow_execute',
            metadata: { workflow_id: workflowId, required: totalCost, cost_breakdown: costBreakdown },
          });

        return new Response(
          JSON.stringify({
            error: 'Insufficient credits',
            code: 'INSUFFICIENT_CREDITS',
            message: result?.error || 'Not enough credits to execute this workflow',
            creditsRequired: totalCost,
            currentBalance: result?.balance ?? 0,
            costBreakdown,
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      creditsConsumed = result.consumed ?? totalCost;
      creditsRemaining = result.balance ?? 0;
      creditReferenceId = result.reference_id ?? null;
    } else if (dryRun) {
      // Paid tier dry run
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          creditCost: 0,
          costBreakdown,
          workflowName: workflow.name,
          actionsCount: actions.length,
          message: 'Paid tier — no credit charge',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Execute actions
    const results = [];
    let executionFailed = false;

    for (const action of actions) {
      try {
        switch (action.type) {
          case 'send_email':
            results.push({ action: 'send_email', status: 'success' });
            break;
          case 'send_sms':
            results.push({ action: 'send_sms', status: 'success' });
            break;
          case 'add_tag':
            results.push({ action: 'add_tag', status: 'success' });
            break;
          case 'award_points':
            results.push({ action: 'award_points', status: 'success' });
            break;
          case 'send_push':
            results.push({ action: 'send_push', status: 'success' });
            break;
          default:
            results.push({ action: action.type, status: 'skipped' });
        }
      } catch (actionError) {
        executionFailed = true;
        results.push({
          action: action.type,
          status: 'failed',
          error: actionError instanceof Error ? actionError.message : 'Unknown error',
        });
      }
    }

    // Refund credits if the entire workflow execution failed
    if (executionFailed && isFreeTier && creditsConsumed > 0) {
      const { error: refundError } = await serviceClient
        .rpc('consume_credits', {
          p_tenant_id: tenantId,
          p_amount: -creditsConsumed,
          p_action_key: 'workflow_execute_refund',
          p_description: `Refund: workflow ${workflow.name} failed`,
          p_reference_id: creditReferenceId ? `refund_${creditReferenceId}` : null,
          p_metadata: { refund_reason: 'workflow_execution_failed', original_cost: creditsConsumed },
        });

      if (refundError) {
        console.error('Credit refund error:', refundError);
      } else {
        creditsConsumed = 0;
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

    console.error(`Workflow ${workflow.name} executed with ${results.length} actions`);

    // Build response with credit headers
    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      'Content-Type': 'application/json',
    };

    if (isFreeTier && totalCost > 0) {
      responseHeaders['X-Credits-Consumed'] = String(creditsConsumed);
      responseHeaders['X-Credits-Remaining'] = String(creditsRemaining);
    }

    return new Response(
      JSON.stringify({
        success: true,
        workflowName: workflow.name,
        actionsExecuted: results.length,
        results,
        ...(isFreeTier && totalCost > 0
          ? { creditsConsumed, creditsRemaining, costBreakdown }
          : {}),
      }),
      { headers: responseHeaders }
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
