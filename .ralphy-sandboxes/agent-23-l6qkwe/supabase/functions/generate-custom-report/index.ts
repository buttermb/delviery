import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { escapePostgresLike } from '../_shared/searchSanitize.ts';

/**
 * Generate Custom Report Edge Function
 *
 * Executes custom report queries based on saved report configuration.
 * Supports multiple data sources, dynamic metrics calculation, and custom filters.
 */

// Validation schema for request body
const generateReportSchema = z.object({
  reportId: z.string().uuid('Invalid report ID format'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  format: z.enum(['json', 'csv', 'pdf']).optional().default('json'),
  filters: z.record(z.unknown()).optional().default({}),
});

type GenerateReportInput = z.infer<typeof generateReportSchema>;

// Map of allowed tables that can be queried
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

// Map of tables to their tenant field
const TENANT_FIELD_MAP: Record<string, string> = {
  orders: 'tenant_id',
  products: 'tenant_id',
  customers: 'tenant_id',
  wholesale_orders: 'tenant_id',
  wholesale_clients: 'tenant_id',
  wholesale_inventory: 'tenant_id',
  pos_transactions: 'tenant_id',
  pos_shifts: 'tenant_id',
  marketplace_orders: 'store_id', // Uses store_id, need to join with store
  marketplace_listings: 'store_id',
  marketplace_customers: 'store_id',
};

interface FilterCondition {
  field: string;
  operator: string;
  value: unknown;
  data_source?: string;
}

interface DateRange {
  preset?: string;
  start_date?: string;
  end_date?: string;
}

interface ReportFilters {
  conditions?: FilterCondition[];
  date_range?: DateRange;
  selected_fields?: string[];
}

interface MetricConfig {
  id: string;
  label: string;
  aggregation: 'sum' | 'count' | 'avg' | 'min' | 'max';
  field?: string;
  expression?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with user's auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Validate and parse request body
    const rawBody = await req.json();
    const input: GenerateReportInput = generateReportSchema.parse(rawBody);
    const { reportId, startDate, endDate, filters: additionalFilters } = input;

    if (!reportId) {
      throw new Error('Report ID is required');
    }

    // Fetch report configuration
    const { data: report, error: reportError } = await supabaseClient
      .from('custom_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (reportError) {
      console.error('Error fetching report:', reportError);
      throw new Error(`Failed to fetch report: ${reportError.message}`);
    }

    if (!report) {
      throw new Error('Report not found');
    }

    // Extract configuration from report
    const dataSources = (report.data_sources as string[]) || [];
    const metricsConfig = (report.metrics as string[]) || [];
    const dimensions = (report.dimensions as string[]) || [];
    const reportFilters = (report.filters as ReportFilters) || {};
    const tenantId = report.tenant_id;

    if (dataSources.length === 0) {
      throw new Error('No data sources configured for this report');
    }

    // Validate data sources - only allow known tables
    for (const source of dataSources) {
      if (!ALLOWED_TABLES.has(source)) {
        throw new Error(`Invalid data source: ${source}`);
      }
    }

    // Calculate effective date range
    const effectiveStartDate = startDate || reportFilters.date_range?.start_date;
    const effectiveEndDate = endDate || reportFilters.date_range?.end_date;

    // Query each data source
    const reportData: Record<string, unknown[]> = {};
    const calculatedMetrics: Record<string, number> = {};

    for (const dataSource of dataSources) {
      try {
        // Build the query
        let query = supabaseClient.from(dataSource).select('*');

        // Apply tenant isolation
        const tenantField = TENANT_FIELD_MAP[dataSource];
        if (tenantField === 'tenant_id') {
          query = query.eq('tenant_id', tenantId);
        } else if (tenantField === 'store_id') {
          // For marketplace tables, we need to get stores for this tenant first
          const { data: stores } = await supabaseClient
            .from('marketplace_stores')
            .select('id')
            .eq('tenant_id', tenantId);

          if (stores && stores.length > 0) {
            const storeIds = stores.map((s: { id: string }) => s.id);
            query = query.in('store_id', storeIds);
          } else {
            // No stores for this tenant, skip this source
            reportData[dataSource] = [];
            continue;
          }
        }

        // Apply date filters
        if (effectiveStartDate) {
          query = query.gte('created_at', effectiveStartDate);
        }
        if (effectiveEndDate) {
          // Add time to end date to include full day
          query = query.lte('created_at', effectiveEndDate + 'T23:59:59.999Z');
        }

        // Apply saved filter conditions
        if (reportFilters.conditions && Array.isArray(reportFilters.conditions)) {
          for (const condition of reportFilters.conditions) {
            // Only apply filters for this data source
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
              case 'contains':
                query = query.ilike(fieldName, `%${escapePostgresLike(String(condition.value))}%`);
                break;
              case 'not_contains':
                query = query.not(fieldName, 'ilike', `%${escapePostgresLike(String(condition.value))}%`);
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
              case 'not_in':
                if (Array.isArray(condition.value)) {
                  query = query.not(fieldName, 'in', `(${condition.value.join(',')})`);
                }
                break;
            }
          }
        }

        // Apply additional runtime filters
        if (additionalFilters && Object.keys(additionalFilters).length > 0) {
          for (const [key, value] of Object.entries(additionalFilters)) {
            if (value !== undefined && value !== null && value !== '') {
              query = query.eq(key, value);
            }
          }
        }

        // Limit results to prevent memory issues
        query = query.limit(10000);

        // Execute query
        const { data, error } = await query;

        if (error) {
          console.error(`Error querying ${dataSource}:`, error);
          reportData[dataSource] = [];
          continue;
        }

        reportData[dataSource] = data || [];

        // Calculate metrics for this data source
        const sourceData = data || [];
        for (const metricId of metricsConfig) {
          // Parse metric ID to get the actual metric definition
          const metricName = metricId.includes('.') ? metricId.split('.')[1] : metricId;

          // Common metric calculations
          switch (metricName) {
            case 'total_revenue':
            case 'wholesale_revenue':
            case 'marketplace_revenue':
            case 'pos_revenue': {
              const amountField = dataSource === 'marketplace_orders' ? 'total' : 'total_amount';
              const sum = sourceData.reduce(
                (acc, row) => acc + (Number(row[amountField]) || 0),
                0
              );
              calculatedMetrics[metricId] = (calculatedMetrics[metricId] || 0) + sum;
              break;
            }
            case 'order_count':
            case 'wholesale_order_count':
            case 'marketplace_order_count':
            case 'transaction_count':
            case 'client_count':
            case 'customer_count':
            case 'product_count':
            case 'shift_count':
              calculatedMetrics[metricId] = (calculatedMetrics[metricId] || 0) + sourceData.length;
              break;
            case 'avg_order_value':
            case 'avg_wholesale_order':
            case 'avg_marketplace_order':
            case 'avg_transaction': {
              const amountField = dataSource === 'marketplace_orders' ? 'total' : 'total_amount';
              if (sourceData.length > 0) {
                const sum = sourceData.reduce(
                  (acc, row) => acc + (Number(row[amountField]) || 0),
                  0
                );
                // For averages, we store running sum and count, then compute at the end
                const avgKey = `${metricId}_sum`;
                const countKey = `${metricId}_count`;
                calculatedMetrics[avgKey] = (calculatedMetrics[avgKey] || 0) + sum;
                calculatedMetrics[countKey] = (calculatedMetrics[countKey] || 0) + sourceData.length;
              }
              break;
            }
            case 'total_stock':
              const stockSum = sourceData.reduce(
                (acc, row) => acc + (Number(row['stock_quantity'] || row['quantity']) || 0),
                0
              );
              calculatedMetrics[metricId] = (calculatedMetrics[metricId] || 0) + stockSum;
              break;
            case 'avg_price':
              if (sourceData.length > 0) {
                const priceSum = sourceData.reduce(
                  (acc, row) => acc + (Number(row['price']) || 0),
                  0
                );
                calculatedMetrics[`${metricId}_sum`] = (calculatedMetrics[`${metricId}_sum`] || 0) + priceSum;
                calculatedMetrics[`${metricId}_count`] = (calculatedMetrics[`${metricId}_count`] || 0) + sourceData.length;
              }
              break;
          }
        }
      } catch (sourceError) {
        console.error(`Error processing data source ${dataSource}:`, sourceError);
        reportData[dataSource] = [];
      }
    }

    // Compute final averages
    for (const metricId of metricsConfig) {
      const avgKey = `${metricId}_sum`;
      const countKey = `${metricId}_count`;
      if (calculatedMetrics[avgKey] !== undefined && calculatedMetrics[countKey] > 0) {
        calculatedMetrics[metricId] = calculatedMetrics[avgKey] / calculatedMetrics[countKey];
        delete calculatedMetrics[avgKey];
        delete calculatedMetrics[countKey];
      }
    }

    // Update last_run_at
    await supabaseClient
      .from('custom_reports')
      .update({ last_run_at: new Date().toISOString() })
      .eq('id', reportId);

    // Log execution (if table exists)
    try {
      await supabaseClient.from('report_executions').insert({
        report_id: reportId,
        tenant_id: tenantId,
        status: 'completed',
        filters: {
          start_date: effectiveStartDate,
          end_date: effectiveEndDate,
          additional: additionalFilters,
        },
        result_summary: {
          data_sources: dataSources,
          metrics: calculatedMetrics,
        },
        row_count: Object.values(reportData).reduce((acc, arr) => acc + arr.length, 0),
      });
    } catch {
      // Table might not exist, ignore
    }

    return new Response(
      JSON.stringify({
        success: true,
        reportName: report.name,
        generatedAt: new Date().toISOString(),
        dateRange: {
          start: effectiveStartDate,
          end: effectiveEndDate,
        },
        data: reportData,
        metrics: calculatedMetrics,
        visualization: report.visualization_type,
        chartConfig: report.chart_config,
        rowCount: Object.values(reportData).reduce((acc, arr) => acc + arr.length, 0),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating report:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: message, success: false }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
