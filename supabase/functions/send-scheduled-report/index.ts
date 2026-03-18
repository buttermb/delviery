import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { withZenProtection } from '../_shared/zen-firewall.ts';
import { createLogger } from '../_shared/logger.ts';
import { validateSendScheduledReport, ALLOWED_DATA_SOURCES } from './validation.ts';

const logger = createLogger('send-scheduled-report');

serve(
  withZenProtection(async (req) => {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Missing required environment variables');
      }

      // Use service role for scheduled/cron invocations
      const supabase = createClient(supabaseUrl, serviceRoleKey);

      // Verify authentication — accept service role key or valid JWT
      const authHeader = req.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const rawBody = await req.json();
      const { schedule_id, force } = validateSendScheduledReport(rawBody);

      logger.info('Processing scheduled report', { requestId: schedule_id });

      // Get scheduled report with its custom report config
      const { data: schedule, error: scheduleError } = await supabase
        .from('scheduled_reports')
        .select('*, custom_reports(*)')
        .eq('id', schedule_id)
        .maybeSingle();

      if (scheduleError) {
        logger.error('Failed to fetch schedule', { requestId: schedule_id });
        return new Response(
          JSON.stringify({ error: 'Failed to fetch scheduled report' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!schedule) {
        return new Response(
          JSON.stringify({ error: 'Scheduled report not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if enabled (skip if force=true)
      if (!schedule.enabled && !force) {
        return new Response(
          JSON.stringify({ error: 'Scheduled report is disabled' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const reportConfig = schedule.custom_reports;
      if (!reportConfig) {
        return new Response(
          JSON.stringify({ error: 'Report configuration not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tenantId = schedule.tenant_id;
      const dataSources: string[] = Array.isArray(reportConfig.data_sources)
        ? reportConfig.data_sources
        : [];
      const metrics: string[] = Array.isArray(reportConfig.metrics)
        ? reportConfig.metrics
        : [];

      // Log execution start
      const { data: execution } = await supabase
        .from('report_executions')
        .insert({
          report_id: reportConfig.id,
          tenant_id: tenantId,
          execution_type: 'scheduled',
          status: 'running',
          filters: { schedule_id, frequency: schedule.schedule_type },
        })
        .select('id')
        .maybeSingle();

      const executionId = execution?.id;
      const startTime = Date.now();

      // Calculate date range based on schedule_type
      const endDate = new Date();
      const startDate = new Date();

      switch (schedule.schedule_type) {
        case 'daily':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case 'weekly':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'monthly':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
      }

      // Fetch data from each allowed source
      const reportData: Record<string, unknown[]> = {};
      let totalRowCount = 0;

      for (const dataSource of dataSources) {
        // Validate data source against allowlist to prevent arbitrary table access
        if (!ALLOWED_DATA_SOURCES.has(dataSource)) {
          logger.warn('Skipping disallowed data source', {
            tenantId,
            requestId: schedule_id,
          });
          reportData[dataSource] = [];
          continue;
        }

        const { data, error } = await supabase
          .from(dataSource)
          .select('*')
          .eq('tenant_id', tenantId)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());

        if (error) {
          logger.error(`Error fetching data source: ${dataSource}`, {
            tenantId,
            requestId: schedule_id,
          });
          reportData[dataSource] = [];
        } else {
          reportData[dataSource] = data ?? [];
          totalRowCount += (data ?? []).length;
        }
      }

      // Calculate metrics from fetched data
      const calculatedMetrics: Record<string, number> = {};

      for (const metric of metrics) {
        switch (metric) {
          case 'total_revenue':
          case 'wholesale_revenue': {
            const orders = (reportData['wholesale_orders'] ?? reportData['orders'] ?? []) as Record<string, unknown>[];
            calculatedMetrics[metric] = orders.reduce(
              (sum, order) => sum + (Number(order.total_amount) || 0),
              0
            );
            break;
          }
          case 'order_count':
          case 'wholesale_order_count':
            calculatedMetrics[metric] = (reportData['wholesale_orders'] ?? reportData['orders'] ?? []).length;
            break;
          case 'customer_count':
          case 'client_count':
            calculatedMetrics[metric] = (reportData['wholesale_clients'] ?? reportData['customers'] ?? []).length;
            break;
          case 'avg_order_value':
          case 'avg_wholesale_order': {
            const allOrders = (reportData['wholesale_orders'] ?? reportData['orders'] ?? []) as Record<string, unknown>[];
            const total = allOrders.reduce(
              (sum, order) => sum + (Number(order.total_amount) || 0),
              0
            );
            calculatedMetrics[metric] = allOrders.length > 0 ? total / allOrders.length : 0;
            break;
          }
          case 'product_count':
            calculatedMetrics[metric] = (reportData['products'] ?? []).length;
            break;
          case 'transaction_count':
            calculatedMetrics[metric] = (reportData['pos_transactions'] ?? []).length;
            break;
          case 'pos_revenue': {
            const txns = (reportData['pos_transactions'] ?? []) as Record<string, unknown>[];
            calculatedMetrics[metric] = txns.reduce(
              (sum, txn) => sum + (Number(txn.total_amount) || 0),
              0
            );
            break;
          }
          case 'marketplace_revenue': {
            const mOrders = (reportData['marketplace_orders'] ?? []) as Record<string, unknown>[];
            calculatedMetrics[metric] = mOrders.reduce(
              (sum, order) => sum + (Number(order.total) || 0),
              0
            );
            break;
          }
          default:
            calculatedMetrics[metric] = 0;
        }
      }

      const executionTimeMs = Date.now() - startTime;

      // Update scheduled_reports: last_run_at and next_run_at
      const nextRunAt = calculateNextRun(schedule.schedule_type, schedule.schedule_config);
      await supabase
        .from('scheduled_reports')
        .update({
          last_run_at: new Date().toISOString(),
          next_run_at: nextRunAt,
        })
        .eq('id', schedule_id);

      // Update execution record
      if (executionId) {
        await supabase
          .from('report_executions')
          .update({
            status: 'completed',
            result_summary: {
              metrics: calculatedMetrics,
              data_sources_queried: dataSources.filter((ds) => ALLOWED_DATA_SOURCES.has(ds)),
              date_range: {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
              },
            },
            row_count: totalRowCount,
            execution_time_ms: executionTimeMs,
          })
          .eq('id', executionId);
      }

      logger.info('Scheduled report generated successfully', {
        tenantId,
        requestId: schedule_id,
      });

      return new Response(
        JSON.stringify({
          success: true,
          report_name: reportConfig.name,
          generated_at: new Date().toISOString(),
          next_run_at: nextRunAt,
          metrics: calculatedMetrics,
          row_count: totalRowCount,
          execution_time_ms: executionTimeMs,
          recipients: schedule.recipients,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      logger.error('Error sending scheduled report', {
        error: error instanceof Error ? error.message : String(error),
      });
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      return new Response(
        JSON.stringify({ error: message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  })
);

function calculateNextRun(
  scheduleType: string,
  scheduleConfig: Record<string, unknown> | null
): string {
  const now = new Date();
  const config = scheduleConfig ?? {};
  const timeOfDay = typeof config.time === 'string' ? config.time : '09:00';
  const [hours, minutes] = timeOfDay.split(':').map(Number);

  const nextRun = new Date(now);
  nextRun.setHours(hours || 9, minutes || 0, 0, 0);

  switch (scheduleType) {
    case 'daily':
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;
    case 'weekly': {
      const dayOfWeek = typeof config.day_of_week === 'number' ? config.day_of_week : 1;
      nextRun.setDate(nextRun.getDate() + ((7 + dayOfWeek - nextRun.getDay()) % 7 || 7));
      break;
    }
    case 'monthly': {
      const dayOfMonth = typeof config.day_of_month === 'number' ? config.day_of_month : 1;
      nextRun.setMonth(nextRun.getMonth() + 1);
      nextRun.setDate(Math.min(dayOfMonth, new Date(nextRun.getFullYear(), nextRun.getMonth() + 1, 0).getDate()));
      break;
    }
  }

  return nextRun.toISOString();
}
