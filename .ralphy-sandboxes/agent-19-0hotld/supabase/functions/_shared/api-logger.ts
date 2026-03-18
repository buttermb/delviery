/**
 * API Logger Middleware
 * Logs all API requests and tracks rate limits
 * Can be imported and used in edge functions
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface LogRequest {
  tenantId?: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  userAgent?: string;
  ipAddress?: string;
  requestBody?: any;
  responseBody?: any;
  errorMessage?: string;
}

interface RateLimitCheck {
  tenantId: string;
  endpoint: string;
  method: string;
}

export async function logApiRequest(
  supabaseUrl: string,
  supabaseKey: string,
  request: LogRequest
) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase.from('api_logs').insert({
      tenant_id: request.tenantId || null,
      endpoint: request.endpoint,
      method: request.method,
      status_code: request.statusCode,
      response_time_ms: request.responseTimeMs,
      user_agent: request.userAgent,
      ip_address: request.ipAddress,
      request_body: request.requestBody ? JSON.stringify(request.requestBody) : null,
      response_body: request.responseBody ? JSON.stringify(request.responseBody) : null,
      error_message: request.errorMessage,
    });
  } catch (error) {
    console.error('Failed to log API request:', error);
    // Don't throw - logging failure shouldn't break the request
  }
}

export async function checkRateLimit(
  supabaseUrl: string,
  supabaseKey: string,
  check: RateLimitCheck
): Promise<{ allowed: boolean; violation?: string }> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get rate limit config for tenant
    const { data: rateLimit } = await supabase
      .from('rate_limits')
      .select('*')
      .eq('tenant_id', check.tenantId)
      .single();

    if (!rateLimit) {
      // No custom limits, allow by default
      return { allowed: true };
    }

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Count requests in time windows
    const { count: hourlyCount } = await supabase
      .from('api_logs')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', check.tenantId)
      .eq('endpoint', check.endpoint)
      .gte('timestamp', oneHourAgo.toISOString());

    const { count: dailyCount } = await supabase
      .from('api_logs')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', check.tenantId)
      .gte('timestamp', oneDayAgo.toISOString());

    const { count: monthlyCount } = await supabase
      .from('api_logs')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', check.tenantId)
      .gte('timestamp', oneMonthAgo.toISOString());

    // Check limits
    if (hourlyCount && hourlyCount >= rateLimit.requests_per_hour) {
      await supabase.from('rate_limit_violations').insert({
        tenant_id: check.tenantId,
        endpoint: check.endpoint,
        violation_type: 'hourly',
        current_count: hourlyCount,
        limit_value: rateLimit.requests_per_hour,
      });
      return { allowed: false, violation: 'hourly' };
    }

    if (dailyCount && dailyCount >= rateLimit.requests_per_day) {
      await supabase.from('rate_limit_violations').insert({
        tenant_id: check.tenantId,
        endpoint: check.endpoint,
        violation_type: 'daily',
        current_count: dailyCount,
        limit_value: rateLimit.requests_per_day,
      });
      return { allowed: false, violation: 'daily' };
    }

    if (monthlyCount && monthlyCount >= rateLimit.requests_per_month) {
      await supabase.from('rate_limit_violations').insert({
        tenant_id: check.tenantId,
        endpoint: check.endpoint,
        violation_type: 'monthly',
        current_count: monthlyCount,
        limit_value: rateLimit.requests_per_month,
      });
      return { allowed: false, violation: 'monthly' };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // On error, allow the request (fail open)
    return { allowed: true };
  }
}

