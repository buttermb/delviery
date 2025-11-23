/**
 * Workflow Executor Edge Function
 * Executes workflow actions based on triggers
 */

import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { validateWorkflowExecutor, type WorkflowExecutorInput } from './validation.ts';

interface WorkflowAction {
  id: string;
  type: string;
  config: Record<string, any>;
  edge_function?: string;
}

interface WorkflowExecution {
  id: string;
  workflow_id: string;
  tenant_id: string;
  trigger_data: Record<string, any>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rawBody = await req.json();
    const { execution_id }: WorkflowExecutorInput = validateWorkflowExecutor(rawBody);

    // Get execution details
    const { data: execution, error: execError } = await supabase
      .from('workflow_executions')
      .select(`
        *,
        workflow:workflow_definitions (
          id,
          name,
          actions,
          conditions
        )
      `)
      .eq('id', execution_id)
      .single();

    if (execError || !execution) {
      return new Response(
        JSON.stringify({ error: 'Execution not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update status to running
    await supabase
      .from('workflow_executions')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', execution_id);

    const executionLog: any[] = [];
    const startTime = Date.now();

    try {
      // Execute each action in sequence
      const actions = execution.workflow.actions as WorkflowAction[];
      
      for (const action of actions) {
        const actionStart = Date.now();
        
        try {
          let result = null;

          // Execute based on action type
          switch (action.type) {
            case 'send_email':
              result = await executeEmailAction(supabase, action, execution);
              break;
            
            case 'send_sms':
              result = await executeSMSAction(supabase, action, execution);
              break;
            
            case 'update_inventory':
              result = await executeInventoryUpdate(supabase, action, execution);
              break;
            
            case 'assign_courier':
              result = await executeAssignCourier(supabase, action, execution);
              break;
            
            case 'call_webhook':
              result = await executeWebhook(action, execution);
              break;
            
            case 'database_query':
              result = await executeDatabaseQuery(supabase, action, execution);
              break;
            
            default:
              // Try to call edge function if specified
              if (action.edge_function) {
                result = await executeEdgeFunction(supabase, action, execution);
              } else {
                throw new Error(`Unknown action type: ${action.type}`);
              }
          }

          executionLog.push({
            action_id: action.id,
            action_type: action.type,
            status: 'success',
            result,
            duration_ms: Date.now() - actionStart,
            timestamp: new Date().toISOString()
          });
        } catch (actionError: any) {
          executionLog.push({
            action_id: action.id,
            action_type: action.type,
            status: 'failed',
            error: actionError.message,
            duration_ms: Date.now() - actionStart,
            timestamp: new Date().toISOString()
          });
          
          // Stop execution on error
          throw actionError;
        }
      }

      // Update execution as completed
      await supabase
        .from('workflow_executions')
        .update({
          status: 'completed',
          execution_log: executionLog,
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime
        })
        .eq('id', execution_id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          execution_id,
          status: 'completed',
          actions_executed: executionLog.length
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error: any) {
      // Classify error type for retry logic
      const errorType = classifyError(error);
      const errorDetails = {
        error_type: errorType,
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      };

      // Get workflow retry config
      const retryConfig = execution.workflow.retry_config || {
        max_attempts: 3,
        initial_delay_seconds: 5,
        max_delay_seconds: 300,
        backoff_multiplier: 2,
        retry_on_errors: ['timeout', 'network_error', 'rate_limit', 'server_error']
      };

      // Check if error is retryable
      const isRetryable = retryConfig.retry_on_errors.includes(errorType);
      const retryCount = (execution.retry_count || 0) + 1;
      const canRetry = isRetryable && retryCount < retryConfig.max_attempts;

      if (canRetry) {
        // Calculate next retry delay with exponential backoff
        const { data: delayData } = await supabase.rpc('calculate_next_retry_delay', {
          p_retry_count: retryCount,
          p_retry_config: retryConfig
        });

        const delaySeconds = delayData || 5;
        const nextRetryAt = new Date(Date.now() + delaySeconds * 1000).toISOString();

        // Update execution for retry
        await supabase
          .from('workflow_executions')
          .update({
            status: 'failed',
            execution_log: executionLog,
            last_error: error.message,
            error_details: errorDetails,
            retry_count: retryCount,
            next_retry_at: nextRetryAt,
            is_retryable: true,
            duration_ms: Date.now() - startTime
          })
          .eq('id', execution_id);

        console.log(`Workflow execution ${execution_id} will retry in ${delaySeconds}s (attempt ${retryCount}/${retryConfig.max_attempts})`);

        return new Response(
          JSON.stringify({ 
            success: false, 
            error: error.message,
            retry_scheduled: true,
            retry_attempt: retryCount,
            max_attempts: retryConfig.max_attempts,
            next_retry_at: nextRetryAt,
            delay_seconds: delaySeconds
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Max retries exhausted or non-retryable error - move to dead letter queue
        await supabase
          .from('workflow_executions')
          .update({
            status: 'failed',
            execution_log: executionLog,
            last_error: error.message,
            error_details: errorDetails,
            retry_count: retryCount,
            is_retryable: false,
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime
          })
          .eq('id', execution_id);

        // Move to dead letter queue
        await supabase.rpc('move_to_dead_letter_queue', {
          p_execution_id: execution_id
        });

        console.error(`Workflow execution ${execution_id} moved to dead letter queue after ${retryCount} attempts`);

        return new Response(
          JSON.stringify({ 
            success: false, 
            error: error.message,
            moved_to_dlq: true,
            total_attempts: retryCount,
            error_type: errorType,
            execution_log: executionLog
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

  } catch (error: any) {
    console.error('Workflow execution error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Action Executors
async function executeEmailAction(supabase: any, action: WorkflowAction, execution: any) {
  const { to, subject, body } = action.config;
  
  // Call email edge function
  const { data, error } = await supabase.functions.invoke('send-email-notification', {
    body: { to, subject, body }
  });
  
  if (error) throw error;
  return data;
}

async function executeSMSAction(supabase: any, action: WorkflowAction, execution: any) {
  const { to, message } = action.config;
  
  const { data, error } = await supabase.functions.invoke('send-sms', {
    body: { to, message }
  });
  
  if (error) throw error;
  return data;
}

async function executeInventoryUpdate(supabase: any, action: WorkflowAction, execution: any) {
  const { product_id, quantity } = action.config;
  
  const { data, error } = await supabase
    .from('inventory')
    .update({ stock: quantity })
    .eq('product_id', product_id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

async function executeAssignCourier(supabase: any, action: WorkflowAction, execution: any) {
  const { order_id, courier_id } = action.config;
  
  const { data, error } = await supabase.functions.invoke('assign-courier', {
    body: { order_id, courier_id }
  });
  
  if (error) throw error;
  return data;
}

async function executeWebhook(action: WorkflowAction, execution: any) {
  const { url, method = 'POST', body, headers = {} } = action.config;
  
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify(body || execution.trigger_data)
  });
  
  if (!response.ok) {
    throw new Error(`Webhook failed: ${response.statusText}`);
  }
  
  return await response.json();
}

async function executeDatabaseQuery(supabase: any, action: WorkflowAction, execution: any) {
  const { table, operation, data, filter } = action.config;
  
  let query = supabase.from(table);
  
  switch (operation) {
    case 'insert':
      query = query.insert(data);
      break;
    case 'update':
      query = query.update(data);
      if (filter) {
        Object.entries(filter).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }
      break;
    case 'delete':
      if (filter) {
        Object.entries(filter).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }
      query = query.delete();
      break;
  }
  
  const { data: result, error } = await query.select();
  
  if (error) throw error;
  return result;
}

async function executeEdgeFunction(supabase: any, action: WorkflowAction, execution: any) {
  const { data, error } = await supabase.functions.invoke(action.edge_function!, {
    body: { ...action.config, trigger_data: execution.trigger_data }
  });
  
  if (error) throw error;
  return data;
}

// Error classifier for retry logic
function classifyError(error: any): string {
  const message = error.message?.toLowerCase() || '';
  
  // Timeout errors
  if (message.includes('timeout') || message.includes('timed out')) {
    return 'timeout';
  }
  
  // Network errors
  if (
    message.includes('network') ||
    message.includes('connection') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('fetch failed')
  ) {
    return 'network_error';
  }
  
  // Rate limiting
  if (
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    error.status === 429
  ) {
    return 'rate_limit';
  }
  
  // Server errors (5xx)
  if (error.status >= 500 && error.status < 600) {
    return 'server_error';
  }
  
  // Authentication errors (non-retryable)
  if (
    message.includes('unauthorized') ||
    message.includes('authentication') ||
    error.status === 401 ||
    error.status === 403
  ) {
    return 'auth_error';
  }
  
  // Validation errors (non-retryable)
  if (
    message.includes('validation') ||
    message.includes('invalid') ||
    error.status === 400 ||
    error.status === 422
  ) {
    return 'validation_error';
  }
  
  // Not found errors (non-retryable)
  if (message.includes('not found') || error.status === 404) {
    return 'not_found';
  }
  
  // Default to unknown
  return 'unknown_error';
}
