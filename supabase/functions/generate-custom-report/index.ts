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

    const { reportId, startDate, endDate } = await req.json();

    if (!reportId) {
      throw new Error('Report ID is required');
    }

    // Get report configuration
    const { data: report, error: reportError } = await supabaseClient
      .from('custom_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (reportError) throw reportError;

    const dataSources = report.data_sources as string[];
    const metrics = report.metrics as string[];
    const dimensions = report.dimensions as string[];
    const filters = report.filters as Record<string, any>;

    // Build dynamic query based on configuration
    const reportData: Record<string, any> = {};

    for (const dataSource of dataSources) {
      let query = supabaseClient
        .from(dataSource)
        .select('*')
        .eq('tenant_id', report.tenant_id);

      // Apply date filters
      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      // Apply custom filters
      if (filters && Object.keys(filters).length > 0) {
        for (const [key, value] of Object.entries(filters)) {
          query = query.eq(key, value);
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error(`Error fetching ${dataSource}:`, error);
        reportData[dataSource] = [];
      } else {
        reportData[dataSource] = data || [];
      }
    }

    // Calculate metrics based on data
    const calculatedMetrics: Record<string, any> = {};

    for (const metric of metrics) {
      switch (metric) {
        case 'total_revenue':
          calculatedMetrics[metric] = reportData.wholesale_orders?.reduce(
            (sum: number, order: any) => sum + (order.total_amount || 0),
            0
          ) || 0;
          break;
        case 'order_count':
          calculatedMetrics[metric] = reportData.wholesale_orders?.length || 0;
          break;
        case 'customer_count':
          calculatedMetrics[metric] = reportData.wholesale_clients?.length || 0;
          break;
        case 'product_count':
          calculatedMetrics[metric] = reportData.products?.length || 0;
          break;
        default:
          calculatedMetrics[metric] = 0;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        reportName: report.name,
        generatedAt: new Date().toISOString(),
        data: reportData,
        metrics: calculatedMetrics,
        visualization: report.visualization_type,
        chartConfig: report.chart_config,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating report:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
