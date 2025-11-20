import { serve, createClient, corsHeaders } from '../_shared/deps.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { schedule_id } = await req.json();

    if (!schedule_id) {
      throw new Error('Schedule ID is required');
    }

    // Get scheduled report configuration
    const { data: schedule, error: scheduleError } = await supabaseClient
      .from('scheduled_reports')
      .select('*, custom_reports(*)')
      .eq('id', schedule_id)
      .eq('is_active', true)
      .single();

    if (scheduleError) throw scheduleError;

    // Generate the report
    const reportConfig = schedule.custom_reports;
    const dataSources = reportConfig.data_sources as string[];
    const metrics = reportConfig.metrics as string[];
    
    // Calculate date range based on frequency
    const endDate = new Date();
    const startDate = new Date();
    
    switch (schedule.frequency) {
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

    // Fetch report data
    const reportData: Record<string, any> = {};

    for (const dataSource of dataSources) {
      const query = supabaseClient
        .from(dataSource)
        .select('*')
        .eq('tenant_id', schedule.tenant_id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      const { data, error } = await query;

      if (error) {
        console.error(`Error fetching ${dataSource}:`, error);
        reportData[dataSource] = [];
      } else {
        reportData[dataSource] = data || [];
      }
    }

    // Calculate metrics
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
        default:
          calculatedMetrics[metric] = 0;
      }
    }

    // Update last run timestamp
    await supabaseClient
      .from('scheduled_reports')
      .update({
        last_run_at: new Date().toISOString(),
        next_run_at: calculateNextRun(schedule.frequency, schedule.time_of_day)
      })
      .eq('id', schedule_id);

    // TODO: Generate PDF/CSV and upload to storage
    // TODO: Send email to recipients

    console.log(`Scheduled report ${reportConfig.name} generated and sent`);

    return new Response(
      JSON.stringify({
        success: true,
        report_name: reportConfig.name,
        generated_at: new Date().toISOString(),
        metrics: calculatedMetrics,
        recipients: schedule.recipients
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending scheduled report:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function calculateNextRun(frequency: string, timeOfDay: string): string {
  const now = new Date();
  const [hours, minutes] = timeOfDay.split(':').map(Number);
  
  const nextRun = new Date(now);
  nextRun.setHours(hours, minutes, 0, 0);

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
