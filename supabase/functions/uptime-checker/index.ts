/**
 * Uptime Checker Edge Function
 * Runs every 60 seconds to check critical endpoints and services
 * Stores results in uptime_checks table
 */

import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { secureHeadersMiddleware } from '../_shared/secure-headers.ts';

interface UptimeCheck {
  service_name: string;
  endpoint: string;
  status: 'up' | 'down' | 'degraded';
  response_time_ms: number;
  status_code?: number;
  error_message?: string;
}

serve(secureHeadersMiddleware(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Define services to check
    const servicesToCheck = [
      {
        name: 'Supabase API',
        endpoint: `${supabaseUrl}/rest/v1/`,
      },
      {
        name: 'Database',
        endpoint: `${supabaseUrl}/rest/v1/tenants?limit=1`,
      },
      {
        name: 'Edge Functions',
        endpoint: `${supabaseUrl}/functions/v1/`,
      },
    ];

    const checks: UptimeCheck[] = [];

    // Check each service
    for (const service of servicesToCheck) {
      const startTime = Date.now();

      try {
        const response = await fetch(service.endpoint, {
          method: 'GET',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
          signal: AbortSignal.timeout(5000),
        });

        const responseTime = Date.now() - startTime;
        const statusCode = response.status;

        let status: 'up' | 'down' | 'degraded' = 'up';

        if (!response.ok) {
          status = statusCode >= 500 ? 'down' : 'degraded';
        } else if (responseTime > 1000) {
          status = 'degraded';
        }

        checks.push({
          service_name: service.name,
          endpoint: service.endpoint,
          status,
          response_time_ms: responseTime,
          status_code: statusCode,
        });

      } catch (error) {
        const responseTime = Date.now() - startTime;

        checks.push({
          service_name: service.name,
          endpoint: service.endpoint,
          status: 'down',
          response_time_ms: responseTime,
          error_message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Insert all checks
    const { error: insertError } = await supabase
      .from('uptime_checks')
      .insert(checks);

    if (insertError) {
      throw insertError;
    }

    // Calculate summary
    const upCount = checks.filter(c => c.status === 'up').length;
    const downCount = checks.filter(c => c.status === 'down').length;
    const degradedCount = checks.filter(c => c.status === 'degraded').length;
    const avgResponseTime = checks.reduce((sum, c) => sum + c.response_time_ms, 0) / checks.length;

    return new Response(
      JSON.stringify({
        success: true,
        checks_performed: checks.length,
        summary: {
          up: upCount,
          down: downCount,
          degraded: degradedCount,
          avg_response_time_ms: Math.round(avgResponseTime),
        },
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error checking uptime:', error);
    return new Response(
      JSON.stringify({ error: 'Uptime check failed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
}));
