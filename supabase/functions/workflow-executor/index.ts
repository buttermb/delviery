/**
 * Workflow Executor Edge Function
 * Executes workflow actions based on triggers
 */

import { serve, createClient, corsHeaders } from '../_shared/deps.ts';

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

    const { execution_id } = await req.json();

    if (!execution_id) {
      return new Response(
        JSON.stringify({ error: 'execution_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
      // Update execution as failed
      await supabase
        .from('workflow_executions')
        .update({
          status: 'failed',
          execution_log: executionLog,
          error_message: error.message,
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime
        })
        .eq('id', execution_id);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message,
          execution_log: executionLog
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
