import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { validateSendScheduledReport, type SendScheduledReportInput } from './validation.ts';

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

    // Generate CSV from report data and upload to storage
    const csvContent = generateCsvFromReportData(reportData, calculatedMetrics);
    const fileName = `reports/${schedule.tenant_id}/${reportConfig.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;

    let storageUrl: string | null = null;
    try {
      const csvBlob = new Blob([csvContent], { type: 'text/csv' });
      const { error: uploadError } = await supabaseClient.storage
        .from('report-exports')
        .upload(fileName, csvBlob, {
          contentType: 'text/csv',
          upsert: true,
        });

      if (uploadError) {
        console.error('Failed to upload report to storage:', uploadError);
      } else {
        const { data: urlData } = supabaseClient.storage
          .from('report-exports')
          .getPublicUrl(fileName);
        storageUrl = urlData?.publicUrl ?? null;
      }
    } catch (uploadErr) {
      console.error('Storage upload error:', uploadErr);
    }

    // Send notification to recipients
    const recipients = (schedule.recipients as string[]) ?? [];
    if (recipients.length > 0) {
      try {
        // Insert notification records for each recipient
        // Actual email delivery would be handled by a separate email service integration
        for (const recipientEmail of recipients) {
          await supabaseClient
            .from('in_app_notifications')
            .insert({
              tenant_id: schedule.tenant_id,
              title: `Scheduled Report: ${reportConfig.name}`,
              message: `Your ${schedule.frequency} report "${reportConfig.name}" has been generated.${storageUrl ? ' Download it from the reports section.' : ''}`,
              type: 'report',
              metadata: {
                report_id: reportConfig.id,
                schedule_id: schedule_id,
                storage_url: storageUrl,
                recipient_email: recipientEmail,
              },
            });
        }
      } catch (notifyErr) {
        // Notification table may not exist, log and continue
        console.error('Failed to create report notifications:', notifyErr);
      }
    }

    console.error(`Scheduled report ${reportConfig.name} generated${storageUrl ? ' and uploaded' : ''}, ${recipients.length} recipients notified`);

    return new Response(
      JSON.stringify({
        success: true,
        report_name: reportConfig.name,
        generated_at: new Date().toISOString(),
        metrics: calculatedMetrics,
        recipients: schedule.recipients,
        storage_url: storageUrl,
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

function escapeCsvField(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateCsvFromReportData(
  reportData: Record<string, unknown>,
  calculatedMetrics: Record<string, unknown>,
): string {
  const sections: string[] = [];

  // Add metrics summary section
  const metricEntries = Object.entries(calculatedMetrics);
  if (metricEntries.length > 0) {
    sections.push('Metrics Summary');
    sections.push('Metric,Value');
    for (const [key, value] of metricEntries) {
      sections.push(`${escapeCsvField(key)},${escapeCsvField(value)}`);
    }
    sections.push('');
  }

  // Add data sections for each source
  for (const [sourceName, rows] of Object.entries(reportData)) {
    const dataRows = rows as Record<string, unknown>[];
    if (!Array.isArray(dataRows) || dataRows.length === 0) continue;

    sections.push(`Data: ${sourceName}`);
    const headers = Object.keys(dataRows[0]);
    sections.push(headers.map(escapeCsvField).join(','));

    for (const row of dataRows) {
      sections.push(headers.map((h) => escapeCsvField(row[h])).join(','));
    }
    sections.push('');
  }

  return sections.join('\n');
}

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
