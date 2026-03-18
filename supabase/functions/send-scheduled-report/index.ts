/**
 * Send Scheduled Report Edge Function
 *
 * Generates a report based on a scheduled_reports configuration,
 * calculates metrics, produces a CSV attachment, and emails
 * the results to the configured recipients.
 *
 * Supports both cron invocations (service-role key) and manual
 * triggers (authenticated user JWT).
 *
 * Schedule: Called by pg_cron or external scheduler
 */

import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { withZenProtection } from '../_shared/zen-firewall.ts';
import { createLogger } from '../_shared/logger.ts';
import { validateSendScheduledReport } from './validation.ts';
import type { SupabaseClient } from '../_shared/deps.ts';

const logger = createLogger('send-scheduled-report');

// Allowed tables that can be queried — prevents arbitrary table access
const ALLOWED_TABLES = new Set([
  'orders',
  'products',
  'customers',
  'wholesale_orders',
  'wholesale_clients',
  'wholesale_inventory',
  'pos_transactions',
  'pos_shifts',
  'marketplace_orders',
  'marketplace_listings',
  'marketplace_customers',
]);

// Map of tables to their tenant isolation field
const TENANT_FIELD_MAP: Record<string, string> = {
  orders: 'tenant_id',
  products: 'tenant_id',
  customers: 'tenant_id',
  wholesale_orders: 'tenant_id',
  wholesale_clients: 'tenant_id',
  wholesale_inventory: 'tenant_id',
  pos_transactions: 'tenant_id',
  pos_shifts: 'tenant_id',
  marketplace_orders: 'store_id',
  marketplace_listings: 'store_id',
  marketplace_customers: 'store_id',
};

interface ScheduledReport {
  id: string;
  tenant_id: string;
  report_id: string;
  schedule_type: 'daily' | 'weekly' | 'monthly';
  schedule_config: Record<string, unknown>;
  recipients: string[];
  next_run_at: string | null;
  last_run_at: string | null;
  enabled: boolean;
  custom_reports: CustomReport;
}

interface CustomReport {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  data_sources: string[];
  metrics: string[];
  dimensions: string[];
  filters: ReportFilters;
  visualization_type: string;
  chart_config: Record<string, unknown>;
}

interface ReportFilters {
  conditions?: FilterCondition[];
  date_range?: { preset?: string; start_date?: string; end_date?: string };
  selected_fields?: string[];
}

interface FilterCondition {
  field: string;
  operator: string;
  value: unknown;
  data_source?: string;
}

