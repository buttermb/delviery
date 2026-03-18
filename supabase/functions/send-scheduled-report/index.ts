import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { validateSendScheduledReport, type SendScheduledReportInput } from './validation.ts';
import { sendEmail } from '../_shared/email.ts';

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

    const rawBody = await req.json();
    const { schedule_id }: SendScheduledReportInput = validateSendScheduledReport(rawBody);

    // Get scheduled report configuration
    const { data: schedule, error: scheduleError } = await supabaseClient
      .from('scheduled_reports')
      .select('*, custom_reports(*)')
      .eq('id', schedule_id)
      .eq('is_active', true)
      .maybeSingle();

    if (scheduleError || !schedule) {
      return new Response(
        JSON.stringify({ error: 'Scheduled report not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
    const reportData: Record<string, unknown> = {};

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
    const calculatedMetrics: Record<string, unknown> = {};

    for (const metric of metrics) {
      switch (metric) {
        case 'total_revenue':
          calculatedMetrics[metric] = reportData.wholesale_orders?.reduce(
            (sum: number, order: Record<string, unknown>) => sum + (Number(order.total_amount) || 0),
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

    // Generate CSV content from report data
    const csvRows: string[] = [];
    csvRows.push(`Report: ${reportConfig.name}`);
    csvRows.push(`Period: ${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)}`);
    csvRows.push('');
    for (const [metric, value] of Object.entries(calculatedMetrics)) {
      csvRows.push(`${metric},${value}`);
    }
    const csvContent = csvRows.join('\n');

    // Upload CSV to storage
    const fileName = `reports/${schedule.tenant_id}/${reportConfig.name.replace(/\s+/g, '_')}_${endDate.toISOString().slice(0, 10)}.csv`;
    await supabaseClient.storage
      .from('exports')
      .upload(fileName, new Blob([csvContent], { type: 'text/csv' }), { upsert: true });

    // Send email to recipients
    const recipients = (schedule.recipients || []) as string[];
    if (recipients.length > 0) {
      const metricsHtml = Object.entries(calculatedMetrics)
        .map(([key, val]) => `<li><strong>${key}:</strong> ${val}</li>`)
        .join('');

      for (const recipient of recipients) {
        await sendEmail({
          to: recipient,
          subject: `Scheduled Report: ${reportConfig.name}`,
          html: `<h2>${reportConfig.name}</h2>
            <p>Period: ${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)}</p>
            <h3>Key Metrics</h3><ul>${metricsHtml}</ul>
            <p><em>Full CSV report has been saved to storage.</em></p>`,
        }).catch((err) => console.error(`Failed to email report to ${recipient}:`, err));
      }
    }

    console.error(`Scheduled report ${reportConfig.name} generated and sent`);

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