serve(
  withZenProtection(async (req) => {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

      // Auth: accept service-role key (cron) or valid user JWT (manual trigger)
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Missing authorization' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const token = authHeader.replace('Bearer ', '');
      const isServiceCall = token === supabaseServiceKey;

      // Use service client for all DB operations (need cross-tenant access for cron)
      const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

      if (!isServiceCall) {
        // Verify user JWT for manual triggers
        const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);
        if (authError || !user) {
          return new Response(
            JSON.stringify({ error: 'Invalid or expired token' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        logger.info('Manual trigger by user', { userId: user.id });
      } else {
        logger.info('Cron/service trigger');
      }

      // Validate request body
      const rawBody = await req.json();
      const { schedule_id, force, override_recipients } = validateSendScheduledReport(rawBody);

      // Fetch the scheduled report with its custom_reports config
      const { data: schedule, error: scheduleError } = await serviceClient
        .from('scheduled_reports')
        .select('*, custom_reports(*)')
        .eq('id', schedule_id)
        .maybeSingle();

      if (scheduleError) {
        logger.error('Failed to fetch schedule', { scheduleId: schedule_id, error: scheduleError.message });
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

      const typedSchedule = schedule as unknown as ScheduledReport;

      // Check if schedule is active (skip if force=true)
      if (!typedSchedule.enabled && !force) {
        return new Response(
          JSON.stringify({ error: 'Scheduled report is disabled', schedule_id }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const reportConfig = typedSchedule.custom_reports;
      if (!reportConfig) {
        return new Response(
          JSON.stringify({ error: 'Associated custom report not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tenantId = typedSchedule.tenant_id;
      const dataSources = (reportConfig.data_sources ?? []) as string[];
      const metricsConfig = (reportConfig.metrics ?? []) as string[];

      // Validate data sources against allowlist
      for (const source of dataSources) {
        if (!ALLOWED_TABLES.has(source)) {
          logger.warn('Blocked disallowed data source', { source, scheduleId: schedule_id });
          return new Response(
            JSON.stringify({ error: `Invalid data source: ${source}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Calculate date range based on schedule_type
      const endDate = new Date();
      const startDate = new Date();

      switch (typedSchedule.schedule_type) {
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

      logger.info('Generating report', {
        scheduleId: schedule_id,
        reportName: reportConfig.name,
        tenantId,
        dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
      });

      // Fetch data from each source with tenant isolation
      const reportData: Record<string, Record<string, unknown>[]> = {};

      for (const dataSource of dataSources) {
        const data = await fetchDataSource(
          serviceClient,
          dataSource,
          tenantId,
          startDate,
          endDate,
          reportConfig.filters
        );
        reportData[dataSource] = data;
      }

      // Calculate metrics
      const calculatedMetrics = calculateMetrics(metricsConfig, reportData);

      // Generate CSV content
      const csvContent = generateCsv(reportData, calculatedMetrics, reportConfig.name, startDate, endDate);

      // Determine recipients
      const recipients = override_recipients ?? typedSchedule.recipients ?? [];

      // Send email to each recipient
      let emailsSent = 0;
      let emailsFailed = 0;

      if (recipients.length > 0) {
        const emailResults = await sendReportEmails(
          supabaseUrl,
          supabaseServiceKey,
          tenantId,
          reportConfig.name,
          typedSchedule.schedule_type,
          calculatedMetrics,
          csvContent,
          recipients,
          startDate,
          endDate
        );
        emailsSent = emailResults.sent;
        emailsFailed = emailResults.failed;
      }

      // Update schedule: last_run_at and next_run_at
      const timeOfDay = (typedSchedule.schedule_config as Record<string, string>)?.time_of_day ?? '08:00';
      const nextRunAt = calculateNextRun(typedSchedule.schedule_type, timeOfDay);

      await serviceClient
        .from('scheduled_reports')
        .update({
          last_run_at: new Date().toISOString(),
          next_run_at: nextRunAt,
        })
        .eq('id', schedule_id);

      // Log report execution
      try {
        await serviceClient.from('report_executions').insert({
          report_id: reportConfig.id,
          tenant_id: tenantId,
          status: 'completed',
          filters: {
            schedule_type: typedSchedule.schedule_type,
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
          },
          result_summary: {
            data_sources: dataSources,
            metrics: calculatedMetrics,
            recipients_count: recipients.length,
            emails_sent: emailsSent,
          },
          row_count: Object.values(reportData).reduce((acc, arr) => acc + arr.length, 0),
        });
      } catch {
        // report_executions table may not exist — non-critical
      }

      logger.info('Report generated and sent', {
        scheduleId: schedule_id,
        reportName: reportConfig.name,
        tenantId,
        recipientsCount: recipients.length,
        emailsSent,
        emailsFailed,
      });

      return new Response(
        JSON.stringify({
          success: true,
          report_name: reportConfig.name,
          generated_at: new Date().toISOString(),
          date_range: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          },
          metrics: calculatedMetrics,
          row_count: Object.values(reportData).reduce((acc, arr) => acc + arr.length, 0),
          recipients: recipients.length,
          emails_sent: emailsSent,
          emails_failed: emailsFailed,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Failed to send scheduled report', { error: message });
      return new Response(
        JSON.stringify({ error: message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  })
);

/**
 * Fetch data from a single source with tenant isolation and date filtering.
 */
async function fetchDataSource(
  supabase: SupabaseClient,
  dataSource: string,
  tenantId: string,
  startDate: Date,
  endDate: Date,
  filters?: ReportFilters
): Promise<Record<string, unknown>[]> {
  try {
    let query = supabase.from(dataSource).select('*');

    // Apply tenant isolation
    const tenantField = TENANT_FIELD_MAP[dataSource];
    if (tenantField === 'tenant_id') {
      query = query.eq('tenant_id', tenantId);
    } else if (tenantField === 'store_id') {
      // For marketplace tables, resolve store IDs for this tenant
      const { data: stores } = await supabase
        .from('marketplace_stores')
        .select('id')
        .eq('tenant_id', tenantId);

      if (stores && stores.length > 0) {
        const storeIds = stores.map((s: { id: string }) => s.id);
        query = query.in('store_id', storeIds);
      } else {
        return [];
      }
    }

    // Apply date range
    query = query
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    // Apply saved filter conditions
    if (filters?.conditions && Array.isArray(filters.conditions)) {
      for (const condition of filters.conditions) {
        if (condition.data_source && condition.data_source !== dataSource) {
          continue;
        }

        const fieldName = condition.field.includes('.')
          ? condition.field.split('.')[1]
          : condition.field;

        switch (condition.operator) {
          case 'equals':
            query = query.eq(fieldName, condition.value);
            break;
          case 'not_equals':
            query = query.neq(fieldName, condition.value);
            break;
          case 'greater_than':
            query = query.gt(fieldName, condition.value);
            break;
          case 'less_than':
            query = query.lt(fieldName, condition.value);
            break;
          case 'greater_or_equal':
            query = query.gte(fieldName, condition.value);
            break;
          case 'less_or_equal':
            query = query.lte(fieldName, condition.value);
            break;
          case 'is_null':
            query = query.is(fieldName, null);
            break;
          case 'is_not_null':
            query = query.not(fieldName, 'is', null);
            break;
          case 'in':
            if (Array.isArray(condition.value)) {
              query = query.in(fieldName, condition.value);
            }
            break;
        }
      }
    }

    // Limit results to prevent memory issues
    query = query.limit(10000);

    const { data, error } = await query;

    if (error) {
      logger.warn('Error fetching data source', { dataSource, error: error.message });
      return [];
    }

    return (data as Record<string, unknown>[]) ?? [];
  } catch (err) {
    logger.error('Exception fetching data source', {
      dataSource,
      error: (err as Error).message,
    });
    return [];
  }
}

/**
 * Calculate metrics from fetched report data.
 */
function calculateMetrics(
  metricsConfig: string[],
  reportData: Record<string, Record<string, unknown>[]>
): Record<string, number> {
  const metrics: Record<string, number> = {};

  for (const metricId of metricsConfig) {
    const metricName = metricId.includes('.') ? metricId.split('.')[1] : metricId;

    switch (metricName) {
      case 'total_revenue':
      case 'wholesale_revenue':
      case 'marketplace_revenue':
      case 'pos_revenue': {
        let sum = 0;
        for (const [source, rows] of Object.entries(reportData)) {
          const amountField = source === 'marketplace_orders' ? 'total' : 'total_amount';
          sum += rows.reduce((acc, row) => acc + (Number(row[amountField]) || 0), 0);
        }
        metrics[metricId] = sum;
        break;
      }
      case 'order_count':
      case 'wholesale_order_count':
      case 'marketplace_order_count':
      case 'transaction_count':
        metrics[metricId] = Object.values(reportData).reduce(
          (acc, rows) => acc + rows.length, 0
        );
        break;
      case 'customer_count':
        metrics[metricId] = (reportData['customers'] ?? reportData['wholesale_clients'] ?? []).length;
        break;
      case 'product_count':
        metrics[metricId] = (reportData['products'] ?? reportData['wholesale_inventory'] ?? []).length;
        break;
      case 'avg_order_value': {
        let totalAmount = 0;
        let totalCount = 0;
        for (const [source, rows] of Object.entries(reportData)) {
          const amountField = source === 'marketplace_orders' ? 'total' : 'total_amount';
          totalAmount += rows.reduce((acc, row) => acc + (Number(row[amountField]) || 0), 0);
          totalCount += rows.length;
        }
        metrics[metricId] = totalCount > 0 ? totalAmount / totalCount : 0;
        break;
      }
      case 'total_stock':
        metrics[metricId] = Object.values(reportData)
          .flat()
          .reduce((acc, row) => acc + (Number(row['stock_quantity'] ?? row['quantity']) || 0), 0);
        break;
      default:
        metrics[metricId] = 0;
    }
  }

  return metrics;
}

/**
 * Generate CSV content from report data and metrics.
 */
function generateCsv(
  reportData: Record<string, Record<string, unknown>[]>,
  metrics: Record<string, number>,
  reportName: string,
  startDate: Date,
  endDate: Date
): string {
  const lines: string[] = [];

  // Header section
  lines.push(`Report: ${escapeCsvField(reportName)}`);
  lines.push(`Period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');

  // Metrics summary
  if (Object.keys(metrics).length > 0) {
    lines.push('--- Metrics Summary ---');
    for (const [key, value] of Object.entries(metrics)) {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      lines.push(`${label},${typeof value === 'number' ? value.toFixed(2) : value}`);
    }
    lines.push('');
  }

  // Data tables
  for (const [source, rows] of Object.entries(reportData)) {
    if (rows.length === 0) continue;

    lines.push(`--- ${source.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} ---`);

    // Column headers from first row
    const columns = Object.keys(rows[0]);
    lines.push(columns.map(escapeCsvField).join(','));

    // Data rows
    for (const row of rows) {
      const values = columns.map(col => {
        const val = row[col];
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return escapeCsvField(JSON.stringify(val));
        return escapeCsvField(String(val));
      });
      lines.push(values.join(','));
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Escape a value for safe CSV output.
 */
function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Send report emails to recipients via the send-notification edge function.
 */
async function sendReportEmails(
  supabaseUrl: string,
  supabaseServiceKey: string,
  tenantId: string,
  reportName: string,
  scheduleType: string,
  metrics: Record<string, number>,
  csvContent: string,
  recipients: string[],
  startDate: Date,
  endDate: Date
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  const subject = `[Scheduled Report] ${reportName} — ${scheduleType} report`;
  const html = generateReportEmailHtml(reportName, scheduleType, metrics, startDate, endDate);

  for (const recipient of recipients) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          type: 'system',
          title: subject,
          message: `Scheduled report "${reportName}" is ready.`,
          channels: ['database', 'email'],
          metadata: {
            email_to: recipient,
            email_subject: subject,
            email_html: html,
            csv_attachment: csvContent,
            report_name: reportName,
            schedule_type: scheduleType,
          },
        }),
      });

      if (response.ok) {
        sent++;
      } else {
        const errorText = await response.text();
        logger.warn('Email delivery failed', { recipient, status: response.status, error: errorText });
        failed++;
      }
    } catch (err) {
      logger.error('Email send error', { recipient, error: (err as Error).message });
      failed++;
    }
  }

  return { sent, failed };
}

/**
 * Generate HTML email body for the report.
 */
function generateReportEmailHtml(
  reportName: string,
  scheduleType: string,
  metrics: Record<string, number>,
  startDate: Date,
  endDate: Date
): string {
  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const metricsRows = Object.entries(metrics)
    .map(([key, value]) => {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const formatted = key.includes('revenue') || key.includes('amount') || key.includes('avg')
        ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : value.toLocaleString('en-US');
      return `
        <tr>
          <td style="padding: 10px 16px; border-bottom: 1px solid #e5e7eb; color: #374151;">${escapeHtml(label)}</td>
          <td style="padding: 10px 16px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: #111827;">${formatted}</td>
        </tr>`;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px;">${escapeHtml(reportName)}</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">
            ${scheduleType.charAt(0).toUpperCase() + scheduleType.slice(1)} Report &bull; ${formatDate(startDate)} &ndash; ${formatDate(endDate)}
          </p>
        </div>
        <div style="padding: 24px;">
          ${metricsRows
            ? `<table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">
                <thead>
                  <tr style="background: #f9fafb;">
                    <th style="padding: 10px 16px; text-align: left; border-bottom: 2px solid #e5e7eb;">Metric</th>
                    <th style="padding: 10px 16px; text-align: right; border-bottom: 2px solid #e5e7eb;">Value</th>
                  </tr>
                </thead>
                <tbody>${metricsRows}</tbody>
              </table>`
            : '<p style="color: #6b7280;">No metrics configured for this report.</p>'}
          <p style="color: #6b7280; font-size: 13px; margin: 24px 0 0; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center;">
            This is an automated ${scheduleType} report from FloraIQ.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(text: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (ch) => entities[ch]);
}

/**
 * Calculate the next run timestamp based on frequency and time-of-day.
 */
function calculateNextRun(frequency: string, timeOfDay: string): string {
  const now = new Date();
  const [hours, minutes] = timeOfDay.split(':').map(Number);

  const nextRun = new Date(now);
  nextRun.setHours(hours ?? 8, minutes ?? 0, 0, 0);

  switch (frequency) {
    case 'daily':
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;
    case 'weekly':
      nextRun.setDate(nextRun.getDate() + 7);
      break;
    case 'monthly':
      nextRun.setMonth(nextRun.getMonth() + 1);
      break;
  }

  return nextRun.toISOString();
}
